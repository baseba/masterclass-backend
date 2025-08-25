export interface User {
  id: number;
  email: string;
  password: string;
  createdAt: Date;
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
  role: 'user' | 'admin';
}
