# GoalCue 🎯

A personal goal tracking application designed to help you stay active and achieve your objectives through intelligent cueing and progress monitoring.

## 📋 Overview

GoalCue is a modern web application built to help users track personal goals and receive timely reminders to stay active and focused on their objectives. The app provides an intuitive interface for goal management with smart cueing features.

## 🏗️ Architecture

This project uses a **monorepo** structure powered by **Turborepo** to manage multiple interconnected parts of the application:

- **Web App**: Built with TanStack Start (React + TypeScript)
- **Shared Packages**:
  - `react-kit` - Reusable React components and utilities
  - `utils` - Common utility functions and helpers
- **Shared Tooling**:
  - TypeScript configurations and build tools
  - ESLint configurations for code linting
  - Prettier configurations for code formatting
  - Tailwind CSS configurations for styling

All shared packages are compiled in the monorepo but changes are reflected live in apps when modifications occur.

## 🚀 Getting Started

### Prerequisites

- Node.js 24.x
- pnpm 10.13.1 (pinned by `packageManager`)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd GoalCue
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

The web application will be available at `http://localhost:3000`

## 🛠️ Development

### Project Structure

```
GoalCue/
├── apps/
│   └── web/                 # Main web application
│       ├── src/
│       │   ├── routes/      # TanStack Router routes
│       │   └── ...
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   ├── react-kit/           # Reusable React components
│   └── utils/               # Common utility functions
├── tooling/
│   ├── typescript-config/   # Shared TypeScript configuration
│   ├── eslint-config/       # Shared ESLint configuration
│   ├── prettier-config/     # Shared Prettier configuration
│   └── tailwind-config/     # Shared Tailwind CSS configuration
├── package.json
├── turbo.json              # Turborepo configuration
└── pnpm-workspace.yaml
```

### Personal Google Calendar

Configure a Google OAuth **Web application** client with the Calendar API enabled.
Set these server-side variables on the Convex deployment:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_APP_URL`: the web app's Settings URL, for example `https://planner.example/settings` or `http://localhost:5173/settings`. OAuth completion requires the same authenticated GoalCue user who started the connection.
- `CALENDAR_ENCRYPTION_KEY`: a random 32-byte key encoded as base64. Keep this key stable; replacing it requires reconnecting accounts.

Register `https://<deployment>.convex.site/calendar/google/callback` as an authorized redirect URI, using the deployment's `CONVEX_SITE_URL`. No Google credentials belong in Vite environment variables. Configure the Google consent screen and test users before testing an unpublished OAuth client.

In **Settings → Personal calendars**, choose busy-only or full read-only access, authorize a personal Google account, then select calendars. Google Workspace accounts are rejected. Only selected calendars are read; there are no calendar writes or AI calls. Refresh tokens are encrypted with AES-256-GCM and never returned to the browser.

The five-minute Convex cron and manual refresh import the past 30 days and next 365 days. All pages must succeed before a snapshot replaces that scope. Failures keep prior Events; Settings shows the last success and errors, and the Day view warns when data is stale. Google expands recurring instances and exceptions; GoalCue retains their identities and series rules. Date-only start and exclusive end dates remain authoritative for all-day Events; numeric day bounds are only projections for the existing planner, and the UI displays dates rather than invented source times.

Busy-only connections request free/busy permissions, never Event-detail permissions. Google returns busy intervals without Event identities, recurrence or descriptive fields, so those intervals use stable normalized time-range identities within their Source. Full-detail Events use Google's Event IDs. Imported attention is visibly uncertain and conservatively focused until corrected; refreshes preserve that correction.

Disconnect a calendar independently or disconnect the entire account. Access stops immediately and in-flight refresh results are rejected; disconnecting the account also discards its credentials. The confirmation defaults to keeping derived Events; removal affects only Events from the selected Source or account. Retained Events keep their Source links and attention corrections. Reconnecting the same calendar reuses its Source identity and updates retained Events without duplicates.

Google API references: [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Events list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Free/busy query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).

### Available Scripts

- `pnpm dev` - Start development server for all apps
- `pnpm build` - Build all applications
- `pnpm lint` - Run linting across all packages
- `pnpm format` - Format code with Prettier across all packages
- `pnpm check-types` - Type-check all TypeScript files
- `pnpm clean` - Clean all build artifacts and node_modules

### Technology Stack

- **Frontend**: React 19, TypeScript, TanStack Router, TanStack Start
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Monorepo**: Turborepo
- **Styling**: Tailwind CSS
- **Code Quality**: ESLint, Prettier
- **Shared Packages**: React Kit (components), Utils (helpers)

## 🎯 Features

- **Goal Tracking**: Create and monitor personal goals
- **Smart Cueing**: Intelligent reminders to stay active
- **Progress Monitoring**: Track your advancement towards objectives
- **Modern UI**: Clean, responsive interface

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Currently, this project is maintained by a single developer. If you'd like to contribute in the future, please feel free to open issues or submit pull requests.

For now, this is a personal project focused on goal tracking and productivity enhancement.

---

**GoalCue** - Stay focused, stay active, achieve your goals! 🎯
