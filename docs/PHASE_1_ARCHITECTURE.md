# FrenchPrep — Architecture & Implementation

**Current Architecture — November 2026**

## 1. Project Overview

FrenchPrep is a gamified, browser-based language-learning application that helps English speakers learn French through structured lessons, interactive exercises, progress tracking, and AI-assisted answer reviews.

The application follows a full-stack architecture with a React frontend, an Express API, and Google Cloud Firestore as its primary database.

In production, a single Render Web Service serves both the React application and the Express API.

### Core Capabilities

- User registration, login, authentication, and session management.
- Onboarding with daily learning goals and time-zone preferences.
- Structured French learning paths, units, lessons, and exercises.
- Interactive lesson attempts with immediate answer evaluation.
- XP, hearts, daily progress, and streak tracking.
- Review workflows for exercises that need additional practice.
- AI-powered Review Coach using Groq.
- Persistent learner progress stored in Firestore.

---

## 2. Technology Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js 4.x |
| Language | TypeScript 5.x |
| Database | Google Cloud Firestore (Native mode) |
| Database SDK | Firebase Admin SDK |
| Validation | Zod |
| Authentication | JWT access and refresh tokens |
| Password hashing | Argon2id |
| Security | Helmet, CORS, express-rate-limit |
| Middleware | cookie-parser, express.json |
| Development | tsx |
| AI integration | Groq API |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite 5 |
| Language | TypeScript |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Forms | React Hook Form |
| Validation | Zod resolvers |
| Styling | Tailwind CSS 3 |
| HTTP client | Fetch API with custom API wrapper |

### Infrastructure

| Layer | Technology |
|---|---|
| Package management | npm workspaces |
| Database | Firebase / Firestore |
| Backend hosting | Render Web Service |
| AI provider | Groq |
| Frontend development | Vite development server |
| Backend development | Express with tsx |
| Production frontend | Static Vite build served by Express |

---

## 3. Repository Structure

```text
frenchprep/
├── client/
│   ├── dist/                       # Production frontend build
│   ├── public/
│   ├── src/
│   │   ├── api/                    # API client and endpoints
│   │   ├── components/             # Shared UI components
│   │   ├── features/
│   │   │   ├── auth/               # Login, registration, auth store
│   │   │   ├── onboarding/         # User onboarding
│   │   │   ├── dashboard/          # Learner dashboard
│   │   │   ├── learning-path/      # Units and lessons
│   │   │   ├── lesson/             # Lesson player and results
│   │   │   ├── review/             # Review queue and learning reviews
│   │   │   └── ai-review-coach/    # AI-assisted review experience
│   │   ├── hooks/
│   │   ├── styles/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/
│   ├── seed-data/                  # Learning content
│   ├── dist/                       # Compiled backend
│   ├── src/
│   │   ├── config/                 # Firebase and environment config
│   │   ├── lib/                    # Shared helpers and schemas
│   │   ├── modules/
│   │   │   ├── auth/               # Authentication
│   │   │   ├── learning/            # Lessons and answer submission
│   │   │   ├── review/              # Review workflows
│   │   │   └── ai/                 # Groq-powered AI functionality
│   │   ├── scripts/                # Seed scripts
│   │   ├── app.ts                  # Express application factory
│   │   └── server.ts               # Server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── firebase/
│   ├── firestore.rules
│   └── firestore.indexes.json
│
├── docs/
├── .env.example
├── package.json
├── package-lock.json
├── PRD.md
└── README.md
```

---

## 4. Backend Architecture

### 4.1 Express Application Factory

**File:** `server/src/app.ts`

The application factory creates and configures the Express application.

Responsibilities include:

- Configuring security headers through Helmet.
- Configuring CORS and allowed frontend origins.
- Parsing JSON requests.
- Handling cookies.
- Applying request rate limits.
- Registering API routes.
- Providing a health-check endpoint.
- Handling validation and application errors.
- Serving the production React application.

The production middleware and route ordering ensures that API endpoints and health checks are registered before the frontend fallback route.

When `client/dist` exists, Express serves its static files and provides an SPA fallback for frontend routes.

### 4.2 Server Entry Point

**File:** `server/src/server.ts`

Responsibilities:

- Resolving the project root.
- Loading the root `.env` file when available.
- Supporting environment variables supplied directly by the hosting platform.
- Loading validated application configuration.
- Initializing the Express application.
- Binding the server to `0.0.0.0`.
- Using the configured port.

