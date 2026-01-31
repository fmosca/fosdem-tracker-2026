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

### 7. Host the App (GitHub Pages)

This repository is pre-configured with a GitHub Actions workflow for automatic deployment to GitHub Pages.

1. **Push your changes:** Once you've updated `index.html` with your Firebase config, commit and push to the `master` branch.
2. **Monitor Deployment:** Go to the **Actions** tab in your GitHub repository to see the "Deploy to GitHub Pages" workflow running.
3. **Configure Pages Source:**
    - Go to **Settings** → **Pages**.
    - Under **Build and deployment** → **Source**, ensure **GitHub Actions** is selected.
4. **Access your site:** Your app will be available at `https://your-username.github.io/fosdem-tracker-2026/`.

### 8. Security: Restrict your API Key

To prevent other people from using your Firebase API key on their own sites, you should restrict it to your domain:

1. Go to the [Google Cloud Credentials page](https://console.cloud.google.com/apis/credentials).
2. Select your project.
3. Click on the **"Browser key (auto-created by Firebase)"**.
4. Under **Website restrictions**, select **Websites**.
5. Add your domain: `https://your-username.github.io/*`.
6. (Optional) Under **API restrictions**, restrict the key to only use `Identity Toolkit API`, `Google Cloud Realtime Database`, and `Firebase Installations API`.
7. Click **Save**.

## Usage

1. **Join a Group:** Open the app and enter a **Group Password / Secret** and your **Nickname**.
    - The Group Secret acts as a private room. Only people who enter the exact same secret will see each other's data.
2. **Browse & Search:** Use the search bar or browse by track.
3. **Mark Attendance:** Click "Going" on any talk you plan to attend.
4. **Sidebar Navigation:**
    - **My Talks:** See a quick list of everything you've marked as "Going".
    - **Users:** See other people in your group. Click a user to filter the schedule to only show talks they are attending.
5. **Clear Filters:** Use the "Show All Talks" button in the sidebar to reset the view.

## Data Structure

The app stores data in Firebase Realtime Database using a nested group structure:

```
groups/
  {sharedSecret}/
    users/
      {uid}/
        nickname: string
        lastSeen: timestamp
    attendance/
      {talkSlug}/
        going/
          {uid}: true
```

## Notes

- No build step required - just HTML, CSS, and vanilla JavaScript
- Uses Firebase CDN - no npm installs needed
- Anonymous authentication - no email required
- Real-time sync - see updates instantly
- Free tier should be sufficient for small groups
