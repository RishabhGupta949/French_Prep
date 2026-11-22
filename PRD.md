# Product Requirements Document (PRD)
## FrenchPrep — Gamified English-to-French Learning Web App

**Prepared for:** Software Engineering Intern Assignment  
**Date:** 20 November 2026  
**Implementation agent:** OpenCode  
**Delivery target:** Working, deployed web application within the assignment's 48-hour window; prioritize completing the core product in the first 24 hours.

---

## 1. Product summary

Build a responsive, browser-based language-learning application for English speakers learning French. Lessons should be short and interactive, with a learning path, immediate answer feedback, progress tracking and lightweight gamification.

The product must satisfy every **Must-have** item in the assignment. The implementation should demonstrate sound backend engineering: secure authentication, server-side authorization and answer evaluation, well-defined data models, transactional progress updates, time-zone-aware activity tracking, and a clear frontend/backend boundary.

### Product decisions already made

| Area | Decision |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | Google Firebase Cloud Firestore (Native mode) |
| Data access | Firebase Admin SDK, server-side only; no Prisma or SQL ORM |
| Media storage | Cloudinary only if lesson imagery or uploaded media is actually needed; not required for the initial text-based lessons |
| API style | REST API under `/api` |
| Authentication | Short-lived JWT access token + rotating JWT refresh token; refresh-session hashes stored in Firestore |
| AI provider | NVIDIA NIM |
| AI feature | French conversation partner for English-speaking beginners |
| Learning pair | English → French |
| Exercise types | Multiple-choice translation, fill in the blank, build a sentence from a word bank |
| Styling | Tailwind CSS; responsive, mobile-first layout |
| Routing | React Router |
| Deployment | Render hosts the web application; preferably one Render Web Service serves the built React app and Express API from the same origin |

Do not change these choices without a concrete technical blocker. Explain any necessary deviation in the README's Architecture Decisions section.

---

## 2. Scope and priorities

### 2.1 Must build

1. Registration, login, logout, session refresh and protected routes.
2. Onboarding to choose French as the target language and a daily XP goal.
3. A learning path containing units, lessons and exercises.
4. Sequential lesson unlocking, enforced by the backend.
5. Exactly these three exercise types:
   - Multiple-choice translation
   - Fill in the blank
   - Build a sentence from a word bank
6. Instant feedback after each answer, including whether it was correct and an explanation/correct answer when appropriate.
7. Lesson progress bar and lesson results screen showing XP earned and accuracy.
8. Total XP, daily XP goal, time-zone-aware daily streak and hearts.
9. A review queue containing incorrectly answered exercises.
10. Lesson content stored as data in Cloud Firestore, populated idempotently from JSON seed files; do not hard-code lesson content in React components.
11. Responsive user experience that works well in a phone browser.
12. A useful French AI conversation partner using NVIDIA NIM.
13. README, seed script, basic tests, deployment configuration and the assignment's AI chat-history folder.

### 2.2 Explicitly out of scope

Do not build these in the initial version:

- Spaced repetition scheduling
- Weekly leaderboard
- Speaking or speech-recognition exercises
- Admin panel or lesson-authoring UI
- Additional language pairs
- Native Android/iOS applications
- Payments, subscriptions or social features
- Microservices, Redis, message queues or other infrastructure that is not needed for this assignment

Keep the data model extensible enough to support future additions, but do not implement stretch features now. **Do not spend time on optional features before all must-have acceptance criteria pass.**

---

## 3. Target user and core user journeys

### Target user

An English-speaking beginner who wants to learn practical French through short exercises and guided conversation.

### Primary journey: learn a lesson

1. User registers or logs in.
2. On first login, user completes onboarding: selects French, chooses a daily XP goal, and the app records the user's IANA time zone.
3. User lands on the dashboard and sees XP, daily goal progress, streak, hearts and the learning path.
4. User opens the first unlocked lesson.
5. User answers one exercise at a time and receives immediate feedback.
6. The app updates the lesson progress indicator after each answer.
7. Once all exercises have been attempted, the user sees a results screen with accuracy and XP earned.
8. Completing a lesson unlocks the next lesson.
9. Any incorrectly answered exercise is added to the user's review queue.

### Secondary journey: practise a mistake

1. User opens Review.
2. User selects a pending exercise.
3. User answers it using its original exercise type.
4. Correct review answers resolve the queue item; incorrect answers leave it pending.
5. Review practice must not be a way to repeatedly farm lesson-completion XP.

### Secondary journey: practise French with AI

1. Authenticated user opens the AI conversation partner.
2. User sends a short message in French or English.
3. The AI responds at beginner level, keeps the conversation focused on learning French, and gently corrects mistakes.
4. When useful, the AI explains a correction in simple English and gives a short example.

---

## 4. Architecture

### 4.1 High-level architecture

Use a modular monolith with a separately developed React frontend and Express REST API. Deploy both through Render. For the initial assignment, prefer one Render Web Service: Express serves the built Vite files and the `/api` routes from the same origin. This simplifies deployment and keeps the refresh cookie first-party.

```text
Browser
  React + Vite + TypeScript
  React Router | TanStack Query | Tailwind CSS
             |
             | HTTPS / REST / JSON (/api)
             v
Render Web Service
  Node.js + Express + TypeScript
  ├── Authentication and session module
  ├── User and onboarding module
  ├── Learning path and lesson module
  ├── Exercise evaluation module
  ├── Progress, XP, hearts and streak module
  ├── Review queue module
  └── AI conversation module
             |
             ├──────── Firebase Admin SDK ──────── Cloud Firestore
             |
             ├──────── NVIDIA NIM API (server-side only)
             |
             └──────── Cloudinary (optional media only; not needed for MVP)
```

The browser communicates only with the Express API for application data. Do not initialize the Firebase client SDK in the React app for this assignment. The Express server uses Firebase Admin SDK with a service account to read and write Firestore. This gives us one place to enforce authentication, ownership checks, lesson unlocking, answer evaluation and XP/heart rules.

