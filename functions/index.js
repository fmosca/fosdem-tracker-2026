// Firebase Cloud Functions for enforcing limits
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Configuration: limits enforced server-side
const MAX_GROUPS = 10;
const MAX_USERS_PER_GROUP = 50;
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS?.split(',') || null; // e.g. "group1,group2"

// Validate before creating a new group
exports.beforeGroupCreated = functions.database.ref('/groups/{groupName}/users/{uid}')
    .onWrite(async (change, context) => {
        const { groupName } = context.params;

        // If data was deleted, allow
        if (!change.after.exists()) return null;

        // Check if group name is in allowlist (if configured)
        if (ALLOWED_GROUPS && !ALLOWED_GROUPS.includes(groupName)) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Group not allowed. Contact administrator.'
            );
        }

        // Get count of existing groups (if limit enforced)
        if (MAX_GROUPS) {
            const groupsSnapshot = await admin.database().ref('groups').once('value');
            const groupCount = groupsSnapshot.exists() ? Object.keys(groupsSnapshot.val()).length : 0;

            // If this is a new group and we're at the limit
            if (groupCount >= MAX_GROUPS && !change.before.exists()) {
                // Check if group already has data (meaning it existed before)
                const groupData = await admin.database().ref(`groups/${groupName}`).once('value');
                if (!groupData.hasChild('users')) {
                    throw new functions.https.HttpsError(
                        'resource-exhausted',
                        `Maximum ${MAX_GROUPS} groups allowed.`
                    );
                }
            }
        }

        // Check user count within the group
        const usersSnapshot = await admin.database().ref(`groups/${groupName}/users`).once('value');
        const userCount = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;

        if (userCount >= MAX_USERS_PER_GROUP) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                `Maximum ${MAX_USERS_PER_GROUP} users per group.`
            );
        }

        return null;
    });

// Optional: HTTP endpoint to check availability
exports.checkAvailability = functions.https.onRequest(async (req, res) => {
    const groupName = req.query.group;

    if (!groupName) {
        return res.status(400).json({ error: 'Group name required' });
    }

    // Check allowlist
    if (ALLOWED_GROUPS && !ALLOWED_GROUPS.includes(groupName)) {
        return res.json({ available: false, reason: 'Group not in allowlist' });
    }

    // Check if group exists and has room
    const groupRef = admin.database().ref(`groups/${groupName}`);
    const snapshot = await groupRef.once('value');

    if (!snapshot.exists()) {
        return res.json({ available: true, reason: 'New group' });
    }

    const users = snapshot.child('users').val();
    const userCount = users ? Object.keys(users).length : 0;

    if (userCount >= MAX_USERS_PER_GROUP) {
        return res.json({ available: false, reason: 'Group full' });
    }

    return res.json({ available: true, userCount, maxUsers: MAX_USERS_PER_GROUP });
});
