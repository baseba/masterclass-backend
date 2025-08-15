export interface User {
  id: number;
  email: string;
  password: string;
  createdAt: Date;
}

export interface AuthPayload {
  id: number;
  email: string;
}
