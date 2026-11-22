import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getEnv } from './config/env.js';
import { initializeFirebase } from './config/firebase.js';
import { ZodError } from 'zod';
import authRoutes from './modules/auth/auth.routes.js';
import learningRoutes from './modules/learning/learning.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';

export function buildApp(): Application {
  const env = getEnv();
  initializeFirebase();

  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
  }));

  app.use(cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }));

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser(env.JWT_ACCESS_SECRET));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use('/api', authRoutes);
  app.use('/api', learningRoutes);
  app.use('/api', aiRoutes);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    const statusCode = err instanceof ZodError ? 400 : (err as any).statusCode || 500;
    res.status(statusCode).json({
      error: {
        code: err instanceof ZodError ? 'VALIDATION_ERROR' : (err as any).code || 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'An unexpected error occurred' : err.message,
      },
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}