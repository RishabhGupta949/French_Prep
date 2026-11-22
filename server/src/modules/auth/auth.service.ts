import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../config/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

const env = getEnv();

const ACCESS_TOKEN_TTL = env.ACCESS_TOKEN_TTL;
const REFRESH_TOKEN_TTL = env.REFRESH_TOKEN_TTL;
const ACCESS_SECRET = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
  sid: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  sid: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

export function generateRefreshTokenHash(token: string): string {
  return createHash('sha256').update(token + env.JWT_REFRESH_SECRET).digest('hex');
}

export async function createAccessToken(userId: string, email: string, role: string, sessionId: string): Promise<string> {
  return new SignJWT({ sub: userId, email, role, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(ACCESS_SECRET);
}

export async function createRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    return payload as unknown as RefreshTokenPayload;
  } catch {
    return null;
  }
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
  const expiresAtTimestamp = Timestamp.fromDate(expiresAt);

  await db
    .collection('users')
    .doc(userId)
    .collection('refreshSessions')
    .doc(sessionId)
    .set({
      tokenHash,
      expiresAt: expiresAtTimestamp,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });
}

export async function verifyAndRotateRefreshToken(
  userId: string,
  sessionId: string,
  presentedToken: string
): Promise<{ newRefreshToken: string; newSessionId: string } | null> {
  const db = getDb();
  const sessionRef = db
    .collection('users')
    .doc(userId)
    .collection('refreshSessions')
    .doc(sessionId);

  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) {
    return null;
  }

  const sessionData = sessionDoc.data();
  const storedHash = sessionData?.tokenHash;
  const revokedAt = sessionData?.revokedAt;
  const expiresAt = sessionData?.expiresAt?.toDate();

  if (revokedAt || (expiresAt && expiresAt < new Date())) {
    return null;
  }

  const presentedHash = generateRefreshTokenHash(presentedToken);
  if (presentedHash !== storedHash) {
    await sessionRef.update({ revokedAt: Timestamp.now(), updatedAt: Timestamp.now() });
    return null;
  }

  const newSessionId = generateSessionId();
  const newRefreshToken = await createRefreshToken(userId, newSessionId);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const newTokenHash = generateRefreshTokenHash(newRefreshToken);

  await sessionRef.set({
    tokenHash: newTokenHash,
    expiresAt: Timestamp.fromDate(newExpiresAt),
    revokedAt: null,
    createdAt: sessionData?.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { newRefreshToken, newSessionId };
}

export async function revokeRefreshToken(userId: string, sessionId: string): Promise<void> {
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

export async function revokeAllUserSessions(userId: string): Promise<void> {
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