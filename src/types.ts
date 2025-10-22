export interface User {
  id: number;
  name?: string;
  email: string;
  passwordHash?: string;
  role?: 'student' | 'professor' | 'admin';
  createdAt?: Date;
}

export interface Admin {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface AuthPayload {
  id: number;
  email: string;
  role: 'student' | 'professor' | 'admin';
}
