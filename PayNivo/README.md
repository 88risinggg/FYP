# PayNivo

Clean base branch for the PayNivo final year project.

## Current Main Branch

This branch is intentionally minimal so the UI and feature structure can be redesigned from scratch.

What is included:

- React + Vite frontend shell
- Express backend shell
- MySQL database connection in `src/server/db.js`
- Environment variable setup through `.env`
- Safe `.env.example` for GitHub

What is not included yet:

- Login UI
- Role pages
- Invoice module
- Payroll module
- Admin dashboard
- Staff dashboard
- Auth routes
- Feature-specific API routes

## Environment Setup

Create a local `.env` file using `.env.example` as the template.

Never push `.env` to GitHub.

```bash
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=your-database-name
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
PORT=5000
```

## Development

```bash
npm install
npm run dev
```

Backend health check:

```text
GET /api/health
GET /api/db/ping
```

## Branch Workflow

Everyone should branch from `main`.

```bash
git checkout main
git pull --ff-only
git checkout -b feature/your-feature-name
```

Suggested branches:

- `feature/invoicing-admin`
- `feature/invoicing-finance`
- `feature/payroll-admin`
- `feature/payroll-finance-hr`
- `feature/payroll-staff`
- `feature/invoicing-reports`
- `feature/payroll-reports`
- `feature/database-integration`

Keep shared setup changes in `main`. Build feature pages and APIs in feature branches, then merge back with pull requests.