### 4.2 Why this architecture

- **React + Vite:** The product is an interactive application with exercise state, instant feedback and protected user journeys. React's component model supports reusable exercise and progress UI; Vite keeps the development/build workflow lightweight. SEO-oriented server rendering is not a core requirement for this authenticated learning experience.
- **Separate Express API:** It makes the frontend/backend boundary explicit and lets the reviewer inspect authentication middleware, authorization, API contracts and business logic directly.
- **TypeScript:** Use it on both client and server to catch type errors early and make API/data contracts easier to understand and maintain.
- **Cloud Firestore:** The assignment has a relatively small, document-shaped data model: user profiles, lesson content, progress, attempts, sessions and daily activity. Firestore removes the need to manage a SQL server, provides managed document storage and supports atomic transactions for the multi-document updates used by learning and gamification. Its trade-off is that it has no relational joins or SQL foreign-key constraints, so collection design, indexes, document ownership and transactional validation must be deliberate.
- **Firebase Admin SDK on the backend:** All reads and writes pass through trusted server code. The Admin SDK also avoids exposing database credentials or answer keys to the browser. Firestore Security Rules should deny direct client reads and writes while this server-only access model is used; the Admin SDK operates with privileged server credentials.
- **No Prisma:** Prisma is a relational ORM and does not provide the data model or query semantics we need for native Firestore. Use the official Firebase Admin SDK with typed repository/service functions instead of adding an abstraction that does not fit the database.
- **REST:** The frontend needs straightforward resource-oriented operations; REST is sufficient and avoids unnecessary protocol complexity.
- **Modular monolith:** One deployable backend is easier to finish, test and operate within the deadline than microservices. Modules and service boundaries keep it maintainable and allow later extraction if actual scale requires it.
- **No Redis, queues or Firebase Storage initially:** Firestore is the persistent data store, and the required lesson content is text-based. Cloudinary can handle image/media assets if they become necessary. Do not add infrastructure that does not support a must-have feature.

### 4.3 Firestore access and security model

- The Express backend is the only application component that accesses Firestore.
- Initialize Firebase Admin once at server startup using service-account credentials from Render environment variables. Never commit a service-account JSON file.
- Add Firestore Security Rules that deny all direct client access. Admin SDK calls from the trusted backend bypass these rules, so the service account must remain private and server-only.
- Validate request data with Zod before writing it. Never accept arbitrary collection paths, document paths, owner IDs or Firestore query filters from the client.
- Build document references from authenticated server-side identity and validated route parameters.
- Keep lesson answer keys in a separate server-only collection from learner-facing exercise data.
- Use deterministic document IDs for records that must be unique, such as a user's progress for a lesson, daily activity for a local date, and review item for an exercise.
- Use Firestore transactions for updates that must remain consistent across documents. Use batched writes for seed data and other write-only batches.
- Add `firestore.indexes.json` for composite queries required by the app. Avoid unbounded collection reads; order and paginate larger result sets.

### 4.4 Suggested repository structure

```text
language-prep/
├── client/
│   └── src/
│       ├── api/                 # API client and endpoint functions
│       ├── app/                 # App bootstrap, providers, router
│       ├── components/          # Shared UI components
│       ├── features/
│       │   ├── auth/
│       │   ├── onboarding/
│       │   ├── dashboard/
│       │   ├── learning-path/
│       │   ├── lesson/
│       │   ├── review/
│       │   └── ai-tutor/
│       ├── hooks/
│       ├── types/
│       └── styles/
├── server/
│   ├── seed-data/               # JSON lesson/unit content
│   └── src/
│       ├── config/              # Firebase Admin, env validation
│       ├── middleware/
│       ├── modules/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── learning/
│       │   ├── exercises/
│       │   ├── progress/
│       │   ├── review/
│       │   └── ai/
│       ├── repositories/        # Firestore document access
│       ├── scripts/             # Idempotent content seed script
│       ├── lib/
│       ├── app.ts
│       └── server.ts
├── firebase/
│   ├── firestore.rules
│   └── firestore.indexes.json
├── ai-chat-history/             # Complete, unedited AI conversation exports
├── .env.example
├── package.json
├── README.md
└── PRD.md
```

The exact internal filenames may be adjusted to fit the implementation, but retain clear module boundaries. Do not put all routes and business logic in one file.

### 4.5 Frontend server-state approach

Use TanStack Query for API-backed state such as the dashboard, learning path and review queue. Keep transient exercise interaction state inside the relevant React feature. Keep the access token in memory, not localStorage. Avoid duplicating server-owned XP, hearts or progress as independent client truth.

### 4.6 Deployment approach

Build the React app with Vite and have Express serve `client/dist` while also serving `/api`. Deploy that Node service on Render. This provides one origin for the frontend, API and refresh cookie while still keeping the codebase and modules separated. Configure Render environment variables for Firebase service-account credentials, JWT secrets and NVIDIA NIM. Firestore remains hosted by Google Firebase, not Render.

Create the Firestore database in Native mode and choose its location deliberately, preferably near the Render service region and intended users. Consider region and latency before creating the database; do not treat database location as a setting to casually change later.

For local development, run Vite and Express separately and configure the Vite development proxy so `/api` requests reach Express. Do not use wildcard CORS with credentials. If a later deployment separates frontend and backend into different origins, configure exact allowed origins, secure cookie settings and appropriate CSRF protections rather than weakening authentication settings.

### 4.7 Cloudinary media policy

The three required exercise types are text-based, so media storage is not needed to satisfy the initial scope. Do not add image upload flows or Cloudinary integration merely for decoration. If the content later requires lesson illustrations or other media, store the files in Cloudinary and save only their stable delivery URLs and relevant metadata in Firestore. Keep Cloudinary secrets server-side and use signed uploads or server-mediated uploads when uploads are introduced. Do not store binary image data in Firestore documents.

