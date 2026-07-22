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
    // Older tokens signed before permissions existed simply won't have the
    // claim — treat that the same as "no permissions granted" rather than
    // crashing, so already-logged-in sessions don't break the moment this
    // deploys; they just don't get any permission-gated access until they
    // log in again and get a token with the claim.
    req.user = { id: payload.sub, username: payload.username, system: payload.system, role: payload.role, permissions: payload.permissions ?? [] };
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

// Finer-grained than requireAdmin — ADMIN always passes regardless of the
// key; a STAFF account only passes if this specific key is in their granted
// permissions list (see lib/permissions.ts for the full catalog and the
// Team Access checkbox matrix in Settings/StudySettings where they're
// assigned). Use this instead of requireAdmin on any route where staff
// should be individually grantable access rather than all-or-nothing.
export function requirePermission(key: string): RequestHandler {
  return (req, _res, next) => {
    if (req.user?.role === 'ADMIN' || req.user?.permissions.includes(key)) {
      next();
      return;
    }
    throw forbidden("You don't have permission to do this", 'PERMISSION_REQUIRED');
  };
}
