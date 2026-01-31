# FOSDEM 2026 Talk Tracker - Project Status

## Project Overview
A lightweight, zero-build HTML/JS application designed for friends to coordinate their FOSDEM 2026 schedules in real-time.

## Work Completed
- **Data Layer:** Implemented client-side XML parsing of the FOSDEM schedule and integration with Firebase Realtime Database.
- **Shared State:** Developed a "Shared Secret" (Group Name) architecture to isolate different friend groups without requiring complex authentication.
- **Core Features:**
    - Anonymous registration with nickname and group secret.
    - Persistent sessions via `localStorage`.
    - Real-time "Going" status tracking across all group members.
    - Global search and filtering by track.
- **UI/UX:**
    - Sidebar layout for desktop with "My Talks" and "Users" list.
    - Real-time attendance display on individual talk cards.
    - Automatic scrolling and highlighting for selected talks.
- **DevOps:**
    - Repository initialized: `fmosca/fosdem-tracker-2026`.
    - Automated deployment to GitHub Pages via GitHub Actions.

## Current Technical Stack
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Backend-as-a-Service:** Firebase (Auth, Realtime Database).
- **Deployment:** GitHub Pages.
- **Data Source:** FOSDEM XML Schedule.

## Mobile-Friendly Transition - COMPLETED ✅

### 1. Architectural Changes
- **Modular JS:** Created `app.js` - a reusable module exposing `FosdemApp` API with Firebase communication, state management, and data parsing.
- **Login Flow:** Implemented dedicated "Entry" view with centered card layout for registration.
- **Tabbed Interface:** Implemented fixed bottom navigation bar with three primary views:
    - **Schedule:** Full list of talks with search and collapsible tracks.
    - **My Plan:** Focused view of talks marked as "Going" with count header.
    - **Friends:** List of group members with avatars; clicking shows their planned talks.

### 2. UI/UX Improvements
- **Responsive Design:** Mobile-first single-column layout with touch-friendly 44px+ touch targets.
- **View Management:** CSS animations for smooth view transitions; tab bar becomes vertical sidebar on desktop.
- **Performance:** Efficient rendering with debounced search and minimal DOM manipulation.

### 3. File Structure
```
index.html      - Clean HTML structure with views and tab navigation
styles.css      - Mobile-first responsive CSS with CSS variables
app.js          - Core application module (FosdemApp API)
xml.xml         - FOSDEM schedule data
```

### 4. Pending Feature Roadmap
- **"I'm Here" Re-activation:** Re-introduce the "I'm Here" button with location-specific logic.
- **Conflict Highlighting:** Visual indicators for overlapping talks in "My Plan".
- **Offline Support:** Basic caching of the XML schedule via Service Workers.
