# IPAC Annual Dessert Bake-Off

A people's-ballot voting site for the IPAC 40th-anniversary dessert bake-off.
Vite + React + Tailwind, data in Firebase Firestore, deploys as a static site to GitHub Pages.

## Stack

- **Vite + React 18** — SPA, no routing
- **Tailwind CSS** — utility classes sprinkled throughout the component
- **lucide-react** — icons
- **Google Fonts** (Fraunces, Caveat) — loaded in `index.html`
- **Firebase Firestore** — shared storage for desserts and votes
- **localStorage** — personal state (voter id + which desserts this browser has voted on)

## Prerequisites

- Node 18+
- A Firebase project with Cloud Firestore enabled

## Setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your Firebase web-app config
npm run dev
```

### Firebase config

In the [Firebase Console](https://console.firebase.google.com):

1. Create a project.
2. **Build → Firestore Database → Create database.** Start in production mode.
3. **Project Settings → Your apps → Web app (`</>`)** — register a web app and copy the `firebaseConfig` values into `.env.local`.
4. **Firestore → Rules.** For an internal-only bake-off poll, permissive rules are fine:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   If the site is public, lock this down — at minimum scope writes to the `desserts` and `votes` collections and consider App Check.

## Admin

Add `?admin=spherex` to the URL to unlock the admin page for adding/deleting entries.

## Deploy to GitHub Pages

`vite.config.js` uses `base: './'`, so the built `dist/` works at any subpath without further configuration.

1. Push this repo to GitHub.
2. Deploy:
   ```bash
   npm run deploy
   ```
   This builds and pushes `dist/` to the `gh-pages` branch via the `gh-pages` package.
3. In the repo **Settings → Pages**, set source to the `gh-pages` branch (root). The site will be published at `https://<you>.github.io/<repo>/`.

Subsequent deploys: re-run `npm run deploy`.

> **Env vars at deploy time:** `npm run deploy` reads `.env.local` during the build. The Firebase web API key ends up in the bundled JS — that's normal for web apps, but it means you should enforce access rules in Firestore (and/or App Check), not rely on the key being secret.

## Data model

Firestore:
- `desserts/{id}` — `{ id, name, baker, description, imageData, createdAt }` (imageData is a base64 JPEG data URL, resized to max 900px)
- `votes/{dessertId}_{voterId}` — `{ dessertId, voterId, theme, flavor, comment, votedAt }`

localStorage:
- `voter_id` — generated once per browser
- `voted_desserts` — JSON array of dessert ids this browser has voted on

## Project layout

```
index.html              Vite entry + font preconnect/link
vite.config.js          base: './' for subpath-safe deploys
src/
  main.jsx              React mount
  App.jsx               the full component
  storage.js            Firestore + localStorage adapter
  firebase.js           Firebase init from VITE_* env vars
  index.css             Tailwind directives
```