Render supplies production environment variables directly, so a local `.env` file is not mandatory in production.

### 4.3 Configuration

**File:** `server/src/config/env.ts`

Environment validation uses Zod.

Configuration categories include:

**Application**
- `NODE_ENV`
- `PORT`
- `CLIENT_ORIGIN`

**Authentication**
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`

**Firebase**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- Optional `FIRESTORE_EMULATOR_HOST`

**Optional services**
- Cloudinary credentials
- Demo account configuration

Groq configuration is consumed by the AI service through:

- `GROQ_API_KEY`
- `GROQ_BASE_URL`
- `GROQ_MODEL`

The default Groq base URL is:

`https://api.groq.com/openai/v1`

The default model is:

`openai/gpt-oss-20b`

Firebase private-key handling normalizes escaped newline characters where necessary.

**Note:** NVIDIA NIM is no longer part of the active AI integration.

### 4.4 Authentication

The authentication module handles account creation, login, session management, and logout.

Core responsibilities include:

- User registration and validation.
- Secure password hashing using Argon2id.
- Access-token generation and verification.
- Refresh-token handling and rotation.
- Refresh-session persistence.
- Authenticated user retrieval.
- Logout and session invalidation.

The frontend maintains authentication state using Zustand. Access-token state is persisted in session storage, while refresh-session handling uses secure cookie-based communication.

### 4.5 Learning Module

The learning module manages the learning path, lesson retrieval, lesson attempts, and exercise submissions.

Responsibilities include:

- Retrieving units and lessons.
- Retrieving learner-safe exercise content.
- Starting lesson attempts.
- Evaluating submitted answers.
- Recording answers and attempt results.
- Updating learner progress.
- Applying the relevant gamification updates.

**Transactional answer submission**

The learning repository contains transaction-oriented submission logic.

The answer-submission workflow separates planning from persistence:

1. Validate and evaluate the submitted answer.
2. Calculate the resulting progress changes.
3. Build a submission plan.
4. Persist the relevant writes through a Firestore transaction.
5. Return the submission result.

This helps keep related progress and attempt updates consistent.

### 4.6 Review Module

The review module manages exercises that require further practice.

Its responsibilities include:

- Maintaining review items.
- Retrieving pending review exercises.
- Recording review attempts.
- Tracking review status and performance.

### 4.7 AI Module

The AI integration uses **Groq**, not NVIDIA NIM.

The AI Review Coach provides AI-assisted feedback to help learners understand and improve their answers.

The backend handles communication with the configured Groq API and keeps provider credentials on the server.

The previous AI Conversation feature is not part of the current application architecture.

---

## 5. Firestore Architecture

FrenchPrep uses Google Cloud Firestore in Native mode through the Firebase Admin SDK.

The backend is responsible for all database access. The React frontend does not directly access Firestore.

### 5.1 Collection Structure

The primary data model includes:

```text
emailLookups/{emailHash}

users/{userId}
  refreshSessions/{sessionId}
  lessonProgress/{lessonId}
  lessonAttempts/{attemptId}
    answers/{exerciseId}
  reviewItems/{exerciseId}
    attempts/{reviewAttemptId}
  dailyActivity/{YYYY-MM-DD}

learningPaths/en-fr
  units/{unitId}
  lessons/{lessonId}
    exercises/{exerciseId}
    answerKeys/{exerciseId}
```

### 5.2 Data Ownership and Security

- User-specific information is scoped to the authenticated user.
- Firestore operations are performed using the Firebase Admin SDK.
- Exercise content and answer keys are stored separately.
- Learners receive exercise content without private answer-key data.
- Client-side Firestore access is denied through security rules.

### 5.3 Collection Helpers

The backend maintains centralized helpers for deterministic collection and document paths.

Important conventions:

- `LEARNING_PATH_ID = 'en-fr'`
- Stable IDs for shared learning content.
- User ownership enforced in backend operations.
- Local-date formatting uses the learner's IANA time zone.
- Generated IDs are used for appropriate user-specific records.

### 5.4 Firestore Rules

**File:** `firebase/firestore.rules`

The database follows a backend-only access model.

Direct client access is denied by default:

```javascript
allow read, write: if false;
```

The Admin SDK accesses Firestore from the trusted backend.

### 5.5 Indexes

**File:** `firebase/firestore.indexes.json`

Composite indexes support the application's review, attempt, and activity queries.

