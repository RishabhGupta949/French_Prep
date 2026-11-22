import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getEnv } from './env.js';

let app: App | null = null;
let db: Firestore | null = null;

export function initializeFirebase(): { app: App; db: Firestore } {
  if (app && db) return { app, db };

  const env = getEnv();

  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
      projectId: env.FIREBASE_PROJECT_ID,
    });
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);

  if (env.FIRESTORE_EMULATOR_HOST) {
    db.settings({
      host: env.FIRESTORE_EMULATOR_HOST,
      ssl: false,
    });
  }

  return { app, db };
}

export function getDb(): Firestore {
  if (!db) {
    return initializeFirebase().db;
  }
  return db;
}