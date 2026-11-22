import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access token' },
    });
    return;
  }

  req.user = payload;
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }
  next();
}

export function requireRole(...roles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
      return;
    }
    next();
  };
}