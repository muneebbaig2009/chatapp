# ChatApp — Free, Open-Source WhatsApp-Style Messenger

A production-quality real-time chat application built entirely with free, open-source, self-hostable technology. **No paid APIs, no paid hosting, no paid databases.**

This repository is the **foundation** (Milestones 1–5 of the full plan): authentication, database, real-time one-to-one chat. It compiles, runs, and deploys. Later milestones (media, groups, calls, status, etc.) extend this same architecture.

---

## Tech Stack

| Layer        | Technology                          | License    |
|--------------|-------------------------------------|------------|
| Backend      | Node.js + Express + TypeScript      | MIT        |
| Real-time    | Socket.IO                           | MIT        |
| Database     | PostgreSQL                          | PostgreSQL |
| ORM          | Prisma                              | Apache 2.0 |
| Auth         | JWT (access + rotating refresh)     | MIT        |
| Container    | Docker + Docker Compose             | Apache 2.0 |

---

## What works right now

- Register / Login / Logout with JWT access tokens + httpOnly rotating refresh tokens
- Rate-limited auth endpoints, Helmet, CORS, bcrypt password hashing (cost 12)
- Real-time one-to-one messaging over authenticated WebSockets
- Online/offline presence, typing indicators, read receipts, reactions
- Persistent message history with pagination
- User search

---

## Project Structure

```
chatapp/
├── docker-compose.yml          # Postgres + server, one command to run
├── server/
│   ├── Dockerfile
│   ├── prisma/schema.prisma    # All database tables + relationships
│   └── src/
│       ├── config/             # env loading, Prisma client
│       ├── controllers/        # HTTP request handlers
│       ├── routes/             # Express route definitions
│       ├── services/           # business logic (DB access lives here)
│       ├── middleware/         # auth, validation, error handling
│       ├── sockets/            # Socket.IO real-time event handlers
│       ├── utils/              # jwt, password, helpers
│       ├── validation/         # Zod request schemas
│       ├── app.ts              # Express app assembly
│       └── index.ts            # HTTP + Socket server bootstrap
```

The architecture is **layered**: routes → controllers → services → Prisma. Controllers never touch the database directly; all data logic lives in services so it can be reused by both HTTP and socket handlers.

---

## Running Locally (Docker — easiest)

You only need Docker installed.

```bash
# 1. Clone
git clone <your-repo-url> chatapp && cd chatapp

# 2. Edit the two JWT secrets in docker-compose.yml (use long random strings)
#    Generate one with:  openssl rand -hex 32

# 3. Start everything (database + server + auto-migrations)
docker compose up --build
```

Server is now at `http://localhost:4000`. Health check: `http://localhost:4000/api/health`.

---

## Running Locally (without Docker)

You need Node.js 20+ and a PostgreSQL database.

```bash
cd server
cp .env.example .env          # then edit DATABASE_URL + secrets
npm install
npx prisma migrate dev        # creates tables
npm run dev                   # starts on http://localhost:4000
```

---

## REST API

| Method | Endpoint                       | Auth | Description                       |
|--------|--------------------------------|------|-----------------------------------|
| POST   | `/api/auth/register`           | No   | Create account, returns token     |
| POST   | `/api/auth/login`              | No   | Login, returns token              |
| POST   | `/api/auth/refresh`            | Cookie | Rotate refresh → new access token |
| POST   | `/api/auth/logout`             | Cookie | Invalidate refresh token        |
| GET    | `/api/users/me`                | Yes  | Current user profile              |
| GET    | `/api/chats`                   | Yes  | List my chats (with last message) |
| POST   | `/api/chats/direct/:userId`    | Yes  | Open/create 1-to-1 chat           |
| GET    | `/api/chats/:chatId/messages`  | Yes  | Message history (paginated)       |
| GET    | `/api/chats/search/users?q=`   | Yes  | Search users by name/username     |

Send the access token as `Authorization: Bearer <token>`.

### Example: register

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","username":"alice","displayName":"Alice","password":"secret123"}'
```

---

## Socket.IO Events

Connect with the access token: `io(URL, { auth: { token } })`.

**Client → Server:** `chat:join`, `chat:leave`, `message:send`, `typing:start`, `typing:stop`, `message:read`, `reaction:add`

**Server → Client:** `message:new`, `message:read`, `reaction:add`, `typing:start`, `typing:stop`, `presence:update`

---

## Running the Frontend

The frontend is React + Vite + TypeScript + Tailwind + Redux Toolkit.

```bash
cd client
npm install
npm run dev        # opens http://localhost:5173
```

The Vite dev server proxies `/api` and the WebSocket connection to the backend on port 4000, so run the backend first (see above). Open two browser windows, register two accounts, search for the other user with the ＋ button, and message in real time.

**What the UI does:** login/register with silent session restore, chat list with last-message preview, real-time messaging, typing indicators, online/offline presence, and a responsive layout that collapses to a single pane on mobile.

Build for production with `npm run build` (output in `client/dist/`), deployable free to Netlify, Vercel, Cloudflare Pages, or GitHub Pages.

---

## Free Deployment Guide

### Database — Neon (free Postgres)
1. Create a project at neon.tech (free tier).
2. Copy the connection string into your server's `DATABASE_URL`.

### Backend — Render or Fly.io free tier
1. Push this repo to GitHub.
2. On Render: New → Web Service → point at `/server`, build `npm ci && npm run build && npx prisma generate`, start `npx prisma migrate deploy && npm start`.
3. Add env vars: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_ORIGIN`.

### Self-host — any free VPS (e.g. Oracle Cloud Always Free)
1. Install Docker on the VPS.
2. Clone the repo, edit secrets in `docker-compose.yml`.
3. `docker compose up -d --build`.
4. Put Nginx + free Let's Encrypt TLS in front for HTTPS.

---

## Security Notes

- Passwords hashed with bcrypt (cost 12), never stored or logged in plaintext.
- Access tokens short-lived (15m); refresh tokens rotated on every use and stored server-side so they can be revoked.
- Refresh token delivered as an httpOnly, SameSite cookie (not readable by JS → mitigates XSS token theft).
- Helmet sets security headers; CORS restricted to your client origin.
- All socket connections require a valid token before any event is processed.
- **Before production:** replace the JWT secrets, set `NODE_ENV=production`, and serve over HTTPS only.

---

## Roadmap (remaining milestones)

Media upload (MinIO/local + chunked uploads), groups & admin controls, WebRTC voice/video calls with free STUN, group conferencing, broadcast lists, status/stories, push notifications, full test suite, and the React + Vite + Tailwind frontend. Each builds on the layered architecture already in place.
