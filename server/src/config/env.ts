import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),

  FIRESTORE_EMULATOR_HOST: z.string().optional(),

  NVIDIA_NIM_API_KEY: z.string().min(1),
  NVIDIA_NIM_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_NIM_MODEL: z.string().min(1).default('meta/llama-3.1-70b-instruct'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const normalizedPrivateKey = rawPrivateKey?.replace(/\\n/g, '\n');

  const parsed = envSchema.safeParse({
    ...process.env,
    FIREBASE_PRIVATE_KEY: normalizedPrivateKey,
  });

  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function validateEnv(): void {
  getEnv();
}