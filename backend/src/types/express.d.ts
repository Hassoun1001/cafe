import type { AppSystem, UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; system: AppSystem; role: UserRole; permissions: string[] };
    }
  }
}

export {};
