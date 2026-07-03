import { NextFunction, Request, Response } from 'express';
import { verifySessionToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token || !verifySessionToken(token)) {
    throw unauthorized('Session expired or invalid, please log in again', 'INVALID_SESSION');
  }
  next();
}
