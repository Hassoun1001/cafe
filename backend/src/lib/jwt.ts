import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AppSystem } from '@prisma/client';

export interface SessionPayload {
  sub: string;
  username: string;
  system: AppSystem;
}

export function signSessionToken(user: { id: string; username: string; system: AppSystem }): string {
  return jwt.sign({ sub: user.id, username: user.username, system: user.system }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload !== 'object' || !payload || !('sub' in payload) || !('system' in payload)) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