---

## 6. Frontend Architecture

### 6.1 Application Bootstrap

**File:** `client/src/main.tsx`

The application bootstrap configures:

- React 18 using `createRoot`.
- TanStack Query provider.
- React Router.
- Global styles.
- Shared application providers.

TanStack Query handles server-state caching, synchronization, and request lifecycle management.

### 6.2 Routing

**File:** `client/src/App.tsx`

The application separates public and protected routes.

**Public routes**
- `/login`
- `/register`

Authenticated users are redirected to the appropriate application page.

**Protected routes**
- `/onboarding`
- `/dashboard`
- `/learning-path`
- `/lesson/:lessonId`
- `/lesson/:lessonId/results`
- `/review`

Protected pages check authentication and onboarding state before displaying learner content.

### 6.3 API Client

**File:** `client/src/api/client.ts`

The API client provides a shared interface for backend communication.

Responsibilities include:

- Using `/api` as the API base path.
- Attaching access-token authorization headers.
- Including cookie credentials.
- Handling token refresh.
- Standardizing API errors through `ApiError`.

In production, frontend and backend are hosted on the same origin.

### 6.4 State Management

**Zustand**
- Authentication state.
- Authenticated user information.
- Access-token state.
- Onboarding state.

**TanStack Query**
- Server-owned learner information.
- Learning path and lesson data.
- Exercise and attempt data.
- Review information.
- Dashboard and progress data.

XP, hearts, progress, and other learner statistics are maintained by the backend rather than being treated as independently authoritative frontend values.

### 6.5 User Experience

The interface uses a mobile-first responsive layout with Tailwind CSS.

Core application components include:

- Navigation and user statistics.
- Login and registration forms.
- Onboarding controls.
- Dashboard statistics and progress.
- Learning path and lesson navigation.
- Interactive exercise interfaces.
- Lesson results.
- Review workflows.
- AI Review Coach interface.

---

## 7. Learning Content and Exercise Model

Shared learning content is stored separately from learner-specific progress.

The learning path uses stable IDs and is designed for repeatable seeding.

Exercise types include:

**Multiple Choice**
- Question content.
- Available options.
- Learner-selected answer.

**Fill in the Blank**
- Question content.
- Expected answer.
- Optional hint.

**Word Bank**
- Word-bank tokens.
- Exercise-specific answer arrangement.

Answer keys remain backend-only and are not exposed through learner-facing API responses.

---

## 8. Gamification and Progress Tracking

The application tracks learner activity and progression through backend-managed records.

Core concepts include:

| Feature | Purpose |
|---|---|
| XP | Measures earned learning experience |
| Hearts | Represents the learner's available attempts/health |
| Daily goal | Sets the learner's target XP |
| Daily activity | Tracks learning activity by local date |
| Streak | Tracks consecutive active learning days |
| Lesson progress | Records completion and learning state |
| Review items | Tracks exercises that need further practice |

Daily activity is associated with the learner's configured time zone so that progress and streak calculations use the correct local date.

The backend remains the authoritative source for these statistics.

---

## 9. API Architecture

The backend exposes REST API endpoints under `/api`.

The implemented API areas cover:

| Area | Responsibility |
|---|---|
| Health | Service availability |
| Authentication | Registration, login, refresh, logout, current user |
| Onboarding | Learner preferences and daily goals |
| Learning | Learning path, lessons, attempts, answers, progress |
| Review | Review queues and review submissions |
| AI | AI-assisted review functionality |

Health check:

`GET /health`

The API uses Zod validation and centralized error handling to maintain consistent request and response behavior.

---

## 10. Environment Variables

The complete configuration template is maintained in `.env.example`.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime environment |
| `PORT` | Backend listening port |
| `CLIENT_ORIGIN` | Allowed frontend origin |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret |
| `ACCESS_TOKEN_TTL` | Access-token expiration |
| `REFRESH_TOKEN_TTL` | Refresh-token expiration |
| `FIREBASE_PROJECT_ID` | Firebase project identifier |
| `FIREBASE_CLIENT_EMAIL` | Firebase service-account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service-account private key |
| `FIRESTORE_EMULATOR_HOST` | Optional Firestore emulator |
| `GROQ_API_KEY` | Groq API credential |
| `GROQ_BASE_URL` | Groq API base URL |
| `GROQ_MODEL` | AI model identifier |
| `CLOUDINARY_CLOUD_NAME` | Optional Cloudinary configuration |
| `CLOUDINARY_API_KEY` | Optional Cloudinary configuration |
| `CLOUDINARY_API_SECRET` | Optional Cloudinary configuration |
| `DEMO_USER_EMAIL` | Optional demo account email |
| `DEMO_USER_PASSWORD` | Optional demo account password |