## 5. Authentication and authorization

### 5.1 Required auth flows

Implement:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Registration accepts name (or display name), email and password. Normalize email before saving and enforce a unique Firestore application-level invariant. Hash passwords with Argon2id (or bcrypt if there is a documented compatibility issue); never store plaintext passwords.

### 5.2 Token strategy

- Access JWT: approximately 15-minute expiry; return it to the client and keep it in memory.
- Refresh JWT: approximately 7-day expiry; store it in an `HttpOnly`, `Secure` cookie in production. Use `SameSite=Lax` for the recommended same-origin deployment.
- Use separate access and refresh signing secrets.
- Rotate the refresh token every time `/refresh` succeeds.
- Store only a cryptographic hash of each refresh token in the user's Firestore refresh-session document, along with session metadata and expiry.
- Detect a refresh-token hash mismatch/reuse and revoke the affected session. A single session document represents the current token state for that device/session.
- Clear the refresh cookie on logout and revoke its Firestore session document.
- Do not store access or refresh tokens in localStorage or sessionStorage.

### 5.3 Authorization rules

- All learning, progress, review and AI routes require an authenticated user.
- Derive `userId` from the verified access token. Never trust a `userId` supplied by the browser for ownership-sensitive operations.
- Every user-specific database query must scope by the authenticated user, including lesson progress, attempts, review items and profile data.
- A user must not be able to read or mutate another user's resources by changing an ID in a URL or request body.
- Include a `role` field with at least `LEARNER` and `ADMIN` values if convenient for future extension. Public registration must always create `LEARNER`. Do not build admin routes or an admin panel in this assignment.
- Enforce lesson unlocking and heart availability in backend services, not only by hiding buttons in the UI.

### 5.4 Validation and security middleware

Use Zod (or an equivalent TypeScript schema validator) for request validation. Add Helmet, safe error handling, request-size limits, authentication middleware and rate limits for login/register and AI calls. Do not return stack traces, secrets, token hashes or internal database errors to the client. Do not log passwords, cookies, bearer tokens or the NVIDIA API key.

---

## 6. Firestore data model

Use Cloud Firestore in Native mode through the Firebase Admin SDK. Firestore is document-oriented, so do not try to recreate SQL tables and joins. Use clear collection paths, stable document IDs, small documents, deliberate denormalization and transactions for invariants.

### 6.1 Collection layout

Use the following logical layout. Field names may be adapted, but preserve the ownership boundaries and deterministic IDs.

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

learningPaths/{pathId}                         # pathId: en-fr
  units/{unitId}
  lessons/{lessonId}
    exercises/{exerciseId}                     # learner-safe prompt/options/word bank
    answerKeys/{exerciseId}                    # private correct-answer data
