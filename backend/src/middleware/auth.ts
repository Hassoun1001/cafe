import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppSystem } from '@prisma/client';
import { verifySessionToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

// Two independent apps (Cafe, Study) share this backend but never share a
// session — a token issued for one system is rejected outright by the other,
// even though both are just JWTs signed with the same secret.
function authenticateFor(system: AppSystem): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload || payload.system !== system) {
      throw unauthorized('Session expired or invalid, please log in again', 'INVALID_SESSION');
    }
    req.user = { id: payload.sub, username: payload.username, system: payload.system };
    next();
  };
}

export const authenticate = authenticateFor('CAFE');
export const authenticateStudy = authenticateFor('STUDY');
