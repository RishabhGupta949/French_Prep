import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { config } from 'dotenv';
import { initializeFirebase } from '../config/firebase.js';
import { getEnv } from '../config/env.js';
import {
  getLearningPathRef,
  unitDoc,
  lessonDoc,
  exerciseDoc,
  answerKeyDoc,
  unitsCol,
  lessonsCol,
  exercisesCol,
  answerKeysCol,
  LEARNING_PATH_ID,
} from '../lib/collections.js';
import {
  LearningPathSchema,
  UnitSchema,
  LessonMetadataSchema,
  ExerciseSchema,
  AnswerKeySchema,
} from '../lib/schemas.js';
import { Timestamp } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');
config({ path: join(projectRoot, '.env') });
const SEED_DIR = join(__dirname, '..', '..', 'seed-data');

const UnitWithIdSchema = UnitSchema.extend({ unitId: z.string() });
const LessonWithIdSchema = LessonMetadataSchema.extend({ lessonId: z.string() });
const ExerciseWithIdSchema = ExerciseSchema.extend({ exerciseId: z.string() });
const AnswerKeyWithIdSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    exerciseId: z.string(),
    correctOptionId: z.string(),
  }),
  z.object({
    type: z.literal('FILL_BLANK'),
    exerciseId: z.string(),
    acceptedAnswers: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('WORD_BANK'),
    exerciseId: z.string(),
    correctTokenIds: z.array(z.string()).min(1),
  }),
]);

type UnitWithId = z.infer<typeof UnitWithIdSchema>;
type LessonWithId = z.infer<typeof LessonWithIdSchema>;
type ExerciseWithId = z.infer<typeof ExerciseWithIdSchema>;
type AnswerKeyWithId = z.infer<typeof AnswerKeyWithIdSchema>;

function readJson<T>(filename: string, schema: z.ZodType<T>): T {
  const filePath = join(SEED_DIR, filename);
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return schema.parse(data);
}

async function seedLearningPath() {
  const db = initializeFirebase().db;
  const batch = db.batch();

  const pathData = readJson('learning-path.json', LearningPathSchema);
  const pathRef = getLearningPathRef();
  batch.set(pathRef, { ...pathData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });

  const unitsData = readJson('units.json', z.array(UnitWithIdSchema));
  for (const unit of unitsData) {
    const unitRef = unitDoc(LEARNING_PATH_ID, unit.unitId);
    const { unitId, ...unitData } = unit;
    batch.set(unitRef, { ...unitData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }

  const lessonsData = readJson('lessons.json', z.array(LessonWithIdSchema));
  for (const lesson of lessonsData) {
    const lessonRef = lessonDoc(LEARNING_PATH_ID, lesson.lessonId);
    const { lessonId, ...lessonData } = lesson;
    batch.set(lessonRef, { ...lessonData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }

  await batch.commit();
  console.log('✓ Learning path, units, and lessons seeded');
}

async function seedLessonContent(lessonId: string) {
  const db = initializeFirebase().db;
  const batch = db.batch();

  const exercisesData = readJson(`exercises-${lessonId}.json`, z.array(ExerciseWithIdSchema));
  for (const exercise of exercisesData) {
    const exRef = exerciseDoc(LEARNING_PATH_ID, lessonId, exercise.exerciseId);
    const { exerciseId, ...exerciseData } = exercise;
    batch.set(exRef, { ...exerciseData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }

  const answerKeysData = readJson(`answer-keys-${lessonId}.json`, z.array(AnswerKeyWithIdSchema));
  for (const answerKey of answerKeysData) {
    const akRef = answerKeyDoc(LEARNING_PATH_ID, lessonId, answerKey.exerciseId);
    const { exerciseId, ...answerKeyData } = answerKey;
    batch.set(akRef, { ...answerKeyData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }

  await batch.commit();
  console.log(`✓ Exercises and answer keys for ${lessonId} seeded`);
}

async function verifySeed() {
  const db = initializeFirebase().db;

  const pathSnap = await getLearningPathRef().get();
  if (!pathSnap.exists) throw new Error('Learning path not found');
  console.log('✓ Learning path verified');

  const unitsSnap = await unitsCol(LEARNING_PATH_ID).get();
  if (unitsSnap.empty) throw new Error('No units found');
  console.log(`✓ ${unitsSnap.size} unit(s) verified`);

  const lessonsSnap = await lessonsCol(LEARNING_PATH_ID).get();
  if (lessonsSnap.size < 3) throw new Error(`Expected at least 3 lessons, found ${lessonsSnap.size}`);
  console.log(`✓ ${lessonsSnap.size} lessons verified`);

  for (const lessonDocSnap of lessonsSnap.docs) {
    const lessonId = lessonDocSnap.id;
    const exercisesSnap = await exercisesCol(LEARNING_PATH_ID, lessonId).get();
    const answerKeysSnap = await answerKeysCol(LEARNING_PATH_ID, lessonId).get();

    if (exercisesSnap.size !== 6) {
      throw new Error(`Lesson ${lessonId} has ${exercisesSnap.size} exercises, expected 6`);
    }
    if (answerKeysSnap.size !== 6) {
      throw new Error(`Lesson ${lessonId} has ${answerKeysSnap.size} answer keys, expected 6`);
    }
    console.log(`✓ Lesson ${lessonId}: ${exercisesSnap.size} exercises, ${answerKeysSnap.size} answer keys`);
  }

  console.log('✓ Seed verification passed');
}

async function main() {
  try {
    getEnv();
    console.log('Starting seed...');

    await seedLearningPath();
    await seedLessonContent('lesson-1');
    await seedLessonContent('lesson-2');
    await seedLessonContent('lesson-3');
    await seedLessonContent('lesson-4');
    await seedLessonContent('lesson-5');
    await seedLessonContent('lesson-6');
    await seedLessonContent('lesson-7');
    await seedLessonContent('lesson-8');
    await seedLessonContent('lesson-9');
    await verifySeed();

    console.log('✅ Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

main();