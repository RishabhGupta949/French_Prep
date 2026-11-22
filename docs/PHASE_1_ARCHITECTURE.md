# Phase 1 Architecture — Foundation

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.x (TypeScript)
- **Database**: Google Cloud Firestore (Native mode) via Firebase Admin SDK
- **Validation**: Zod
- **Security**: Helmet, CORS, express-rate-limit, cookie-parser
- **Password Hashing**: Argon2id
- **Development**: tsx for hot reload, TypeScript 5.x

### Frontend
- **Framework**: React 18 + Vite 5 + TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query) v5, Zustand
- **Forms**: React Hook Form + Zod resolvers
- **Styling**: Tailwind CSS 3.x
- **HTTP Client**: Fetch API with custom wrapper

### Infrastructure
- **Package Manager**: npm workspaces (root, client, server)
- **Firebase**: Admin SDK for server-side Firestore access
- **Deployment Target**: Render Web Service (serves both Express API and built React app)
- **Local Development**: Vite dev server (port 5173) + Express (port 3000) with Vite proxy

---

## Folder Structure

```
frenchprep/
├── client/                    # React frontend
│   ├── dist/                  # Production build output (served by Express)
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── api/               # API client & endpoints
│   │   ├── components/        # Shared UI components
│   │   ├── features/          # Feature-based modules
│   │   │   ├── auth/          # Login, Register, authStore
│   │   │   ├── onboarding/    # Onboarding flow
│   │   │   ├── dashboard/     # Dashboard page
│   │   │   ├── learning-path/ # Learning path page
│   │   │   ├── lesson/        # Lesson player & results
│   │   │   ├── review/        # Review queue
│   │   │   └── ai-tutor/      # AI conversation
│   │   ├── hooks/             # Custom React hooks
│   │   ├── styles/            # Global styles (Tailwind)
│   │   ├── App.tsx            # Root component with routing
│   │   └── main.tsx           # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/                      # Architecture documentation
├── firebase/
│   ├── firestore.rules        # Security rules (deny all client access)
│   └── firestore.indexes.json # Composite indexes
├── server/                    # Express backend
│   ├── seed-data/             # JSON lesson content
│   ├── dist/                  # Compiled output
│   ├── src/
│   │   ├── config/            # Firebase Admin, env validation
│   │   ├── lib/               # Collections helpers, Zod schemas
│   │   ├── scripts/           # Seed script
│   │   ├── app.ts             # Express app factory
│   │   └── server.ts          # Entry point
│   ├── package.json
│   └── tsconfig.json
├── .env.example               # Environment variable template
├── package.json               # Root workspace config
├── PRD.md                     # Product Requirements Document
└── README.md                  # Project documentation
```

---

## Backend Architecture

### Express App Factory (`src/app.ts`)
- Creates and configures Express application
- Middleware stack (in order):
  1. Helmet (security headers, CSP disabled for dev)
  2. CORS (configured origin, credentials enabled)
  3. `express.json()` with 10kb limit
  4. `cookie-parser` with JWT access secret
  5. Rate limiting (100 req/min, standard headers)
- Global error handler using Zod for validation errors
- Health check endpoint: `GET /health`

### Server Entry Point (`src/server.ts`)
- Loads validated environment config
- Starts Express server on configured port/host
- Logs startup message

### Configuration (`src/config/`)
- **env.ts**: Zod-validated environment schema with:
  - Server: NODE_ENV, PORT, CLIENT_ORIGIN
  - JWT: ACCESS/REFRESH secrets, TTLs
  - Firebase: PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY (with `\\n` normalization)
  - Firestore Emulator: optional FIRESTORE_EMULATOR_HOST
  - NVIDIA NIM: API_KEY, BASE_URL, MODEL
  - Cloudinary: optional credentials
  - Demo user: DEMO_USER_EMAIL, DEMO_USER_PASSWORD
- **firebase.ts**: Initializes Firebase Admin SDK once, configures emulator if set