```

### 6.2 `emailLookups/{emailHash}`

Firestore does not provide SQL-style unique constraints. Enforce unique registration using a deterministic lookup document:

- Document ID: SHA-256 hash of the normalized, lowercase email address.
- Fields: `userId`, `createdAt`.
- During registration, read this document and create it together with the user document in one Firestore transaction. If it already exists, reject the registration with an email-already-used response.
- Never use a client-provided document path. Compute the hash on the server.

This prevents duplicate email registrations without storing the raw email in a lookup document ID.

### 6.3 `users/{userId}`

One document per learner:

- `name`
- `email` (normalized, unique through `emailLookups`)
- `passwordHash`
- `role` (`LEARNER` or `ADMIN`; public signup only creates `LEARNER`)
- `targetLanguage` (initially `fr`)
- `dailyGoalXp` (one of 10, 20, 30 or 50)
- `timeZone` (IANA identifier, e.g. `Asia/Kolkata`)
- `xpTotal` (integer, default 0)
- `hearts` (integer, initial/max 5)
- `nextHeartAt` (Firestore Timestamp or null)
- `onboardingCompletedAt` (Firestore Timestamp or null)
- `createdAt`, `updatedAt` (Firestore Timestamps)

Do not store full lesson histories or arrays of attempts in this document. Keep it small and update it only for profile and aggregate fields.

### 6.4 `users/{userId}/refreshSessions/{sessionId}`

One document per login/device session:

- `tokenHash` (hash of the current refresh JWT; never store the raw token)
- `expiresAt`
- `revokedAt` (nullable)
- `createdAt`, `updatedAt`
- Optional device/session metadata that does not contain secrets

On refresh, use a Firestore transaction to read the session, compare the presented token hash, and replace the hash with the newly issued refresh token hash. A mismatch indicates a stale/reused token; revoke the session. On logout, set `revokedAt`. The session document ID is the `sid` claim in the refresh JWT.

### 6.5 Learning content collections

**`learningPaths/{pathId}`** — path metadata:

- `sourceLanguage` (`en`)
- `targetLanguage` (`fr`)
- `title`, `description`
- `createdAt`, `updatedAt`

**`learningPaths/{pathId}/units/{unitId}`** — unit metadata:

- `title`, `description`
- `order` (integer)

**`learningPaths/{pathId}/lessons/{lessonId}`** — lesson metadata:

- `unitId`
- `title`, `description`
- `order` (integer within unit)
- `sequence` (unique integer across the entire path, used for sequential progression)
- `previousLessonId` (null for the first lesson)
- `estimatedMinutes`
- `exerciseCount`

**`learningPaths/{pathId}/lessons/{lessonId}/exercises/{exerciseId}`** — learner-safe exercise data:

- `order`
- `type` (`MULTIPLE_CHOICE`, `FILL_BLANK`, `WORD_BANK`)
- `prompt`
- `content` (JSON fields required to render the exercise, such as options, hint or word bank)
- `explanation` (safe to return after the learner submits an answer)

**`learningPaths/{pathId}/lessons/{lessonId}/answerKeys/{exerciseId}`** — private answer data:

- `correctOptionId`, or
- `acceptedAnswers`, or
- `correctTokenIds`

Only backend evaluator services may read answer-key documents. Never include these fields in lesson API responses. Keep content and answer keys in separate documents to reduce accidental exposure.

### 6.6 `users/{userId}/lessonProgress/{lessonId}`

Use the lesson ID as the document ID so the user's progress for a lesson is unique by construction:

- `status` (`IN_PROGRESS` or `COMPLETED`; locked/unlocked is derived from content order and prerequisite completion)
- `startedAt` (nullable)
- `completedAt` (nullable)
- `firstCompletedAt` (nullable)
- `bestAccuracy` (nullable)
- `xpAwarded` (integer, default 0)
- `updatedAt`

Derive locked/unlocked status in the learning-path service. A lesson is unlocked when it has no `previousLessonId` or the previous lesson has a completed progress document. The start and answer endpoints must re-check this rule on the server.

### 6.7 `users/{userId}/lessonAttempts/{attemptId}` and `answers/{exerciseId}`

Lesson attempt document:

- `lessonId`
- `status` (`IN_PROGRESS`, `COMPLETED`)
- `correctCount`, `answeredCount`, `totalExercises`
- `accuracy` (nullable until completion)
- `xpAwarded` (default 0)
- `startedAt`, `completedAt` (nullable)

Each submitted answer is a subcollection document with the exercise ID as its document ID:

- `submittedAnswer` (validated JSON)
- `isCorrect`
- `createdAt`

Using `answers/{exerciseId}` makes duplicate submissions detectable with a direct document read and prevents the same exercise from being counted twice in one attempt.

### 6.8 `users/{userId}/dailyActivity/{YYYY-MM-DD}`

Document ID is the local calendar date calculated in the user's saved IANA time zone, formatted `YYYY-MM-DD`:

- `localDate`
- `xpEarned`
- `lessonsCompleted` (lesson attempts completed, including replays)
- `reviewItemsResolved` (correctly resolved review items)
- `updatedAt`

Use one document per user per local date. The daily goal reads today's `xpEarned`; the streak reads consecutive dates with meaningful activity. Do not use the Render server's timezone or treat a local day as a fixed 24-hour UTC interval.

### 6.9 `users/{userId}/reviewItems/{exerciseId}` and `attempts/{reviewAttemptId}`

One review item per user/exercise; use the exercise ID as the document ID:

- `lessonId`
- `status` (`PENDING`, `RESOLVED`)
- `wrongCount`
- `lastWrongAt`
- `resolvedAt` (nullable)
- `createdAt`, `updatedAt`

Each review attempt is stored in the item's `attempts` subcollection:

- `submittedAnswer` (validated JSON)
- `isCorrect`
- `createdAt`

A wrong lesson answer creates or updates this deterministic review document. A correct review answer resolves it. If the exercise is missed again in a later lesson replay, reopen it.

### 6.10 Relationships, references and integrity

- A learning path contains units and lessons; each lesson contains exercises and a separate answer-key document per exercise.
- User-owned documents are always under `users/{authenticatedUserId}/...`.
- Validate that `unitId`, `lessonId` and `exerciseId` references exist and belong to the expected learning path before writing progress or attempts.
- Firestore does not enforce foreign keys. Enforce ownership and reference integrity in backend services and seed validation.
- Avoid deleting shared lesson content when a user account is removed. Any account-deletion behaviour must target only that user's documents.
- Do not store large or unbounded arrays in a document. Keep attempts, answers and activity in subcollections to avoid document-size growth.

### 6.11 Indexes and query design

- Add `firestore/indexes.json` (or the Firebase CLI's configured `firestore.indexes` path) for required composite indexes, for example review items filtered by `status` and ordered by `lastWrongAt`.
- Keep learning-path queries scoped to `learningPaths/en-fr` and ordered by `sequence` or `order`.
- Query a user's subcollections through their authenticated user document; do not scan all users.
- Paginate review/attempt history if it grows. The initial three-lesson dataset may be small, but avoid APIs that depend on unbounded reads.
- Use Firestore Timestamps for instants and `YYYY-MM-DD` string document IDs for local calendar dates.

## 7. Lesson content and seed data

Store initial content as JSON files under `server/seed-data/`. An idempotent seed script reads these files and writes deterministic Firestore documents into the learning-path, unit, lesson, exercise and answer-key paths. At runtime, the API reads lesson content from Firestore; React must not contain hard-coded lesson datasets.

### Minimum content

Create **one unit containing at least three complete lessons**. Use beginner-friendly A1 French and clear English instructions.

Suggested lessons:

1. **Greetings and politeness** — bonjour, salut, bonsoir, au revoir, merci, s'il vous plaît.
2. **Introducing yourself** — je m'appelle…, je suis…, comment tu t'appelles ?, enchanté(e).
3. **Everyday phrases** — basic questions and useful expressions such as je ne comprends pas, pouvez-vous répéter ?, oui/non and simple numbers or common phrases.

Each lesson should contain enough questions to feel like a real short lesson (target 6 exercises: two of each required type). Ensure all three exercise types are represented. Check French spelling, accents, gender/number agreement and the English meaning.

### Example learner-facing exercise data

**Multiple-choice translation**

```json
{
  "prompt": "How do you say 'Good morning' in French?",
  "options": [
    { "id": "a", "text": "Bonjour" },
    { "id": "b", "text": "Bonne nuit" },
    { "id": "c", "text": "Au revoir" }
  ]
}
```

Private answer-key document:

```json
{ "correctOptionId": "a" }
```

**Fill in the blank**

```json
{ "prompt": "Je ___ étudiant.", "hint": "I am a student." }
```

Private answer-key document:

```json
{ "acceptedAnswers": ["suis"] }
```

**Build a sentence from a word bank**

```json
{
  "prompt": "Build the French sentence for: I like apples.",
  "wordBank": [
    { "id": "w1", "text": "J'aime" },
    { "id": "w2", "text": "les" },
    { "id": "w3", "text": "pommes" }
  ]
}
```

Private answer-key document:

```json
{ "correctTokenIds": ["w1", "w2", "w3"] }
```

The exact shape may be improved during implementation, but preserve the strict separation between learner-facing exercise documents and private answer-key documents.

### Seed script requirements

- Use stable document IDs from the JSON seed data so rerunning the seed is safe and does not create duplicate lessons.
- Validate the seed files with Zod before writing.
- Use batched writes, splitting into chunks below Firestore's per-batch write limit; do not assume one arbitrarily large batch will succeed.
- Use merge/upsert behaviour carefully so a seed run updates lesson content without overwriting learner progress.
- Seed only shared learning content. Do not reset user accounts, XP, hearts, progress, review items or session documents.
- Include a seed verification step that reads the path back and confirms at least one unit, three lessons and the expected exercise counts exist.

## 8. Learning path, lesson progression and exercise behaviour

### 8.1 Learning path

- Return units ordered by `order`, with their lessons ordered by `order`.
- The first lesson is unlocked for an onboarded learner.
- A lesson unlocks only after the immediately preceding lesson in the overall learning path is completed.
- The first lesson of a later unit must remain locked until the last lesson of the previous unit is completed.
- Completed lessons remain accessible for replay.
- The backend must check the prerequisite on start and answer endpoints. A user must not bypass progression by guessing a lesson URL.

### 8.2 Starting a lesson

`POST /api/lessons/:lessonId/start`

- Require authentication and completed onboarding.
- Check that the lesson belongs to the selected language path and is unlocked or already completed.
- Reconcile the user's hearts before starting.
- If hearts are zero, return a clear `HEARTS_DEPLETED` response with the next refill time; do not start a new attempt.
- Create a `LessonAttempt` and return an attempt ID plus learner-safe exercise data (never answer keys).

### 8.3 Answer submission

`POST /api/lessons/:lessonId/exercises/:exerciseId/answer`

Example request bodies:

```json
{ "attemptId": "...", "answer": { "optionId": "a" } }
```

```json
{ "attemptId": "...", "answer": { "text": "suis" } }
```

```json
{ "attemptId": "...", "answer": { "tokenIds": ["w1", "w2", "w3"] } }
```

Backend responsibilities:

1. Authenticate the user and verify ownership of the lesson attempt.
2. Verify that the attempt is active and the exercise belongs to that lesson.
3. Reject duplicate submissions for the same exercise in the same attempt.
4. Validate the answer shape for the exercise type.
5. Evaluate the answer on the server using the private answer key.
6. On a wrong answer, deduct one heart and upsert a pending review item.
7. Save the attempt and update lesson-attempt counters atomically.
8. Return immediate feedback: correctness, explanation, and the correct answer when appropriate; never expose answer keys before submission.

For fill-in-the-blank comparison, normalize Unicode to NFC, trim leading/trailing whitespace, collapse repeated spaces and compare case-insensitively. Preserve accents: French accents should not be silently removed. For word-bank answers, compare the submitted token ID sequence to the expected sequence.

### 8.4 Lesson completion and results

`POST /api/lessons/:lessonId/complete`

- Verify all exercises in the lesson attempt have been answered.
- Calculate accuracy as `correct answers / total exercises * 100`.
- On the user's first successful completion of a lesson, award:
  - 10 base XP
  - plus `floor(accuracy / 10)` bonus XP (0–10)
- Replaying a completed lesson awards 0 additional completion XP, preventing unlimited XP farming.
- Persist lesson completion, user total XP and local-day activity in a single Firestore transaction.
- Update/unlock the next lesson through the progression service.
- Return a result payload containing accuracy, correct count, total count, XP awarded, new total XP, daily goal progress and next lesson availability.

A lesson is complete when every exercise has been answered; perfect accuracy is not required. If the user's hearts reach zero before all questions are answered, preserve the attempt so the user can resume after a heart regenerates.

---

## 9. Gamification rules

### 9.1 XP and daily goal

- Onboarding choices: 10, 20, 30 or 50 XP per day.
- Display total XP and today's XP against the selected goal.
- Count XP toward the daily goal only when the backend awards it.
- The daily goal is considered reached when that local day's XP is greater than or equal to the user's goal.
- Do not grant repeat lesson-completion XP. Review practice does not grant XP.

### 9.2 Hearts

- Maximum and initial balance: 5 hearts.
- Every incorrect submitted answer costs 1 heart.
- Correct answers do not consume hearts.
- Regenerate 1 heart every 30 minutes until the user reaches 5.
- Calculate regeneration from timestamps when reading/updating the user; do not require a cron job.
- Use a shared backend helper/service for heart reconciliation so the dashboard and answer endpoints cannot disagree.
- If hearts are zero, block further answer submissions until at least one heart regenerates. Show the next refill countdown/time in the UI.
- Ensure heart deduction and attempt persistence are atomic in a Firestore transaction to prevent double charging on duplicate requests.

### 9.3 Daily streak and time-zone awareness

- Capture the browser's IANA time zone during onboarding using `Intl.DateTimeFormat().resolvedOptions().timeZone` and validate it on the server.
- Store the IANA time-zone name on the user.
- Use the user's time zone to determine the local calendar date when XP is earned.
- Upsert `UserDailyActivity` by `(userId, localDate)`.
- A learning day is a local date on which the user completes at least one lesson attempt (first completion or replay), or correctly resolves at least one review item. This keeps streaks useful after the starter lessons have been completed.
- XP remains separate: only a lesson's first completion awards completion XP; replays and review practice award 0 XP.
- Update the daily activity row on lesson-attempt completion and on successful review resolution, even when the XP earned is zero.
- Calculate the current streak from consecutive activity dates. If there is activity today, count backwards from today; otherwise, if there is activity yesterday, count backwards from yesterday so the streak remains visible during the current day. If neither condition holds, the streak is zero.
- Handle daylight-saving transitions through time-zone-aware date logic; do not calculate a day as a fixed 24-hour UTC interval.

---

## 10. Review queue

- On every incorrect lesson answer, create or update one `ReviewItem` for that user and exercise.
- The queue endpoint returns only the authenticated user's pending items and includes the learner-safe exercise content, original lesson title and exercise type.
- A review answer is evaluated by the same server-side exercise evaluator used in lessons.
- A correct review answer is saved as a `ReviewAttempt`, sets the item to `RESOLVED` and records `resolvedAt`; also update `reviewItemsResolved` for the user's local date so review practice can maintain a streak.
- An incorrect review answer is saved as a `ReviewAttempt`, increments `wrongCount`, updates `lastWrongAt` and leaves it `PENDING`.
- If a resolved item is missed in a later lesson replay, reopen it as pending.
- Review practice does not award XP. Incorrect review answers consume a heart, consistent with the heart rule.
- Empty state should explain that missed exercises will appear here after the learner makes mistakes.

---

## 11. AI feature — NVIDIA NIM French conversation partner

### 11.1 User experience

Provide a simple chat screen for authenticated users. The AI should:

- Act as a friendly French conversation partner for an English-speaking beginner (approximately A1 level).
- Keep most conversational replies in simple French.
- Accept English when the learner is stuck.
- Correct mistakes gently and explain important corrections in simple English.
- Prefer short messages and one useful follow-up question at a time.
- Stay focused on French learning and redirect unrelated requests politely.
- Never claim that its generated language advice is guaranteed to be perfect.

### 11.2 Backend integration

- Call NVIDIA NIM from the Express server only. Never expose the NIM key in Vite environment variables or browser bundles.
- Configure provider details through environment variables, for example:
  - `NVIDIA_NIM_API_KEY`
  - `NVIDIA_NIM_BASE_URL`
  - `NVIDIA_NIM_MODEL`
- Use the provider's currently documented OpenAI-compatible interface/SDK configuration. Verify the current model identifier and endpoint during implementation instead of hard-coding an assumed model.
- Keep the system prompt on the server; never accept a client-supplied system prompt.
- Limit message length and conversation-history size. Accept only user/assistant history roles if history is sent by the client.
- Add authenticated per-user rate limiting and sensible request timeouts. Return a friendly fallback message if the provider is unavailable or quota is exhausted.
- Do not persist chat history in Firestore for this assignment; keep the UI conversation in memory. Do not log private message content unnecessarily.

### 11.3 AI acceptance criteria

A logged-in learner can send a message and receive a relevant beginner-level French response. The API key is not visible in the browser, invalid/oversized requests are rejected, and provider failures do not crash the application.

---

## 12. UI and responsive design requirements

Create an original, polished learning product. It may use familiar gamified learning conventions, but do not copy Duolingo branding, illustrations or exact screen designs.

### Required screens

1. **Register / Login** — clear forms, validation and loading/error states.
2. **Onboarding** — target language selection (French), daily XP goal selection and detected time zone confirmation.
3. **Dashboard** — total XP, today's XP/goal progress, streak, hearts, continue-learning action and review entry point.
4. **Learning path** — unit grouping, ordered lesson cards, locked/unlocked/completed states and progress.
5. **Lesson player** — one question at a time, visible progress bar, answer controls appropriate to the exercise type, submit/check action and immediate success/error feedback.
6. **Lesson results** — XP earned, accuracy, correct/total count and next lesson/continue action.
7. **Review queue** — pending missed exercises and empty state.
8. **AI conversation partner** — chat history for the current page session, message input, sending state and error handling.

### UX expectations

- Mobile-first; support narrow phone screens without horizontal scrolling.
- Make touch targets comfortable and text readable.
- Provide loading, empty, success and error states; do not leave blank screens while data loads.
- Use accessible labels, semantic buttons, visible focus states and sufficient contrast.
- Keep exercise instructions and feedback clear and concise.
- Do not rely only on colour to communicate correct/incorrect or locked/unlocked states.
- On desktop, use a clear navigation/sidebar layout; on mobile, use a compact navigation pattern.
- Avoid unnecessary animation and heavy media that could slow the app.

---

## 13. API contract summary

All endpoints are prefixed with `/api`. Return consistent JSON and appropriate HTTP status codes. Use a consistent error shape such as:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted information."
  }
}
```

