# WhatsApp Clone (Testing Project)

A full-stack WhatsApp clone built for testing purposes only.

Stack: React (Vite) + Tailwind CSS · Node.js + Express · MongoDB Atlas · Socket.IO · WebRTC (Google STUN) · Multer.

```
whatsapp-clone/
  backend/    Express API + Socket.IO server
  frontend/   React (Vite) client
```

## 1. Prerequisites

- Node.js 18+ and npm
- A free MongoDB Atlas cluster (https://www.mongodb.com/cloud/atlas/register) — create a database user, allow network access from anywhere (0.0.0.0/0) for testing, and copy the connection string.

## 2. Backend setup

```bash
cd whatsapp-clone/backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:

```
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/whatsapp-clone?retryWrites=true&w=majority
JWT_SECRET=any-long-random-string
PORT=5000
CLIENT_URL=http://localhost:5173
```

Run it:

```bash
npm run dev
```

The API runs at `http://localhost:5000`, health check at `GET /api/health`. Uploaded files are saved to `backend/uploads/` and served at `http://localhost:5000/uploads/<filename>`.

## 3. Frontend setup

In a second terminal:

```bash
cd whatsapp-clone/frontend
npm install
cp .env.example .env
npm run dev
```

The app runs at `http://localhost:5173`. `VITE_API_URL` in `.env` should point at the backend's `/api` path (defaults to `http://localhost:5000/api` if you skip the `.env` file).

## 4. Try it out

1. Open `http://localhost:5173` in two different browsers (or one normal + one incognito window) and register two different accounts.
2. Go to **Chats**, pick the other user, send messages — they arrive in real time, with typing indicators and read receipts (double check marks).
3. Click the phone or video icon in a chat to start a WebRTC call. Accept it from the incoming-call banner on the other browser.
4. Go to **Status**, tap the green **+** button to upload an image or video. It's visible to all users for 24 hours and then auto-expires (MongoDB TTL index, with a query-level fallback filter).

## 5. How real-time pieces fit together

- **Socket.IO** handles presence (`join`/`user_online`/`user_offline`), chat delivery (`send_message`/`receive_message`), typing (`typing`/`stop_typing`), and read receipts (`mark_read`/`messages_read`).
- **WebRTC signaling** rides on the same socket connection: `call_offer`, `call_answer`, `call_ice_candidate`, `call_end`, `call_reject`. The actual audio/video stream is peer-to-peer once connected, using Google's public STUN server (`stun:stun.l.google.com:19302`) for NAT traversal. No TURN server is configured, so calls may fail across some strict NATs/firewalls — fine for local testing, but add a TURN server (e.g. coturn or a free Twilio/Cloudflare TURN tier) before relying on this across arbitrary networks.
- The backend keeps an in-memory `userId -> socketId` map for routing events to the right person. This only works with a single backend process — if you ever scale to multiple instances, swap it for a Redis-backed adapter.

## 6. Deploying for testing (Render.com free tier or a free VPS)

**Backend (Render Web Service):**
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Add the same environment variables as your local `.env` (`MONGO_URI`, `JWT_SECRET`, `PORT`, and `CLIENT_URL` set to your deployed frontend URL).
- Render's free tier has an ephemeral filesystem, so anything saved to `backend/uploads/` will be wiped on redeploy/restart — fine for short-lived testing, but swap Multer's disk storage for something persistent (S3, Cloudinary) before relying on uploads long-term.

**Frontend (Render Static Site, or any static host):**
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Set `VITE_API_URL` to your deployed backend's `/api` URL (e.g. `https://your-backend.onrender.com/api`) before building.

**Oracle Cloud free VPS:** install Node.js, clone the repo, run both `backend` (e.g. with `pm2 start server.js`) and a static file server or `npm run preview` for the built frontend, and open the relevant ports (5000 for the API, 80/443 for the frontend if served from the same box, with a reverse proxy like Nginx in front for HTTPS — required for camera/mic access in most browsers outside `localhost`).

## 7. Known limitations (by design, since this is a testing build)

- No message encryption — messages are stored as plain text in MongoDB.
- No TURN server — WebRTC calls rely on STUN only.
- No pagination on chat history or status feed.
- Passwords are hashed with bcrypt, but there's no password reset flow, email verification, or rate limiting.
- The in-memory socket map means presence/calls don't survive a backend restart across users, and won't scale past a single server process.
"# whatsapp-clone-v2" 
