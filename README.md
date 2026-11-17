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

### Server-side AI providers (#230)

AI starts disabled. Manual planning has no dependency on an AI connection. This issue adds the Convex provider boundary and reporting APIs; the chat planning tools and Source-context retrieval belong to their own issues.

Set these values in **Convex server environment settings**, never in public `VITE_*` settings or checked-in `.env` files:

- `AI_KEY_ENCRYPTION_SECRET`: a separately stored, random 32-byte key encoded as base64. Preserve it to decrypt existing personal credentials. Replacing it requires re-entering personal keys.
- `AI_OWNER_SUBJECT`: the owner's Clerk subject.
- `AI_OWNER_FUNDED_SUBJECTS`: comma-separated Clerk subjects explicitly granted owner funding. Invitations alone grant nothing.
- `AI_OPENAI_KEY`, `AI_ANTHROPIC_KEY`, `AI_GEMINI_KEY`: optional owner credentials for the corresponding provider. A failed personal key never uses these.
- `AI_MODEL_REVIEWS`: JSON keyed by `provider/model`, with `inputRate`, `outputRate` (USD per million tokens), `checkedAt`, `expiresAt` (Unix milliseconds), `retention` (the reviewed disclosure), and `accountSettingsChecked: true`. Reviews expire within 31 days and must be renewed before any affected model can run. Use rates covering applicable cache-write and regional surcharges; discounted cached tokens are conservatively metered at the reviewed input rate. Provider billing is authoritative.

Review the provider's current pricing, retention, API availability, billing tier, optional storage/training settings and provider-side spending controls before supplying a review. Provider spending limits may enforce with a delay. Account settings without a portable API require an explicit account-owner check; a model lookup alone does not verify billing or retention. In particular, check Gemini paid-service data terms before using private planning content. Do not claim zero retention.

For example, the shape of a review entry is:

```json
{
  "openai/gpt-6.1-sol": {
    "inputRate": 2.5,
    "outputRate": 10,
    "checkedAt": 1794873600000,
    "expiresAt": 1794960000000,
    "retention": "Standard provider retention applies. Optional Responses storage is disabled; this does not remove abuse-monitoring retention.",
    "accountSettingsChecked": true
  }
}
```

This short-lived example illustrates the format, not approval to activate an account. Include a reviewed entry for each selected model. The supported list is OpenAI `gpt-6.1-sol` / `gpt-6-luna`, Anthropic `claude-sonnet-5-5` / `claude-haiku-5-5`, and Gemini `gemini-3.8-flash` / `gemini-3.5-flash-lite`. The spec's initial owner selection is OpenAI Sol for chat and Luna for background. No model is substituted automatically.

Authenticated Convex APIs:

- `ai.catalog`: supported models, reviewed pricing and retention, and eligibility for activation.
- `aiActions.activate`: explicitly choose provider, funding (`personal` or `owner`), `chatModel`, `backgroundModel`, and acknowledge `retentionAccepted` and `accountSettingsChecked`. Supply a personal `key` to enter/replace it; omit it to retain the encrypted key for the same provider. Both selected models are checked against that account before activation. Keys are write-only, encrypted with AES-256-GCM bound to the user/provider, and never returned or logged by the adapters.
- `ai.disable({removeKey})`: stop new calls and optionally remove the encrypted key. Already dispatched calls can still incur charges.
- `ai.status`: masked credential status, estimated spend, reservations, remaining allowance, chat/background breakdown, shared funding headroom, and configured threshold/exhaustion warnings. Monetary values are integer USD microdollars: `1000000` is $1. `monthlyLimit` defaults to `10000000` for personal keys; `warningThreshold` defaults to `0.8`.
- `ai.runs`: the user's latest 50 attempts, provider/model, role, token usage and settlement status. Prompts, responses and credentials are not persisted in usage records.
- `aiActions.generate({role,requestId,prompt})`: one bounded text call under the authenticated subject. Use a unique request identity per explicit attempt. Duplicate identities never call the provider again. This API returns text and does not execute planning actions. Future chat callers must validate actions and Source permissions separately.

Allowances reset by UTC calendar month. Owner funding enforces $10 for the owner, $1 per granted invitee, a $10 invitee pool, and a $20 overall ceiling. Personal-key usage has a default editable $10 ceiling and does not consume owner funding. Background work is limited to 25% of each applicable allowance/pool. Reservations and settlement are atomic Convex mutations, so concurrent calls cannot spend the same remaining allowance.

Limits are one active call per role/user, 10 requests per rolling minute/user, 60 globally, 10 active calls globally, 16000 input and 4000 output tokens including billed reasoning, and a 60-second request timeout. Text input uses a conservative UTF-8 byte bound plus protocol headroom. One call per run, with no automatic retries or tool loop, is deliberately below the spec's maximum of five calls and two retries. OpenAI uses `store:false` and standard service tier; Anthropic uses stateless Messages without explicit cache/storage controls; Gemini uses GenerateContent without persistent interactions, explicit caching or logging opt-in.

Timeouts, ambiguous transport failures and absent usage retain their reservation. Explicit nonbillable request rejections release it. If a worker stops before settlement, its reservation also remains held. Trusted operators can inspect `aiRuns` and invoke internal `ai.settle` with verified usage (`complete`) or a verified nonbillable outcome (`failed`); never release unknown charges merely because time elapsed. Settlement is idempotent. After a reset or failure, chat resumes only on an explicit new attempt. This boundary does not enqueue or replay background work.

Provider references rechecked on 17 November 2026: [OpenAI Sol model and pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [OpenAI Responses storage](https://developers.openai.com/api/docs/guides/conversation-state), [Claude models](https://platform.claude.com/docs/en/models/overview), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [Claude retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [Gemini models](https://aistudio.google.com/docs/models), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), and [Gemini retention](https://ai.google.dev/gemini-api/docs/zdr). These do not establish the settings or entitlements of any particular account.

Verification: `pnpm --filter @gc/convex test` runs mocked-provider acceptance tests and the manual planning regression suite. Build workspace dependencies before a standalone Convex typecheck: `pnpm --filter "@gc/convex^..." build`, then `pnpm --filter @gc/convex check-types`. Live activation requires server secrets and a configured Convex deployment; it is not performed by tests.
