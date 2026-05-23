# PayNivo

Clean `main` branch for the PayNivo final year project.

The UI and feature branches should follow the supplied prototype:

- Left sidebar with product name and grouped navigation.
- Top header with page title, search, notifications, and user profile.
- Admin dashboard style with metric cards, charts, activity list, reminder schedule, and quick actions.
- Invoicing and payroll areas should reuse the same shell/layout style so the final system feels consistent.

## Current Main Branch

`main` is intentionally minimal. It is the shared starting point that every teammate branches from.

Included in `main`:

- React + Vite frontend shell.
- Express backend shell.
- MySQL database connection in `src/server/db.js`.
- Environment variable setup through `.env`.
- Safe `.env.example` for GitHub.
- Branch guide and prototype scope in this README.

Not included in `main` yet:

- Login UI.
- Admin dashboard UI.
- Invoicing pages.
- Payroll pages.
- Role-protected frontend routes.
- Feature-specific backend routes.

These should be built in feature branches and merged back later.

## Prototype Scope

The prototype is an admin dashboard for an Automated Invoicing and Payroll System.

Shared layout expected by feature branches:

- Sidebar:
  - Dashboard
  - Users
  - Roles
  - Invoice Settings
  - Reminder Settings
  - Audit Logs
  - Reports
- Header:
  - Current page title
  - Search input
  - Notification icon
  - User profile menu
- Dashboard content:
  - Summary metric cards
  - Invoice status distribution chart
  - Recent system activities
  - Upcoming reminder schedule
  - Quick actions

Feature teams should keep this visual direction when building their own pages.

## Main Branch Responsibility

`main` should only hold shared foundation code:

- App entry point.
- Common styling setup.
- Environment/database setup.
- Basic Express app.
- Shared documentation.

Avoid building feature-specific UI directly on `main`.

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

## Feature Ownership

### `feature/invoicing-admin`

Owner: Jinheng

Focus:

- Admin dashboard based on the prototype.
- User and role management entry points.
- Invoice settings.
- Reminder settings.
- Audit logs.
- Reports overview.

Prototype sections most relevant:

- Sidebar admin navigation.
- Dashboard metric cards.
- Invoice status distribution.
- Recent system activities.
- Upcoming reminder schedule.
- Quick actions.

### `feature/invoicing-finance`

Owner: Arut

Focus:

- Finance invoicing dashboard.
- Invoice CRUD.
- Customer management.
- Payment records.
- Invoice status tracking.

### `feature/payroll-admin`

Owner: Ray

Focus:

- Admin payroll settings.
- Payroll configuration.
- Payroll access control.
- Payroll reports entry points.

### `feature/payroll-finance-hr`

Owner: Ray

Focus:

- HR/Finance payroll dashboard.
- Employee records.
- Payroll runs.
- Payslip generation.

### `feature/payroll-staff`

Owner: Steven

Focus:

- Staff portal.
- View payslips.
- Filter payslip history.
- Staff profile/payroll self-service.

## Before Pushing Main

Check:

- `.env` is ignored and not pushed.
- `.env.example` is pushed.
- `node_modules/` is ignored.
- `dist/` is ignored.
- The app builds successfully.

```bash
npm run build
```

Then push:

```bash
git add -A
git commit -m "Reset main to clean base with database env setup"
git push origin main
```
