import request from 'supertest';
import express from 'express';
import adminRouter from '../admin';
import professorRouter from '../professor/professors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);
app.use('/professor', professorRouter);

let adminToken: string;
let testStudentId: number;

beforeAll(async () => {
  // Create test admin
  const adminEmail = 'admin2@example.com';
  const adminPassword = 'securepassword';
  const hash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.create({
    data: {
      name: 'Test Admin',
      email: adminEmail,
      passwordHash: hash,
    },
  });

  // Login as admin
  const res = await request(app)
    .post('/admin/login')
    .send({ email: adminEmail, password: adminPassword });
  adminToken = res.body.token;

  // Create test student
  const student = await prisma.student.create({
    data: {
      name: 'Test Student',
      email: 'student2@example.com',
      passwordHash: await bcrypt.hash('studentpass', 10),
      phone: '1234567890',
    },
  });
  testStudentId = student.id;
});

afterAll(async () => {
  await prisma.admin.deleteMany({ where: { email: 'admin2@example.com' } });
  await prisma.professor.deleteMany({ where: { email: 'student2@example.com' } });
  await prisma.student.deleteMany({ where: { email: 'student2@example.com' } });
  await prisma.$disconnect();
});

describe('Admin Routes', () => {
  it('should login as admin', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ email: 'admin2@example.com', password: 'securepassword' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should list professors', async () => {
    const res = await request(app)
      .get('/professor')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should get professor by id (404 if not found)', async () => {
    const res = await request(app)
      .get('/professor/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200,404]).toContain(res.status);
  });

  it('should promote student to professor', async () => {
    const res = await request(app)
      .post(`/professor/promote/${testStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('student2@example.com');
  });

  it('should not promote same student twice', async () => {
    const res = await request(app)
      .post(`/professor/promote/${testStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('should return 404 for non-existent student', async () => {
    const res = await request(app)
      .post(`/professor/promote/999999`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
