import jwt from 'jsonwebtoken';
import { User, Admin, AuthPayload } from '../types';

export function signJwt(subject: User | Admin, role: 'user' | 'admin'): string {
  const payload: AuthPayload = { id: subject.id, email: subject.email, role };
  return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_here', {
    expiresIn: '1d',
  });
}

// Confirmation tokens for email verification
export function signConfirmationToken(email: string, confirmed = false): string {
  const secret = process.env.CONFIRM_TOKEN_SECRET || process.env.JWT_SECRET || 'confirm_secret';
  const payload = { email, confirmed } as { email: string; confirmed: boolean };
  return (jwt as any).sign(payload, secret, { expiresIn: process.env.CONFIRM_TOKEN_EXPIRES || '7d' });
}

export function verifyConfirmationToken(token: string): { email: string; confirmed?: boolean } {
  const secret = process.env.CONFIRM_TOKEN_SECRET || process.env.JWT_SECRET || 'confirm_secret';
  return (jwt as any).verify(token, secret) as { email: string; confirmed?: boolean };
}
