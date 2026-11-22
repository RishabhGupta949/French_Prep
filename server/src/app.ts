
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  // API routes
  app.use('/api', authRoutes);
  app.use('/api', learningRoutes);
  app.use('/api', aiRoutes);

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve the React production build.
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDirectory, '../..');
  const clientDist = resolve(projectRoot, 'client/dist');

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));

    // React Router fallback for frontend routes.
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }

      res.sendFile(resolve(clientDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  // Error handler must remain last.
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);

    const statusCode =
      err instanceof ZodError ? 400 : (err as any).statusCode || 500;

    res.status(statusCode).json({
      error: {
        code:
          err instanceof ZodError
            ? 'VALIDATION_ERROR'
            : (err as any).code || 'INTERNAL_ERROR',
        message:
          statusCode === 500
            ? 'An unexpected error occurred'
            : err.message,
      },
    });
  });

  return app;
}