### Authentication and user

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create learner account |
| POST | `/auth/login` | Authenticate and issue tokens |
| POST | `/auth/refresh` | Rotate refresh token and issue access token |
| POST | `/auth/logout` | Revoke session and clear cookie |
| GET | `/auth/me` | Return authenticated user and onboarding status |
| PATCH | `/me/onboarding` | Save target language, daily goal and time zone |
| GET | `/dashboard` | Return XP, hearts, streak, goal progress and next lesson |

### Learning and progress

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/learning-path` | Return ordered units and learner lesson states |
| GET | `/lessons/:lessonId` | Return lesson metadata and safe exercise content |
| POST | `/lessons/:lessonId/start` | Validate unlock/hearts and create lesson attempt |
| POST | `/lessons/:lessonId/exercises/:exerciseId/answer` | Validate and evaluate one answer |
| POST | `/lessons/:lessonId/complete` | Complete attempt, award XP and return results |

### Review and AI

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/review-queue` | Return the user's pending review items |
| POST | `/review-queue/:reviewItemId/answer` | Evaluate review answer and resolve/update item |
| POST | `/ai/chat` | Send a message to the NVIDIA NIM conversation partner |

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Basic service health check; do not expose secrets or database credentials |

The precise response DTOs should be defined in TypeScript and kept consistent between the API and client. Do not return raw Firestore documents wholesale; map them to safe response DTOs, especially for exercise, user and refresh-session data.

