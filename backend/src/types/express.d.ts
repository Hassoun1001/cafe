import type { AppSystem } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; system: AppSystem };
    }
  }
}

export {};