### Firestore Collections & Helpers (`src/lib/collections.ts`)
Deterministic collection/document paths with ownership scoping:

```
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
    exercises/{exerciseId}      # learner-safe
    answerKeys/{exerciseId}     # private
```

Helper functions for every collection/document path, plus:
- `LEARNING_PATH_ID = 'en-fr'`
- `formatLocalDate(date, timeZone)` for YYYY-MM-DD in user's IANA zone
- `generateId()` for deterministic IDs

### Zod Schemas (`src/lib/schemas.ts`)
Complete type-safe schemas for all Firestore documents:
- **Content**: ExerciseType, LessonStatus, AttemptStatus, ReviewStatus, Role, DailyGoal
- **Exercises**: Option, WordBankToken, ExerciseContent (discriminated union), Exercise, AnswerKey (discriminated union)
- **Learning Path**: LessonMetadata, Unit, LearningPath
- **User**: User, RefreshSession, LessonProgress, LessonAttempt, Answer, ReviewItem, ReviewAttempt, DailyActivity
- **API Inputs**: RegisterInput, LoginInput, OnboardingInput, AnswerInput (discriminated), StartLessonInput, AIChatInput

---

## Frontend Architecture

### App Bootstrap (`src/main.tsx`)
- React 18 `createRoot`
- TanStack Query Provider (staleTime: 5min, retry: 1)
- React Router `BrowserRouter`
- Global styles import

### Routing (`src/App.tsx`)
- **Public routes**: `/login`, `/register` (redirect to dashboard if authenticated)
- **Protected routes**: All others (redirect to login if unauthenticated, onboarding if not onboarded)
- Layout wrapper with navigation header showing XP, hearts, streak
- Route structure:
  - `/onboarding` → OnboardingPage
  - `/dashboard` → DashboardPage
  - `/learning-path` → LearningPathPage
  - `/lesson/:lessonId` → LessonPage
  - `/lesson/:lessonId/results` → LessonResultsPage
  - `/review` → ReviewPage

### API Client (`src/api/client.ts`)
- Base path: `/api`
- Automatic Authorization header from Zustand auth store
- Cookie credentials included
- `refreshAccessToken()` helper for token rotation
- `ApiError` class with status/code/message

### Auth Store (`src/features/auth/authStore.ts`)
- Zustand with sessionStorage persistence
- State: user, accessToken, isAuthenticated, isOnboarded
- Actions: setAuth, updateUser, logout

### UI Components
- **Layout**: Header with nav, user stats (XP, hearts, streak), logout button
- **Forms**: React Hook Form + Zod validation, accessible labels, error states
- **Responsive**: Mobile-first Tailwind, breakpoint at `md:` (768px)

### Pages Implemented
1. **LoginPage**: Email/password, validation, error display, link to register
2. **RegisterPage**: Name, email, password, confirm, validation, link to login
3. **OnboardingPage**: 
   - Fixed French target language
   - Daily goal selector (10/20/30/50 XP) as radio cards
   - Time zone dropdown (common IANA zones) with auto-detection
4. **DashboardPage**: Stat cards (XP, hearts, streak, daily goal), progress bar, action links
5. **LearningPathPage**: Unit/lesson list with lock/complete states, mock data
6. **LessonPage**: Placeholder for lesson player
7. **LessonResultsPage**: Placeholder for results screen
8. **ReviewPage**: Empty state placeholder
9. **AIChatPage**: Chat UI with message history, input, loading state

---

## Firebase & Firestore Integration

### Security Rules (`firebase/firestore.rules`)
- Default deny all: `allow read, write: if false;`
- All collections explicitly denied for direct client access
- Backend uses Admin SDK (bypasses rules)

### Indexes (`firebase/firestore.indexes.json`)
Composite indexes for:
- `reviewItems`: status ASC, lastWrongAt DESC
- `lessonAttempts`: status ASC, startedAt DESC
- `dailyActivity`: localDate DESC