---

## 14. Firestore transactions, concurrency and correctness

Use Firestore transactions for operations that must remain consistent across multiple documents:

- **Registration:** read the deterministic email-lookup document, then create the email lookup and user profile together. This is the application's unique-email guarantee.
- **Answer submission:** read the user, lesson attempt, exercise, private answer key, existing answer and (when needed) review item; then write the answer, update counters, deduct a heart when incorrect, and create/update the review item atomically.
- **Lesson completion:** read the attempt and lesson progress; verify all exercises are answered; award XP only if this is the first completion; update the user total, progress document and local-day activity atomically.
- **Review resolution:** save the review attempt, resolve or update the review item and update the user's local-day activity in one transaction.
- **Refresh-token rotation:** compare the presented refresh-token hash and replace it in the session document atomically. Revoke the session on a hash mismatch/reuse.

Important Firestore implementation rules:

- Firestore transaction callbacks may be retried. Do not call NVIDIA NIM, send email, generate non-repeatable external side effects or mutate external state from inside a transaction callback.
- Complete all transaction reads before issuing writes. Keep transactions focused on the small set of documents required for one business operation.
- Use deterministic document IDs for per-attempt exercise answers, per-user review items, per-user lesson progress and per-user local-date activity. This makes duplicate detection straightforward.
- If an answer document already exists, return a conflict/idempotent response and do not deduct another heart or increment counters again.
- Firestore does not provide foreign keys or arbitrary SQL constraints. Validate lesson/exercise references and ownership in services, and validate seed consistency before deployment.
- Avoid broad collection scans inside hot request paths. Read known document references directly, use indexed queries and paginate when listing growing collections.
- Firestore enforces limits on transaction size and document size. Keep lesson/exercise and user data in separate, small documents; never store an entire learning history in one user document.
- Treat user aggregate fields (`xpTotal`, `hearts`) as backend-owned state. The client must never be allowed to update them directly.

