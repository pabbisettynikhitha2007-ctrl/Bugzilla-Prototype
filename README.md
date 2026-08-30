# SIGNAL — Modern Bug Tracker (Bugzilla Reimagined)

A full-stack bug/issue tracker built for Track 2: Developer Tool Reconstruction.
Keeps Bugzilla's core ideas (products → components → bugs, severity vs priority,
status workflow, comments, activity history) rebuilt with a modern stack,
real-time-feeling notifications, and an analytics dashboard.

## Stack

- **Backend:** Node.js 22+, Express, SQLite (via `node:sqlite` built-in), JWT auth
- **Frontend:** React (Vite), Tailwind CSS, React Router, Recharts

No external database server needed — SQLite is a single file, created automatically.

## Project structure

```
Bugzilla-Prototype/
├── server/              Express API + SQLite database
│   ├── db/              schema.sql, seed.js, db connector (with migrations)
│   ├── routes/          auth, bugs, meta (products/components), notifications, attachments
│   ├── middleware/       JWT auth guard
│   ├── .env.example     Environment variable template
│   └── index.js         app entrypoint
└── client/              React frontend (Vite)
    └── src/
        ├── pages/       Login, Register, Board, NewBug, BugDetail, Analytics
        ├── components/  Layout (nav + notifications), Badges, KanbanBoard
        ├── context/     AuthContext
        └── lib/         api.js, csv.js
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

## Environment variables

See `server/.env.example` for all environment variables.

| Variable               | Default | Description |
|------------------------|---------|-------------|
| `PORT`                 | `4000`  | API server port |
| `JWT_SECRET`           | *(hardcoded dev default)* | Change this in production |
| `GITHUB_WEBHOOK_SECRET`| *(empty)* | GitHub webhook secret for PR auto-resolve (see below) |

## What you can do in the app

### Core features

- **Board:** see all bugs in a **List** or drag-and-drop **Kanban** view, filter by
  status/severity/product, search by keyword, jump to **My Bugs** with one click,
  and **export the current results to CSV**
- **Bulk actions:** select multiple bugs in list view and change their status or
  assignee all at once
- **New Bug:** report a bug with product/component/severity/priority/assignee,
  and an optional **due date**
- **Bug Detail:** change status, reassign, change severity/priority/due date,
  **attach files** (screenshots, logs, patches — up to 10MB), comment, and see a
  full activity/audit trail of every field change
- **Overdue tracking:** bugs past their due date are flagged on the board and
  show a countdown/overdue badge on the detail page
- **Analytics:** charts for issues by status, severity, and product, plus
  quick stats (open count, resolved in last 7 days)
- **Notifications:** bell icon shows in-app alerts when you're assigned a bug,
  a bug you reported/own changes status, or someone comments — polls every 8s
  to feel "live" without needing a WebSocket server

### New features (v2)

#### Activity Timeline (improved)
The activity log on the Bug Detail page now shows fully human-readable messages:
- "Ada Admin created this bug: Website crash"
- "Ada Admin assigned this bug to Rahul"
- "Ada Admin changed status from open to in progress"
- "Ada Admin changed priority from P3 to P1"
- "Ada Admin linked a GitHub PR"
- "Ada Admin commented on this bug"

Raw database field names (like `assignee_id`) and internal UUIDs are never shown to users.

#### Bug Health Indicator
Each open bug now has a health badge on the board list and the bug detail page:
- **Healthy** (green) — recently updated, active, not overdue
- **At Risk** (amber) — aging, overdue, or limited recent activity
- **Stalled** (red) — no meaningful activity for 7+ days, significantly overdue, or stuck unassigned

The badge includes context like "Stalled for 6 days" or "Overdue by 3 days".

#### Bug Watch
Any user can watch a bug (not just the reporter/assignee) by clicking the **Watch** button on the Bug Detail page.

When you watch a bug you receive notifications for:
- status changes
- reassignment
- priority/severity changes
- new comments
- resolution/reopening

Click **Watching** to unwatch. The watcher count is shown next to the button. Duplicate notifications are prevented — watchers who are also the reporter/assignee/commenter only receive one notification per event.

#### Bug Summary
The sidebar on the Bug Detail page includes a compact **Bug Summary** panel showing:
- current status
- current assignee
- priority and severity
- number of days the bug has been open
- comment count
- attachment count
- activity entry count

#### Duplicate Bug Detection
When creating a new bug, Signal automatically searches for similar existing bugs as you type the title and description. Results appear in a "Possible duplicate bugs found" section showing the matching bug's title, status, severity, and assignee. Submission is never blocked — you can always submit if your bug is different.

#### GitHub PR Integration / Auto-Resolve
Link a GitHub Pull Request to any bug using the **GitHub PR** section on the Bug Detail page. Paste the PR URL and save.

**Webhook auto-resolve:** When a linked PR is merged on GitHub, the bug automatically moves to **Resolved**. To configure:

1. Create a webhook in your GitHub repository:
   - Go to **Settings → Webhooks → Add webhook**
   - **Payload URL:** `http://your-server/api/bugs/github/webhook`
   - **Content type:** `application/json`
   - **Events:** select "Pull requests"
   - **Secret:** set a random secret (recommended)

2. Set the webhook secret in your server environment:
   ```bash
   GITHUB_WEBHOOK_SECRET=your-random-secret
   ```

3. The application works normally without GitHub integration configured.
   If `GITHUB_WEBHOOK_SECRET` is empty, webhook signature verification is skipped
   (development only — set a secret in production).

#### @mentions in Comments
Type `@Name` in any comment to mention another user. The mention is highlighted in accent colour when the comment is displayed. The mentioned user receives a notification (no duplicate with the regular comment notification).

A dropdown autocomplete appears as you type `@` to help you select users. Example: `@Rahul can you check this?`

## How this maps back to Bugzilla's concepts

| Bugzilla concept              | This project                                  |
|--------------------------------|------------------------------------------------|
| Product → Component            | `products` / `components` tables               |
| Bug status workflow             | `open → in_progress → resolved → verified → closed` (+ `reopened`) |
| Severity vs Priority            | Kept as two separate fields, same idea          |
| Bug activity log                | `activity` table, human-readable messages in Bug Detail |
| Comments                        | `comments` table, threaded chronologically, with @mentions |
| CC / email notifications        | In-app `notifications` table + bell icon + bug watchers |
| Complex search UI               | Filter bar + keyword search + duplicate detection |
| External integration            | GitHub PR linking + webhook auto-resolve         |

## Database schema additions (v2)

Two new migrations are applied automatically on startup (no manual steps needed):

- **`bug_watchers` table** — tracks which users are watching each bug
- **GitHub PR columns** on `bugs` — `github_pr_url`, `github_pr_number`, `github_repo`, `github_pr_title`, `github_pr_state`
