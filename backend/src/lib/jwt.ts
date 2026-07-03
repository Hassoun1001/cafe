import jwt from 'jsonwebtoken';
import { config } from '../config';

const TOKEN_SUBJECT = 'studio-cafe-session';

export function signSessionToken(): string {
  return jwt.sign({ sub: TOKEN_SUBJECT }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifySessionToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload | string;
    return typeof payload === 'object' && payload.sub === TOKEN_SUBJECT;
  } catch {
    return false;
  }
}
