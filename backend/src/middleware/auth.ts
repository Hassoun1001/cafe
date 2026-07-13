import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppSystem } from '@prisma/client';
import { verifySessionToken } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/errors';

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
    req.user = { id: payload.sub, username: payload.username, system: payload.system, role: payload.role };
    next();
  };
}

export const authenticate = authenticateFor('CAFE');
export const authenticateStudy = authenticateFor('STUDY');

// STAFF can run day-to-day operations but is blocked from Settings entirely
// and from hard-deleting historical/financial records — apply this after
// authenticate/authenticateStudy on any route that's admin-only. Mount at
// the router level for routes that are ENTIRELY admin-only (Settings, user
// management, study resources); check inline in the handler for routes that
// serve a dual purpose (e.g. deleting an OPEN order is a normal staff task,
// deleting a PAID one is not).
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') {
    throw forbidden('Only an admin account can do this', 'ADMIN_REQUIRED');
  }
  next();
};
