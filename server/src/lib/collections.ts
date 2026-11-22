import { getDb } from '../config/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export const COLLECTIONS = {
  EMAIL_LOOKUPS: 'emailLookups',
  USERS: 'users',
  REFRESH_SESSIONS: 'refreshSessions',
  LESSON_PROGRESS: 'lessonProgress',
  LESSON_ATTEMPTS: 'lessonAttempts',
  ANSWERS: 'answers',
  REVIEW_ITEMS: 'reviewItems',
  REVIEW_ATTEMPTS: 'attempts',
  DAILY_ACTIVITY: 'dailyActivity',
  LEARNING_PATHS: 'learningPaths',
  UNITS: 'units',
  LESSONS: 'lessons',
  EXERCISES: 'exercises',
  ANSWER_KEYS: 'answerKeys',
} as const;

export function emailLookupsCol() {
  return getDb().collection(COLLECTIONS.EMAIL_LOOKUPS);
}

export function usersCol() {
  return getDb().collection(COLLECTIONS.USERS);
}

export function userDoc(userId: string) {
  return usersCol().doc(userId);
}

export function refreshSessionsCol(userId: string) {
  return userDoc(userId).collection(COLLECTIONS.REFRESH_SESSIONS);
}

export function refreshSessionDoc(userId: string, sessionId: string) {
  return refreshSessionsCol(userId).doc(sessionId);
}

export function lessonProgressCol(userId: string) {
  return userDoc(userId).collection(COLLECTIONS.LESSON_PROGRESS);
}

export function lessonProgressDoc(userId: string, lessonId: string) {
  return lessonProgressCol(userId).doc(lessonId);
}

export function lessonAttemptsCol(userId: string) {
  return userDoc(userId).collection(COLLECTIONS.LESSON_ATTEMPTS);
}

export function lessonAttemptDoc(userId: string, attemptId: string) {
  return lessonAttemptsCol(userId).doc(attemptId);
}

export function answersCol(userId: string, attemptId: string) {
  return lessonAttemptDoc(userId, attemptId).collection(COLLECTIONS.ANSWERS);
}

export function answerDoc(userId: string, attemptId: string, exerciseId: string) {
  return answersCol(userId, attemptId).doc(exerciseId);
}

export function reviewItemsCol(userId: string) {
  return userDoc(userId).collection(COLLECTIONS.REVIEW_ITEMS);
}

export function reviewItemDoc(userId: string, exerciseId: string) {
  return reviewItemsCol(userId).doc(exerciseId);
}

export function reviewAttemptsCol(userId: string, exerciseId: string) {
  return reviewItemDoc(userId, exerciseId).collection(COLLECTIONS.REVIEW_ATTEMPTS);
}

export function reviewAttemptDoc(userId: string, exerciseId: string, attemptId: string) {
  return reviewAttemptsCol(userId, exerciseId).doc(attemptId);
}

export function dailyActivityCol(userId: string) {
  return userDoc(userId).collection(COLLECTIONS.DAILY_ACTIVITY);
}

export function dailyActivityDoc(userId: string, localDate: string) {
  return dailyActivityCol(userId).doc(localDate);
}

export function learningPathsCol() {
  return getDb().collection(COLLECTIONS.LEARNING_PATHS);
}

export function learningPathDoc(pathId: string) {
  return learningPathsCol().doc(pathId);
}

export function unitsCol(pathId: string) {
  return learningPathDoc(pathId).collection(COLLECTIONS.UNITS);
}

export function unitDoc(pathId: string, unitId: string) {
  return unitsCol(pathId).doc(unitId);
}

export function lessonsCol(pathId: string) {
  return learningPathDoc(pathId).collection(COLLECTIONS.LESSONS);
}

export function lessonDoc(pathId: string, lessonId: string) {
  return lessonsCol(pathId).doc(lessonId);
}

export function exercisesCol(pathId: string, lessonId: string) {
  return lessonDoc(pathId, lessonId).collection(COLLECTIONS.EXERCISES);
}

export function exerciseDoc(pathId: string, lessonId: string, exerciseId: string) {
  return exercisesCol(pathId, lessonId).doc(exerciseId);
}

export function answerKeysCol(pathId: string, lessonId: string) {
  return lessonDoc(pathId, lessonId).collection(COLLECTIONS.ANSWER_KEYS);
}

export function answerKeyDoc(pathId: string, lessonId: string, exerciseId: string) {
  return answerKeysCol(pathId, lessonId).doc(exerciseId);
}

export const LEARNING_PATH_ID = 'en-fr';

export function getLearningPathRef() {
  return learningPathDoc(LEARNING_PATH_ID);
}

export function now(): Timestamp {
  return Timestamp.now();
}

export function formatLocalDate(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function generateId(): string {
  return getDb().collection('_').doc().id;
}