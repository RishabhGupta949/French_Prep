# FrenchPrep

**FrenchPrep** is a responsive, browser-based language-learning application for English speakers learning French. It combines short interactive lessons, a structured learning path, immediate answer feedback, progress tracking, and lightweight gamification.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, TypeScript |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | Google Cloud Firestore (Native mode), Firebase Admin SDK |
| Server state | TanStack Query (React Query) |
| Client state | Zustand |
| Forms and validation | React Hook Form, Zod |
| Styling | Tailwind CSS 3 |
| Authentication | Short-lived JWT access tokens and rotating JWT refresh tokens in HttpOnly cookies |
| AI | Groq API using an OpenAI-compatible interface for AI-powered review explanations |
| Deployment | Render Web Service; Express serves the API and production frontend build |

**Backend requirement:** Express.js is the required backend framework. Fastify is not used.

## Features

1. **Authentication:** Registration, login, logout, session refresh, and protected routes.
2. **Onboarding:** French as the target language, configurable daily XP goals (10, 20, 30, or 50 XP), and IANA time-zone selection/detection.
3. **Learning path:** Units, lessons, and exercises with sequential lesson unlocking.
4. **Interactive exercises:** Multiple-choice translation, fill-in-the-blank, and word-bank sentence building.
5. **Instant feedback:** Immediate correct/incorrect feedback with explanations.
6. **Progress tracking:** Lesson progress, completion results, accuracy, and XP summaries.
7. **Gamification:** Total XP, daily XP goals, time-zone-aware streaks, and a heart system (five maximum, with one heart regenerating every 30 minutes).
8. **Review queue:** Incorrectly answered exercises are added to a review queue for further practice.
9. **AI Review Coach:** AI-generated explanations help learners understand mistakes from the review queue.

> The current product includes the AI Review Coach. The earlier AI Conversation feature is not part of the current application scope.

## Project structure

```text
frenchprep/
├── client/                 # React frontend
├── docs/                   # Architecture and project documentation
├── firebase/               # Firestore rules and indexes
├── server/                 # Express backend
├── .env.example            # Environment variable template
├── package.json            # Root npm workspace configuration
├── PRD.md                  # Product Requirements Document
├── README.md               # Project documentation
└── LICENSE                 # Project license, if MIT licensing is applied
```

The complete AI conversation-history export required for the assignment is **not included in this repository**. It will be provided separately by email with the project submission.

## Getting started

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- A Firebase project with Firestore enabled in Native mode
- Firebase service-account credentials
- A Groq API key for the AI Review Coach

### 1. Clone the repository and install dependencies

```bash
git clone <repository-url>
cd frenchprep
npm install
```

### 2. Configure environment variables

Copy the example environment file and add your local credentials:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the values. The main settings include:

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5173

JWT_ACCESS_SECRET=<at-least-32-character-random-secret>
JWT_REFRESH_SECRET=<at-least-32-character-random-secret>