### Seed Data (`server/seed-data/`)
JSON files with stable IDs for idempotent seeding:
- `learning-path.json`: path metadata (en→fr)
- `units.json`: 1 unit (Getting Started)
- `lessons.json`: 3 lessons with sequence, previousLessonId
- `exercises-lesson-{1,2,3}.json`: 6 exercises each (2 per type)
- `answer-keys-lesson-{1,2,3}.json`: Private answer keys matching exercises

Exercise types covered:
- **MULTIPLE_CHOICE**: options array with id/text
- **FILL_BLANK**: optional hint
- **WORD_BANK**: wordBank array with id/text tokens

### Seed Script (`src/scripts/seed.ts`)
- Validates JSON with Zod schemas before write
- Batched writes (Firestore 500 writes/batch limit)
- Merge/upsert to preserve learner progress
- Only seeds shared content (learning path, units, lessons, exercises, answer keys)
- Verification step: confirms path, units, lessons, exercise counts
- Run via: `npm run seed` (requires valid Firebase config)

---

## API Endpoints (Implemented in Phase 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

*Note: Auth, learning, review, and AI endpoints are Phase 2+*

---

## Environment Variables

See `.env.example` for complete list. Key variables:

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | development/production/test |
| `PORT` | Express port (default 3000) |
| `CLIENT_ORIGIN` | CORS origin (default http://localhost:5173) |
| `JWT_ACCESS_SECRET` | Min 32 chars, signs access tokens |
| `JWT_REFRESH_SECRET` | Min 32 chars, signs refresh tokens |
| `FIREBASE_PROJECT_ID` | GCP project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account key (with literal newlines) |
| `NVIDIA_NIM_API_KEY` | NIM API key (server-only) |
| `NVIDIA_NIM_BASE_URL` | Default: https://integrate.api.nvidia.com/v1 |
| `NVIDIA_NIM_MODEL` | Default: meta/llama-3.1-70b-instruct |

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client (Vite) + server (tsx watch) concurrently |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express with hot reload only |
| `npm run build` | Build client (tsc + vite) + server (tsc) |
| `npm run start` | Run production server (serves client/dist + /api) |
| `npm run test` | Run tests (both workspaces) |
| `npm run seed` | Run idempotent Firestore seed script |
| `npm run emulators` | Start Firebase Emulator Suite |

---

## Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Express over Fastify** | Mandatory per PRD; explicit middleware chain, broad ecosystem |
| **Firebase Admin SDK only** | Server-only Firestore access; no client SDK in React; security rules deny all |
| **Deterministic document IDs** | Enables idempotent seeds, duplicate detection, no client-provided paths |
| **Separate exercise/answer-key collections** | Prevents accidental answer exposure; backend-only access to keys |
| **Zod for validation + schemas** | Single source of truth for types & runtime validation |
| **TanStack Query for server state** | Caching, deduplication, stale-while-revalidate; no client-owned XP/hearts |
| **Zustand + sessionStorage for auth** | Lightweight, survives refresh, no localStorage tokens |
| **Vite proxy in dev** | Same-origin /api in dev; avoids CORS complexity |
| **Single Render service** | Express serves React build + API; refresh cookie stays first-party |
| **IANA time zones for streaks** | User's local date for daily activity; handles DST correctly |

---

## Known Limitations (Phase 1)

1. **No authentication endpoints yet** — Phase 2 will implement register, login, refresh, logout, /me
2. **No learning engine endpoints** — Phase 3 will implement learning path, lessons, exercises, answers
3. **No gamification logic** — Phase 4 will implement XP, hearts, streaks, review queue
4. **No AI integration** — Phase 5 will implement NVIDIA NIM conversation partner
5. **Mock data in frontend** — LearningPathPage uses hardcoded mock; will connect to API in Phase 3
6. **Firebase not configured** — Requires manual Firebase project setup, service account, Firestore database creation
6. **No tests yet** — Phase 4+ will add Vitest + Firebase Emulator integration tests
7. **Seed script untested** — Requires valid Firebase credentials to run