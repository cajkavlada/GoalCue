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

### Personal Gmail

Enable the Gmail API in a Google Cloud project and configure a Web OAuth client with the app's exact JavaScript origins. Configure the consent screen for `https://www.googleapis.com/auth/gmail.readonly` and add test users while the app is in testing. Set `VITE_GOOGLE_CLIENT_ID` in `apps/web/.env`. This is a public client ID; no Google client secret or refresh token is required. Public distribution may require Google's verification for the Gmail scope.

Open Settings → Personal mail, confirm that the account is personal, and connect Gmail. Select each label explicitly; message bodies, same-label thread context, text attachments, and external AI permission are separate opt-ins. Excluding a Source stops reads. Google access tokens stay in browser memory and expire; reconnect explicitly to continue. The connector uses only Gmail GET endpoints and never sends, archives, deletes, marks read, or modifies labels. See Google's [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

Create one or more action Tasks or Reply Tasks from a message. Select the existing linked action when a later message updates that request; choose a new action for a separate request. Identity is account/thread/action based across selected labels, and updates preserve Task progress, completion and planning edits. Reply drafts are user-written, with missing facts explicitly marked `[INPUT NEEDED: ...]`. No AI provider is invoked by this feature; the Source permission records consent for future provider integration.

Inbox review defaults to 15 minutes on weekdays; Spam cleanup defaults to 10 minutes weekly. Both use normal priority, independent Occurrences, no Firm deadline, and no carry-forward. Change cadence, duration, priority and end conditions using the existing Task editor. A started review freezes at most 50 message IDs; later mail waits for another review. Completion is explicit and does not require inbox zero. Without Gmail configuration or access, create and complete manual review reminders. Disconnecting clears attributable excerpts and reply drafts and offers to keep reviews as manual reminders or stop them.

Raw messages, attachment data, and access tokens are never persisted to Convex or browser storage. Explicitly saved relevant excerpts and reply drafts remain linked to Tasks; removing content permissions or excluding/disconnecting their Source clears them. Only plain-text attachments up to 100 KB each and at most five same-label context messages are processed. Work accounts must remain disconnected. Gmail OAuth and real-account reads require configured credentials and are not covered by the local mocked tests.

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
