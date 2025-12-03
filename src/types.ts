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

export interface Professor {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  confirmed: boolean;
  phone: string | null;
  rut: string;
  bio: string | null;
  profilePictureUrl: string | null;
}

export type IAccountType = 'user' | 'professor' | 'admin';

export interface AuthPayload {
  id: number;
  email: string;
  role: IAccountType;
}
