## Backend (Node + Express + MongoDB)

**Tech stack**
- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **Database**: MongoDB (via Mongoose)
- **Auth**: JWT (with roles: `user`, `admin`)

### Setup

1. Install dependencies:
```bash
cd Backend
pnpm install # or npm install / yarn
```

2. Create `.env`:
```bash
cp .env.example .env
```
Edit values (MongoDB URI, JWT secret, etc.) as needed.

3. Run dev server:
```bash
pnpm dev
```

Server will start on `http://localhost:5000` by default.

### Main environment variables

- **`MONGODB_URI`**: Mongo connection string
- **`JWT_SECRET`**: Secret key for signing JWT tokens
- **`PORT`**: Port for the backend server (default `5000`)
- **`CLIENT_ORIGIN`**: URL of the Next.js frontend (for CORS), e.g. `http://localhost:3000`

### API Overview

- **Auth** (`/api/auth`)
  - `POST /register` – sign up (returns JWT + user)
  - `POST /login` – login (returns JWT + user)
  - `GET /me` – get current user (requires `Authorization: Bearer <token>`)

- **User dashboard** (`/api/dashboard`, requires auth)
  - `GET /overview` – stats for current user (tasks, completion rate, notifications, recent tasks)
  - `GET /tasks` – all tasks assigned to the current user
  - `PATCH /tasks/:id` – update status of a task assigned to the current user
  - `GET /notifications` – list notifications for current user
  - `POST /notifications/:id/read` – mark notification as read
  - `GET /leaderboard` – leaderboard based on completed task points

- **Admin dashboard** (`/api/admin`, requires `admin` role)
  - `GET /stats` – global stats (users, tasks, completion rate)
  - `GET /users` – list users (without password hashes)
  - `PATCH /users/:id/role` – change user role
  - `POST /tasks` – create a task assigned to a user (also creates a notification)
  - `GET /tasks` – list all tasks with user info
  - `DELETE /tasks/:id` – delete a task

Use these endpoints from your Next.js frontend to make the dashboard fully dynamic.