Production credentials must be configured through the hosting provider's environment-variable settings rather than committed to Git.

---

## 11. Development and Deployment

### Local Development

The project uses npm workspaces.

The Vite frontend runs on port `5173`, and the Express backend runs on port `3000`.

Vite proxies API requests to the backend during development.

### Production Architecture

```text
                  Browser
                     |
                     v
             Render Web Service
                     |
              Express Server
                     |
          +----------+----------+
          |                     |
          v                     v
     /api/* routes          React static build
          |                     |
          v                     v
    Backend services       client/dist
          |
     +----+----------+
     |               |
     v               v
  Firestore        Groq API
```

Express serves the React production build and handles API requests from the same origin.

This avoids requiring a separate frontend deployment and keeps authentication cookies first-party.

### Render Configuration

**Root Directory:** Repository root

**Build Command:**

```bash
npm ci && npm run build
```

**Start Command:**

```bash
npm run start
```

**Production environment:**

- `NODE_ENV=production`
- Configure Firebase credentials.
- Configure JWT secrets.
- Configure the Groq API key.
- Set `CLIENT_ORIGIN` to the deployed service origin.
- Use the port supplied by Render.

The deployment build should generate `client/dist` and compile the backend before the server starts.

---

## 12. Project Commands

| Command | Description |
|---|---|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run dev:client` | Start Vite frontend |
| `npm run dev:server` | Start Express backend with hot reload |
| `npm run build` | Build frontend and backend |
| `npm run start` | Start the production backend |
| `npm run test` | Run workspace tests |
| `npm run seed` | Seed shared Firestore learning content |
| `npm run emulators` | Start Firebase Emulator Suite |

---

## 13. Architectural Decisions

| Decision | Rationale |
|---|---|
| Express over Fastify | Maintains the required Express architecture and middleware ecosystem |
| Firebase Admin SDK | Centralizes database access in the trusted backend |
| Firestore security rules deny client access | Prevents direct unauthorized data access |
| Separate exercises and answer keys | Prevents accidental answer exposure |
| Zod validation | Provides runtime validation and type-safe schemas |
| TanStack Query | Manages server state, caching, and synchronization |
| Zustand | Keeps lightweight client-side authentication state |
| Session storage | Avoids persistent browser local-storage access-token storage |
| Firestore transactions | Keeps related lesson-attempt and progress writes consistent |
| Deterministic content IDs | Enables repeatable and idempotent content seeding |
| IANA time zones | Supports accurate daily activity and streak calculation |
| Groq API | Powers the AI Review Coach |
| Single Render service | Serves frontend and backend from one production origin |

---

## 14. Current Implementation Status

| Area | Status |
|---|---|
| React and Express foundation | Implemented |
| Firebase Admin integration | Implemented |
| Authentication workflows | Implemented |
| Protected frontend routes | Implemented |
| Onboarding | Implemented |
| Learning path and lessons | Implemented |
| Exercise submission | Implemented |
| Transactional learning progress updates | Implemented |
| XP and progress tracking | Implemented |
| Hearts and streak functionality | Implemented; verify dashboard consistency |
| Review workflows | Implemented |
| Groq-powered AI Review Coach | Implemented |
| Production frontend serving through Express | Implemented |
| Render deployment | Implemented |

### Items Requiring Verification

1. Verify dashboard streak values against backend daily activity records.
2. Verify that today's XP progress reflects all XP earned during the day.
3. Complete a clean dependency installation and production build.
4. Verify the deployed application, Firebase connectivity, authentication cookies, and AI Review Coach.

---

## 15. Security Principles

- Never expose Firebase Admin credentials to the frontend.
- Never expose JWT signing secrets or Groq API keys.
- Keep answer keys private and backend-only.
- Validate incoming request data using Zod.
- Hash passwords using Argon2id.
- Validate access tokens on protected API routes.
- Use refresh-session management for authentication continuity.
- Restrict Firestore client access through security rules.
- Configure CORS and security headers appropriately.
- Keep production secrets outside version control.

**End of Architecture Document**