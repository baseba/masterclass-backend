import jwt from 'jsonwebtoken';
import { User, AuthPayload } from '../types';

export function signJwt(user: User): string {
  const payload: AuthPayload = { id: user.id, email: user.email };
  return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_here', { expiresIn: '1d' });
}
