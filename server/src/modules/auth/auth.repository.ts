import { createHash } from 'crypto';
import { getDb } from '../../config/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { User, RegisterInput, OnboardingInput } from '../../lib/schemas.js';
import { generateSessionId, generateRefreshTokenHash } from './auth.service.js';

export function createEmailHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export async function createUserWithEmailLookup(
  userId: string,
  data: RegisterInput,
  passwordHash: string,
  timeZone: string,
  dailyGoalXp: number
): Promise<void> {
  const db = getDb();
  const emailHash = createEmailHash(data.email);
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const emailLookupRef = db.collection('emailLookups').doc(emailHash);
    const emailLookupDoc = await transaction.get(emailLookupRef);
    if (emailLookupDoc.exists) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const userRef = db.collection('users').doc(userId);
    transaction.set(emailLookupRef, { userId, createdAt: Timestamp.now() });
    transaction.set(userRef, {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: 'LEARNER',
      targetLanguage: 'fr',
      dailyGoalXp,
      timeZone,
      xpTotal: 0,
      hearts: 5,
      nextHeartAt: null,
      onboardingCompletedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

export async function findUserByEmail(email: string): Promise<{ id: string; data: User } | null> {
  const db = getDb();
  const emailHash = createEmailHash(email);
  const emailLookupDoc = await db.collection('emailLookups').doc(emailHash).get();
  if (!emailLookupDoc.exists) {
    return null;
  }
  const userId = emailLookupDoc.data()?.userId;
  if (!userId) return null;
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  return { id: userId, data: userDoc.data() as User };
}

export async function getUserById(userId: string): Promise<User | null> {
  const db = getDb();
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  return userDoc.data() as User;
}

export async function updateUserOnboarding(
  userId: string,
  data: OnboardingInput
): Promise<void> {
  const db = getDb();
  await db.collection('users').doc(userId).update({
    targetLanguage: data.targetLanguage,
    dailyGoalXp: data.dailyGoalXp,
    timeZone: data.timeZone,
    onboardingCompletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function storeRefreshTokenHash(
  userId: string,
  sessionId: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const db = getDb();
  const tokenHash = generateRefreshTokenHash(refreshToken);
  const now = Timestamp.now();

  await db
    .collection('users')
    .doc(userId)
    .collection('refreshSessions')
    .doc(sessionId)
    .set({
      tokenHash,
      expiresAt: Timestamp.fromDate(expiresAt),
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });
}

export async function getRefreshSession(userId: string, sessionId: string) {
  const db = getDb();
  const doc = await db
    .collection('users')
    .doc(userId)
    .collection('refreshSessions')
    .doc(sessionId)
    .get();
  if (!doc.exists) return null;
  return doc.data();
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .collection('users')
    .doc(userId)
    .collection('refreshSessions')
    .doc(sessionId)
    .update({
      revokedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const db = getDb();
  const sessionsRef = db.collection('users').doc(userId).collection('refreshSessions');
  const snapshot = await sessionsRef.where('revokedAt', '==', null).get();
  const batch = db.batch();
  const now = Timestamp.now();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { revokedAt: Timestamp.now(), updatedAt: now });
  });
  await batch.commit();
}

export async function rotateRefreshSession(
  userId: string,
  oldSessionId: string,
  newSessionId: string,
  newRefreshToken: string,
  expiresAt: Date
): Promise<void> {
  const db = getDb();
  const tokenHash = generateRefreshTokenHash(newRefreshToken);
  const now = Timestamp.now();

  await db
    .collection('users')
    .doc(userId)
    .collection('refreshSessions')
    .doc(newSessionId)
    .set({
      tokenHash,
      expiresAt: Timestamp.fromDate(expiresAt),
      revokedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: now,
    });
}