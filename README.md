# Voice NotePad Monorepo

An offline-first MERN PWA split into three independent modules:

- `frontend/` — user PWA on port 5173
- `admin/` — admin dashboard on port 5174
- `backend/` — Express/MongoDB API on port 3001

## Features

- Unique-email signup and secure password hashing
- Password show/hide control
- Per-user notes with offline IndexedDB storage and background MongoDB sync
- English/Urdu display toggle
- Browser voice recognition plus Gemini structured item extraction
- Automatic totals calculated locally
- PNG note export
- Installable PWA with light/dark monochrome themes
- Protected admin dashboard for users and their notes

## Local setup

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and enter newly rotated credentials.
4. Set `ADMIN_EMAIL` to the email that should receive admin access.
5. Run `npm run dev`.

The user app runs at `http://localhost:5173`, admin at `http://localhost:5174`, and API at `http://localhost:3001`.

For production, create two Vercel projects from this repository:

1. Main frontend: keep the repository root as Root Directory. The root `vercel.json` builds `frontend/dist`, including the user app and `/admin` login. Add `VITE_API_URL=https://your-backend.vercel.app`.
2. Backend: set Root Directory to `backend`. Add `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in Vercel Environment Variables.

The root `.env` is only for local backend development and must never be committed. The standalone `admin/` module can still be deployed separately if a dedicated admin domain is wanted, but it is not required because the main frontend includes `/admin`.

## Vercel deployment

Import this repository into Vercel and add these environment variables in Project Settings:

- `MONGODB_URI`
- `JWT_SECRET` (use a long random value)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (defaults to `gemini-2.5-flash`)
- `ADMIN_EMAIL`

Use the default build command (`npm run build`) and output directory (`dist`). Do not prefix backend secrets with `VITE_`; that would expose them in the browser.

## Offline behavior

The application shell and local notes work offline after the first online visit. Changes are added to an IndexedDB queue and sent to MongoDB when connectivity returns. Login, account creation, admin data, cross-device sync, and Gemini processing require internet.
