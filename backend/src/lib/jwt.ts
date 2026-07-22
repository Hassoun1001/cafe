import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AppSystem, UserRole } from '@prisma/client';

export interface SessionPayload {
  sub: string;
  username: string;
  system: AppSystem;
  role: UserRole;
  permissions: string[];
}

export function signSessionToken(user: {
  id: string;
  username: string;
  system: AppSystem;
  role: UserRole;
  permissions: string[];
}): string {
  return jwt.sign(
    { sub: user.id, username: user.username, system: user.system, role: user.role, permissions: user.permissions },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );
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