For answer correctness, use the same normalization rules described in the exercise section: normalize Unicode to NFC, trim and collapse whitespace, compare case-insensitively, but preserve French accents. Compare word-bank token IDs in exact sequence order.

## 15. Testing requirements

At minimum, add automated tests for the backend's important business rules. Prefer the Firebase Emulator Suite / Firestore Emulator for integration tests so tests do not read or mutate production data:

1. Correct and incorrect evaluation for all three exercise types.
2. Fill-in-the-blank normalization preserves French accents.
3. A locked lesson cannot be started by guessing its ID.
4. Completing one lesson unlocks only the next lesson.
5. A wrong answer deducts exactly one heart and creates/updates one review item.
6. Duplicate answer submission does not deduct a second heart.
7. Heart regeneration returns the correct number of hearts at relevant time boundaries.
8. Streak calculation around local midnight and a time-zone/daylight-saving boundary.
9. XP is awarded only for first completion and is not farmable by replaying.
10. A user cannot access another user's progress, attempts or review items.
11. Refresh-token rotation invalidates the old token.

Also verify registration/login, onboarding, the main lesson flow and AI provider failure handling. Use an appropriate TypeScript test runner and API integration-test tool. Tests must not call the real paid AI provider; mock the provider client. Configure test runs to use the Firestore Emulator (or an isolated non-production Firebase project), never the live reviewer database.

---

## 16. Environment variables and configuration

Create `.env.example` with names and safe placeholders only. Never commit real secrets, Firebase service-account keys or Cloudinary credentials.

Expected configuration includes:

```text
NODE_ENV=
PORT=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ACCESS_TOKEN_TTL=
REFRESH_TOKEN_TTL=
CLIENT_ORIGIN=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIRESTORE_EMULATOR_HOST=
NVIDIA_NIM_API_KEY=
NVIDIA_NIM_BASE_URL=
NVIDIA_NIM_MODEL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
DEMO_USER_EMAIL=
DEMO_USER_PASSWORD=
```

Configuration notes:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are used by Firebase Admin SDK on the Express server. The private key is secret; if stored with escaped newlines in Render, normalize `\\n` to newline characters when initializing credentials.
- Use a dedicated service account with only the permissions needed by the application. Keep its credentials in Render's secret environment variables. Do not commit a service-account JSON file or expose these values through `VITE_` variables.
- `FIRESTORE_EMULATOR_HOST` is optional and used only for local emulator/testing. Never set it in production.
- Cloudinary variables are optional for this assignment because the required exercises are text-only. Add them to Render only if media handling is implemented.
- Do not add Firebase client API keys to the React app because all application data access is through the Express backend and Firebase Admin SDK.
- NVIDIA credentials and JWT secrets must remain server-side.

Validate configuration at server startup and fail with a clear message when a required production value is missing. Use separate secrets for access-token and refresh-token signing.

## 17. Scripts and developer experience

Provide predictable root scripts (npm workspaces are acceptable):

- `npm run dev` — run client and server locally.
- `npm run build` — build client and server.
- `npm run start` — start the production Express server, serving the Vite build and `/api`.
- `npm run test` — run automated tests.
- `npm run seed` — validate JSON seed files and idempotently populate Firestore learning content.
- `npm run emulators` — start the Firebase Emulator Suite for local development/testing, if configured.

Include Firebase configuration files for Firestore Security Rules and indexes. Do not create SQL migrations or use Prisma. Firestore has a schemaless document model; changes to the data shape should be reflected in TypeScript/Zod schemas, seed data and any required composite indexes. Document any manual Firestore setup steps in the README.

## 18. README and assignment submission requirements

The README must contain:

1. Product overview and screenshots (add screenshots once the app is running).
2. Live application URL and public GitHub repository URL once deployed.
3. Technology stack and architecture diagram/summary.
4. Key architecture decisions and the reasons/trade-offs behind them.
5. Local setup instructions, including prerequisites, Firebase project/Firestore setup, Render environment variables, seeding and run commands.
6. Test login credentials for the reviewer. Use a dedicated demo account with no real personal data; configure its credentials securely for the deployed environment and document the working credentials. Never place Firebase service-account credentials in the README.
7. Automated test instructions and a brief summary of what is covered.
8. Known limitations, especially any provider quota, demo-account or hosting constraints.
9. A statement that lesson content is seeded idempotently from JSON into Cloud Firestore and then served from Firestore.

