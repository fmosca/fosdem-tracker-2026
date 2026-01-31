# FOSDEM 2026 Talk Tracker

Simple HTML+JS app for tracking which talks you and your friends are attending at FOSDEM 2026.

## Features

- Quick nickname registration (no email confirmation)
- Mark talks as "Going" or "Here"
- Real-time sync across all users
- Talks grouped by track
- Search functionality

## Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "fosdem-tracker")
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Realtime Database

1. In Firebase Console, go to "Build" → "Realtime Database"
2. Click "Create Database"
3. Choose location (closest to your users)
4. Start in **test mode** (we'll update rules next)

### 3. Enable Anonymous Authentication

1. Go to "Build" → "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Anonymous" provider
5. Click "Save"

### 4. Get Firebase Config

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click web icon (`</>`)
4. Register app with nickname (e.g., "fosdem-tracker")
5. Copy the `firebaseConfig` object

### 5. Update index.html

Replace the `firebaseConfig` object in `index.html` with your actual config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 6. Set Security Rules

1. Go to "Realtime Database" → "Rules" tab
2. Replace the rules with the contents of `firebase-rules.json`
3. Click "Publish"

The rules allow:
- Anyone to read attendance data
- Authenticated users to write their own user data
- Authenticated users to mark attendance

### 7. Host the App

You can host this on any static hosting service:

**Option A: GitHub Pages**
1. Create a GitHub repository
2. Upload `index.html` and `xml.xml`
3. Enable GitHub Pages in repository settings
4. Access via `https://yourusername.github.io/repo-name/`

**Option B: Netlify**
1. Go to [Netlify](https://www.netlify.com/)
2. Drag and drop the folder containing `index.html` and `xml.xml`
3. Your app is live!

**Option C: Cloudflare Pages**
1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Connect your GitHub repo or upload files
3. Deploy

**Option D: Firebase Hosting** (if you want everything in one place)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase init hosting`
3. Set public directory to current directory
4. Run `firebase deploy --only hosting`

## Usage

1. Open the app in your browser
2. Enter a nickname and click "Register"
3. Browse talks by track
4. Click "Going" to mark a talk you plan to attend
5. Click "Here" when you're actually at the talk
6. See who else is going/here in real-time!

## Data Structure

The app stores data in Firebase Realtime Database:

```
users/
  {uid}/
    nickname: string
    lastSeen: timestamp

attendance/
  {talkSlug}/
    going/
      {uid}: true
    here/
      {uid}: true
```

## Notes

- No build step required - just HTML, CSS, and vanilla JavaScript
- Uses Firebase CDN - no npm installs needed
- Anonymous authentication - no email required
- Real-time sync - see updates instantly
- Free tier should be sufficient for small groups