FIREBASE_PROJECT_ID=<your-firebase-project-id>
FIREBASE_CLIENT_EMAIL=<your-service-account-email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GROQ_API_KEY=<your-groq-api-key>
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-20b
```

Use the variable names and any additional required values in the repository's `.env.example` as the source of truth. The current server environment validator may also require `NVIDIA_NIM_API_KEY` as a legacy configuration value; check `server/src/config/env.ts` if the server reports a missing environment variable during startup.

**Never commit `.env`, Firebase service-account JSON files, private keys, API keys, or JWT secrets.** Keep real credentials in your local environment and configure production secrets through the hosting provider's environment settings.

### 3. Set up Firebase

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Cloud Firestore in Native mode**.
3. Choose a Firestore location close to your users and hosting region. The database location cannot be changed after creation.
4. Create a service account under **Project settings → Service accounts** and generate a private key.
5. Configure the project ID, service-account email, and private key in your environment variables.
6. Keep the service-account credentials private. Do not add the downloaded JSON key to Git.

### 4. Seed the learning content

After configuring Firebase credentials, run the seed script from the repository root:

```bash
npm run seed
```

The seed script creates the initial units, lessons, exercises, and answer keys in Firestore. Avoid running it against a production database unless you understand whether the script overwrites or duplicates existing content.

### 5. Start the development servers

```bash
npm run dev
```

The default development URLs are:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

The Vite development server proxies `/api` requests to the Express backend.

## Production build

Build the frontend and backend from the repository root:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

In production, Express serves the built React application from `client/dist` and exposes the API under `/api`.

## Deployment on Render

FrenchPrep can be deployed as a single Render Web Service when the Express server is configured to serve the frontend build.

1. Push the repository to GitHub and create a **Web Service** in Render.
2. Connect the GitHub repository and select the repository root as the service root directory.
3. Set the build command to:

   ```bash
   npm run build
   ```

4. Set the start command to:

   ```bash
   npm run start
   ```

5. Add the required environment variables from `.env.example` in the Render dashboard. Store secrets as environment variables; do not commit them to the repository.
6. Configure the Firebase private key in the format expected by the server. If the key is stored with escaped `\n` sequences, the server configuration must convert them to newline characters before initializing Firebase Admin.
7. Deploy and verify the frontend and `/api` endpoints.

The deployed application will be available from one origin, for example `https://<your-service>.onrender.com`.

## Available scripts

Run these commands from the repository root:

| Command | Description |
|---|---|
| `npm run dev` | Start the frontend and backend development servers concurrently |
| `npm run dev:client` | Start the Vite development server only |
| `npm run dev:server` | Start the Express development server only |
| `npm run build` | Build the frontend and backend |
| `npm run start` | Start the production server |
| `npm run test` | Run the test suite |
| `npm run seed` | Seed Firestore with the initial learning content |
| `npm run emulators` | Start the Firebase Emulator Suite |

## Architecture documentation

For the detailed design, see [`docs/PHASE_1_ARCHITECTURE.md`](docs/PHASE_1_ARCHITECTURE.md). It documents the technology choices, application structure, frontend and backend architecture, Firestore collections, security rules and indexes, seed data, API endpoints, environment configuration, and architectural trade-offs.

## Security

- Firestore access is performed by the Express backend through the Firebase Admin SDK. The browser does not access Firestore directly.
- Firestore Security Rules should deny direct client reads and writes.
- Passwords are hashed with Argon2id; plaintext passwords are not stored.
- Short-lived JWT access tokens are kept in client memory.
- Refresh tokens are stored in HttpOnly cookies, rotated on refresh, and represented by hashes in Firestore.
- Helmet, CORS, rate limiting, request-size limits, and Zod input validation are used to strengthen API security.
- Secret keys and service-account credentials must remain on the server and must never be exposed through frontend environment variables such as `VITE_*`.

## Testing

The integration tests use the Firebase Emulator Suite. Start the emulators in one terminal:

```bash
npm run emulators
```

Then run the tests from the repository root in another terminal:

```bash
npm run test
```

The test suite covers core learning and application behaviour, including exercise evaluation, lesson unlocking, heart and streak logic, XP awards, and authentication flows.

## Reviewer test account

A demo account is intended for project evaluation:

- **Email:** `demo@frenchprep.app`
- **Password:** Shared separately with the reviewer by email.

The demo account must be provisioned in the environment being reviewed. For local development, users can also create an account through the registration page. Do not use the demo account for personal or sensitive information.

## Known limitations

- A Firebase project and Firestore database must be configured manually.
- The application currently supports one language pair: English to French.
- Learning content is seeded; there is no admin panel or in-app lesson-authoring interface.
- The AI Review Coach requires valid Groq credentials and network access. Availability may depend on API limits and service status.
- The earlier AI Conversation feature is not included in the current application scope.
- Automated integration tests that require Firestore must be run with the Firebase Emulator Suite.