The assignment explicitly requires a complete, unedited export of every AI conversation used in an `ai-chat-history/` folder. Preserve the original exports; do not fabricate, summarize, selectively edit or omit conversations. Include the relevant OpenCode and other AI conversation exports used to build the submission.

---

## 19. Implementation order

Work in this order. Keep the app runnable after each phase.

### Phase 1 — Foundation

- Inspect the existing repository before changing files.
- Create the client/server structure and TypeScript configuration.
- Configure Express, Firebase Admin SDK and Firestore.
- Create Firestore Security Rules that deny direct client reads/writes, plus required index configuration.
- Define TypeScript/Zod document schemas and collection-path helpers.
- Write and run the idempotent JSON content seed script against the Firestore Emulator or development project.
- Add health check and environment validation.

### Phase 2 — Auth and onboarding

- Implement registration, login, access/refresh JWTs, rotation, logout and `/me`.
- Enforce unique email registration transactionally through `emailLookups`.
- Add authentication middleware and user ownership rules.
- Implement onboarding and persist target language, XP goal and time zone on the user document.

### Phase 3 — Learning engine

- Seed one unit and at least three lessons.
- Implement learning-path API and sequential unlock checks using `previousLessonId` and user progress documents.
- Implement all three exercise types and server-side answer evaluation using separate answer-key documents.
- Implement instant feedback, lesson progress and results.

### Phase 4 — Gamification and review

- Implement XP and daily-goal tracking.
- Implement timestamp-based hearts and time-zone-aware streaks.
- Implement review queue creation, retrieval and resolution.
- Use Firestore transactions and add tests for these business rules.

### Phase 5 — Frontend and AI

- Build all required screens and responsive navigation.
- Connect each screen to the API; include loading/error/empty states.
- Implement the NVIDIA NIM conversation partner and safe server-side provider integration.

### Phase 6 — Verification and deployment

- Create the production Firestore database in the selected Firebase project and configure its location intentionally.
- Deploy Firestore indexes/rules and seed the production learning content without touching user progress.
- Add Firebase service-account credentials and other secrets to the Render Web Service environment.
- Run tests against the Firestore Emulator, then verify the deployed app with a fresh test account and reviewer account.
- Deploy the application on Render; verify the React app and `/api` share the expected origin.
- Complete README, screenshots, test login and `ai-chat-history/` exports.

If time becomes limited, prioritize working end-to-end must-have flows over visual polish or optional abstractions. Do not start stretch features.

### Important database decision

The database for this project is **Cloud Firestore**, not Render PostgreSQL. Render is used to host the web application (frontend build and Express backend). Do not add PostgreSQL, Prisma, SQL migrations or a Render database as a fallback. Cloudinary is optional for media assets only; it is not the application database and is not required for the initial text-only lesson content.

## 20. Acceptance checklist

The assignment is ready for submission only when all applicable items below pass:

- [ ] A user can register, log in, refresh a session and log out.
- [ ] Protected APIs reject unauthenticated requests.
- [ ] One user cannot access another user's private data.
- [ ] First-time onboarding records French, a selected XP goal and an IANA time zone.
- [ ] Dashboard shows XP, daily goal progress, hearts and streak.
- [ ] Learning path displays at least one unit and three lessons.
- [ ] The first lesson is available; later lessons unlock sequentially only after completion.
- [ ] Lesson and exercise content is read from Cloud Firestore, seeded idempotently from JSON.
- [ ] Multiple-choice translation works.
- [ ] Fill in the blank works.
- [ ] Word-bank sentence building works.
- [ ] Correct answers receive immediate positive feedback.
- [ ] Incorrect answers receive immediate corrective feedback and enter the review queue.
- [ ] Wrong answers deduct one heart; heart regeneration works without a cron job.
- [ ] Lesson progress updates after each submitted answer.
- [ ] Results show accuracy and XP earned.
- [ ] XP, daily goal and streak use the user's local date/time zone.
- [ ] Review items can be practised and resolved by answering correctly.
- [ ] The French AI conversation partner responds through NVIDIA NIM.
- [ ] The NIM API key is never exposed to the browser.
- [ ] The application is usable on desktop and phone-sized browser screens.
- [ ] Core backend business logic has automated tests using the Firestore Emulator or an isolated test project.
- [ ] Production build and Render deployment work; Firestore is reachable from the backend; reviewer test credentials are documented.
- [ ] README documents setup, architecture, test login and known limitations.
- [ ] Complete, unedited AI conversation exports are present in `ai-chat-history/`.

---

## 21. Instructions to OpenCode

Treat this PRD as the source of truth for the initial implementation.

1. First inspect the current repository and report its existing structure. Do not overwrite unrelated work.
2. Convert this PRD into a short implementation checklist, then implement in the phase order above.
3. Make reasonable implementation decisions where this PRD leaves details open. Prefer the simplest secure solution that satisfies the requirement, and record important decisions and trade-offs in the README.
4. Do not ask for another product interview; the core product decisions have already been made.
5. Do not add stretch features or extra exercise types.
6. Do not fake authentication, authorization, answer evaluation, XP, streaks, hearts or persistence with frontend-only state. These rules belong on the Express backend and are persisted in Cloud Firestore.
7. Never send private answer-key data, password hashes, refresh-token hashes, Firebase service-account credentials, JWT secrets or NVIDIA API credentials to the client.
8. Keep the app runnable, type-checkable and tested as implementation progresses. Fix build/type/lint/test errors rather than ignoring them.
9. Do not claim a feature is complete until it has been implemented and verified.
10. Before finishing, run the production build and tests, report what passed, list any remaining limitations, and identify the exact deployment environment variables still requiring manual configuration.

**Success means a complete, secure, responsive English-to-French learning web app covering the assignment's mandatory requirements—not a large collection of unfinished features.**
