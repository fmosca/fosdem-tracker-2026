// FOSDEM 2026 Talk Tracker - Core Application Module

(function(window) {
    'use strict';

    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyAxaKYkC9fUPrTUomNLPxI8tkTka_Qyvq4",
        authDomain: "fosdem-friends.firebaseapp.com",
        databaseURL: "https://fosdem-friends-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "fosdem-friends",
        storageBucket: "fosdem-friends.firebasestorage.app",
        messagingSenderId: "466631043889",
        appId: "1:466631043889:web:5951bc2684f01c711e5e10"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const auth = firebase.auth();

    // Application State
    const state = {
        currentUser: null,
        groupName: null,
        nickname: null,
        scheduleData: null,
        allUsers: {},
        globalAttendance: {},
        currentFilter: { type: 'none', value: null },
        currentView: 'schedule', // schedule, myplan, friends
        searchQuery: '',
        isInitialized: false
    };

    // Event callbacks registry
    const callbacks = {
        onScheduleLoaded: [],
        onUserChange: [],
        onUsersUpdate: [],
        onAttendanceUpdate: [],
        onViewChange: [],
        onAuthStateChange: []
    };

    // Helper to get DB paths
    function getPath(subPath) {
        if (!state.groupName) return null;
        return `groups/${state.groupName}/${subPath}`;
    }

    // Load and parse XML schedule
    async function loadSchedule() {
        try {
            const response = await fetch('xml.xml');
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            // Parse tracks
            const tracks = {};
            xmlDoc.querySelectorAll('track').forEach(track => {
                const slug = track.getAttribute('slug');
                const name = track.textContent.trim();
                tracks[slug] = { name, talks: [] };
            });

            // Parse events
            xmlDoc.querySelectorAll('event').forEach(event => {
                const slug = event.querySelector('slug')?.textContent.trim();
                const title = event.querySelector('title')?.textContent.trim();
                const trackEl = event.querySelector('track');
                const trackSlug = trackEl?.getAttribute('slug');
                const date = event.querySelector('date')?.textContent.trim();
                const start = event.querySelector('start')?.textContent.trim();
                const duration = event.querySelector('duration')?.textContent.trim();
                const room = event.querySelector('room')?.textContent.trim();
                const url = event.querySelector('url')?.textContent.trim();

                if (slug && title && trackSlug) {
                    if (!tracks[trackSlug]) {
                        const trackName = trackEl?.textContent.trim() || trackSlug;
                        tracks[trackSlug] = { name: trackName, talks: [] };
                    }

                    tracks[trackSlug].talks.push({
                        slug,
                        title,
                        date,
                        start,
                        duration,
                        room,
                        url
                    });
                }
            });

            // Sort talks by date within each track
            Object.keys(tracks).forEach(slug => {
                tracks[slug].talks.sort((a, b) => {
                    const dateCompare = (a.date || '').localeCompare(b.date || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.start || '').localeCompare(b.start || '');
                });
            });

            state.scheduleData = tracks;
            notifyCallbacks('onScheduleLoaded', tracks);

            if (state.currentUser && state.groupName) {
                initRealtimeListeners();
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
            throw error;
        }
    }

    // Initialize real-time Firebase listeners
    function initRealtimeListeners() {
        if (state.isInitialized) return;
        state.isInitialized = true;

        // Watch all users in group
        database.ref(getPath('users')).on('value', (snapshot) => {
            state.allUsers = snapshot.val() || {};
            notifyCallbacks('onUsersUpdate', state.allUsers);
        });

        // Watch all attendance in group
        database.ref(getPath('attendance')).on('value', (snapshot) => {
            state.globalAttendance = snapshot.val() || {};
            notifyCallbacks('onAttendanceUpdate', state.globalAttendance);
        });
    }

    // Simple hash for PIN (not cryptographically secure, but prevents casual snooping)
    function hashPin(pin) {
        let hash = 0;
        const str = pin + state.groupName; // Salt with group name
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // Find existing user by nickname in a group
    async function findUserByNickname(group, nickname) {
        const tempPath = `groups/${group}/users`;
        const snapshot = await database.ref(tempPath).once('value');
        const users = snapshot.val() || {};

        for (const [uid, userData] of Object.entries(users)) {
            if (userData.nickname === nickname) {
                return { uid, ...userData };
            }
        }
        return null;
    }

    // Check if this is a returning user (same device/browser)
    function getSavedUserId(group, nickname) {
        const key = `fosdem_uid_${group}_${nickname.toLowerCase()}`;
        return localStorage.getItem(key);
    }

    // Save user ID for future sessions
    function saveUserId(group, nickname, uid) {
        const key = `fosdem_uid_${group}_${nickname.toLowerCase()}`;
        localStorage.setItem(key, uid);
    }

    // Verify PIN for existing user
    async function verifyPin(uid, pin) {
        const snapshot = await database.ref(getPath(`users/${uid}/pinHash`)).once('value');
        const storedHash = snapshot.val();
        if (!storedHash) return false; // Old user without PIN
        return storedHash === hashPin(pin);
    }

    // Register/join a group
    async function register(nickname, group, pin = null, existingUid = null) {
        if (!nickname || !group) {
            throw new Error('Please enter both a nickname and a group secret');
        }

        // Normalize nickname
        nickname = nickname.trim();
        state.groupName = group;

        // Check if nickname exists in group
        const existingUser = await findUserByNickname(group, nickname);

        if (existingUser) {
            // Nickname already taken
            if (existingUid && existingUid === existingUser.uid) {
                // Returning on same device - proceed
            } else if (pin) {
                // Verify PIN to reclaim identity
                const valid = await verifyPin(existingUser.uid, pin);
                if (!valid) {
                    throw new Error('Incorrect PIN. This nickname is already taken.');
                }
                // PIN correct - will reclaim this identity
            } else {
                // Ask for PIN
                throw new Error('PIN_REQUIRED');
            }

            // Reclaim existing identity
            state.currentUser = { uid: existingUser.uid };
            state.nickname = nickname;
            localStorage.setItem('fosdem_group', group);
            saveUserId(group, nickname, existingUser.uid);

            // Update last seen
            await database.ref(getPath(`users/${existingUser.uid}`)).update({
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            notifyCallbacks('onUserChange', { uid: existingUser.uid, nickname, group });

            if (state.scheduleData) {
                initRealtimeListeners();
            }

            return { uid: existingUser.uid, nickname, group, existing: true };
        }

        // New user - create account
        localStorage.setItem('fosdem_group', group);

        try {
            if (!auth.currentUser) {
                const userCredential = await auth.signInAnonymously();
                state.currentUser = userCredential.user;
            } else {
                state.currentUser = auth.currentUser;
            }

            state.nickname = nickname;

            // Save user data with PIN hash if provided
            const userData = {
                nickname: nickname,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };

            if (pin) {
                userData.pinHash = hashPin(pin);
            }

            await database.ref(getPath(`users/${state.currentUser.uid}`)).set(userData);

            // Save UID for future sessions
            saveUserId(group, nickname, state.currentUser.uid);

            notifyCallbacks('onUserChange', { uid: state.currentUser.uid, nickname, group });

            if (state.scheduleData) {
                initRealtimeListeners();
            }

            return { uid: state.currentUser.uid, nickname, group, existing: false };
        } catch (error) {
            console.error('Error registering:', error);
            throw error;
        }
    }

    // Logout
    function logout() {
        localStorage.removeItem('fosdem_group');
        state.currentUser = null;
        state.groupName = null;
        state.nickname = null;
        state.isInitialized = false;
        window.location.reload();
    }

    // Toggle attendance for a talk
    async function toggleAttendance(talkSlug, type = 'going') {
        if (!state.currentUser || !state.groupName) {
            throw new Error('Please join a group first');
        }

        const ref = database.ref(getPath(`attendance/${talkSlug}/${type}/${state.currentUser.uid}`));
        const snapshot = await ref.once('value');

        if (snapshot.exists()) {
            await ref.remove();
        } else {
            await ref.set(true);
        }
    }

    // Check if current user is attending a talk
    function isUserAttending(talkSlug, type = 'going') {
        if (!state.currentUser || !state.groupName) return false;
        return !!state.globalAttendance[talkSlug]?.[type]?.[state.currentUser.uid];
    }

    // Get attendees for a talk
    async function getAttendees(talkSlug, type = 'going') {
        const attendanceData = state.globalAttendance[talkSlug]?.[type] || {};
        const userIds = Object.keys(attendanceData);

        if (userIds.length === 0) return [];

        const nicknames = await Promise.all(
            userIds.map(async (uid) => {
                const userSnap = await database.ref(getPath(`users/${uid}/nickname`)).once('value');
                return {
                    uid,
                    nickname: userSnap.val() || 'Anonymous'
                };
            })
        );

        return nicknames;
    }

    // Get talks filtered by current criteria
    function getFilteredTalks() {
        if (!state.scheduleData) return {};

        const filtered = {};
        const searchTerm = state.searchQuery.toLowerCase();

        Object.keys(state.scheduleData).forEach(trackSlug => {
            const track = state.scheduleData[trackSlug];
            const filteredTalks = track.talks.filter(talk => {
                // Apply search filter
                if (searchTerm) {
                    return talk.title.toLowerCase().includes(searchTerm) ||
                           talk.slug.toLowerCase().includes(searchTerm);
                }

                // Apply view-specific filters
                if (state.currentView === 'myplan') {
                    return isUserAttending(talk.slug);
                }

                if (state.currentView === 'friends' && state.currentFilter.type === 'user') {
                    return !!state.globalAttendance[talk.slug]?.going?.[state.currentFilter.value];
                }

                return true;
            });

            if (filteredTalks.length > 0) {
                filtered[trackSlug] = { name: track.name, talks: filteredTalks };
            }
        });

        return filtered;
    }

    // Get current user's planned talks
    function getMyTalks() {
        if (!state.scheduleData) return [];

        const myTalks = [];
        Object.keys(state.globalAttendance).forEach(talkSlug => {
            if (state.globalAttendance[talkSlug].going &&
                state.globalAttendance[talkSlug].going[state.currentUser?.uid]) {

                // Find talk details
                Object.values(state.scheduleData).some(track => {
                    const talk = track.talks.find(t => t.slug === talkSlug);
                    if (talk) {
                        myTalks.push({ ...talk, trackName: track.name });
                        return true;
                    }
                    return false;
                });
            }
        });

        // Sort by date and start time
        return myTalks.sort((a, b) => {
            const dateCompare = (a.date || '').localeCompare(b.date || '');
            if (dateCompare !== 0) return dateCompare;
            return (a.start || '').localeCompare(b.start || '');
        });
    }

    // Get talks for a specific user
    function getTalksForUser(uid) {
        if (!state.scheduleData) return [];

        const userTalks = [];
        Object.keys(state.globalAttendance).forEach(talkSlug => {
            if (state.globalAttendance[talkSlug].going &&
                state.globalAttendance[talkSlug].going[uid]) {

                Object.values(state.scheduleData).some(track => {
                    const talk = track.talks.find(t => t.slug === talkSlug);
                    if (talk) {
                        userTalks.push({ ...talk, trackName: track.name });
                        return true;
                    }
                    return false;
                });
            }
        });

        return userTalks.sort((a, b) => {
            const dateCompare = (a.date || '').localeCompare(b.date || '');
            if (dateCompare !== 0) return dateCompare;
            return (a.start || '').localeCompare(b.start || '');
        });
    }

    // Set current view
    function setCurrentView(view) {
        state.currentView = view;
        notifyCallbacks('onViewChange', view);
    }

    // Set search query
    function setSearchQuery(query) {
        state.searchQuery = query;
    }

    // Set filter (for friends view)
    function setFilter(type, value) {
        state.currentFilter = { type, value };
    }

    // Clear filter
    function clearFilter() {
        state.currentFilter = { type: 'none', value: null };
    }

    // Get nickname for a user ID
    function getNickname(uid) {
        return state.allUsers[uid]?.nickname || 'Anonymous';
    }

    // Get all users except current
    function getOtherUsers() {
        return Object.keys(state.allUsers)
            .filter(uid => uid !== state.currentUser?.uid)
            .map(uid => ({ uid, nickname: state.allUsers[uid].nickname }));
    }

    // Subscribe to events
    function on(event, callback) {
        if (callbacks[event]) {
            callbacks[event].push(callback);
        }
    }

    // Notify callbacks
    function notifyCallbacks(event, data) {
        if (callbacks[event]) {
            callbacks[event].forEach(cb => cb(data));
        }
    }

    // Check for saved session on load
    function checkSavedSession() {
        const savedGroup = localStorage.getItem('fosdem_group');
        return savedGroup;
    }

    // Restore session from localStorage
    async function restoreSession() {
        const savedGroup = localStorage.getItem('fosdem_group');
        if (!savedGroup || !auth.currentUser) return null;

        state.groupName = savedGroup;
        const snapshot = await database.ref(getPath(`users/${auth.currentUser.uid}/nickname`)).once('value');
        const nickname = snapshot.val();

        if (nickname) {
            state.currentUser = auth.currentUser;
            state.nickname = nickname;
            notifyCallbacks('onUserChange', { uid: auth.currentUser.uid, nickname, group: savedGroup });
            if (state.scheduleData) {
                initRealtimeListeners();
            }
            return { uid: auth.currentUser.uid, nickname, group: savedGroup };
        }

        return null;
    }

    // Listen to auth state changes
    auth.onAuthStateChanged((user) => {
        notifyCallbacks('onAuthStateChange', user);
    });

    // Public API
    const FosdemApp = {
        // State getters
        get currentUser() { return state.currentUser; },
        get groupName() { return state.groupName; },
        get nickname() { return state.nickname; },
        get scheduleData() { return state.scheduleData; },
        get allUsers() { return state.allUsers; },
        get globalAttendance() { return state.globalAttendance; },
        get currentView() { return state.currentView; },
        get searchQuery() { return state.searchQuery; },
        get isLoggedIn() { return !!state.currentUser && !!state.groupName; },

        // Methods
        loadSchedule,
        register,
        logout,
        toggleAttendance,
        isUserAttending,
        getAttendees,
        getFilteredTalks,
        getMyTalks,
        getTalksForUser,
        setCurrentView,
        setSearchQuery,
        setFilter,
        clearFilter,
        getNickname,
        getOtherUsers,
        on,
        checkSavedSession,
        restoreSession,
        findUserByNickname,
        getSavedUserId
    };

    window.FosdemApp = FosdemApp;

})(window);
