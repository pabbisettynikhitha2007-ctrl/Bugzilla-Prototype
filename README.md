# Signal — A Modern Bug Tracker (Bugzilla Reimagined)

A full-stack bug/issue tracker built for Track 2: Developer Tool Reconstruction.
It keeps Bugzilla's core ideas (products → components → bugs, severity vs priority,
status workflow, comments, activity history) but rebuilt with a modern stack,
real-time-feeling notifications, and an analytics dashboard.

## Stack

- **Backend:** Node.js, Express, SQLite (via better-sqlite3), JWT auth
- **Frontend:** React (Vite), Tailwind CSS, React Router, Recharts

No external database server needed — SQLite is a single file, created automatically.

## Project structure

```
bugtracker/
├── server/          Express API + SQLite database
│   ├── db/          schema.sql, seed.js, db connector
│   ├── routes/      auth, bugs, meta (products/components), notifications
│   ├── middleware/  JWT auth guard
│   └── index.js     app entrypoint
└── client/          React frontend (Vite)
    └── src/
        ├── pages/       Login, Register, Board, NewBug, BugDetail, Analytics
        ├── components/  Layout (nav + notifications), Badges
        ├── context/     AuthContext
        └── lib/api.js   API client
```

## How to run it locally

You need **Node.js 22.5 or newer** installed (check with `node -v`). Open **two terminal windows**.

> **Note:** The backend uses Node's built-in SQLite module (`node:sqlite`), so
> there's nothing to compile and no extra build tools (Visual Studio, Python,
> etc.) required — it just works after `npm install`, on Windows, Mac, or Linux.

### 1. Start the backend

```bash
cd server
npm install
npm run seed     # creates the database + demo users/bugs (safe to re-run)
npm start        # runs on http://localhost:4000
```

### 2. Start the frontend

```bash
cd client
npm install
npm run dev      # runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## Demo accounts

All use password `password123`:

| Email                | Role        |
|-----------------------|-------------|
| admin@demo.com        | admin       |
| maintainer@demo.com   | maintainer  |
| dev@demo.com          | developer   |
| reporter@demo.com     | reporter    |

Or click "Create one" on the login page to register your own account.

## What you can do in the app

- **Board:** see all bugs, filter by status/severity/product, search by keyword
- **New Bug:** report a bug with product/component/severity/priority/assignee
- **Bug Detail:** change status (open → in progress → resolved → verified → closed,
  or reopened), reassign, change severity/priority, comment, and see a full
  activity/audit trail of every field change
- **Analytics:** charts for issues by status, severity, and product, plus
  quick stats (open count, resolved in last 7 days)
- **Notifications:** bell icon shows in-app alerts when you're assigned a bug,
  a bug you reported/own changes status, or someone comments — polls every 8s
  to feel "live" without needing a WebSocket server

## How this maps back to Bugzilla's concepts

| Bugzilla concept              | This project                                  |
|--------------------------------|------------------------------------------------|
| Product → Component            | `products` / `components` tables               |
| Bug status workflow             | `open → in_progress → resolved → verified → closed` (+ `reopened`) |
| Severity vs Priority            | Kept as two separate fields, same idea          |
| Bug activity log                | `activity` table, shown in the Bug Detail page  |
| Comments                        | `comments` table, threaded chronologically      |
| CC / email notifications        | In-app `notifications` table + bell icon (no email needed) |
| Complex search UI               | Simple filter bar + keyword search (can be extended to full-text search) |

## Where to go next (ideas for extending)

- Add GitHub webhook integration to auto-close bugs when a PR merges
- Swap SQLite for PostgreSQL + add Elasticsearch/Meilisearch for fuzzy search
- Add WebSockets for truly real-time updates instead of polling
- Add role-based permissions (e.g., only maintainers can close bugs)
- Add file attachments (screenshots, logs) to bugs
- Add a Kanban board view (drag-and-drop between status columns)
