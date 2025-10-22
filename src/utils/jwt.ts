
import jwt from 'jsonwebtoken';
import { User, Admin, AuthPayload } from '../types';

export function signJwt(subject: User | Admin, role: 'student' | 'professor' | 'admin'): string {
  const payload: AuthPayload = { id: subject.id, email: subject.email, role };
  return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_here', { expiresIn: '1d' });
}
