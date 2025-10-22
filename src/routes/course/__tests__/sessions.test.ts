import request from 'supertest';
import express from 'express';
import courseRouter from '../courses';
import { PrismaClient } from '@prisma/client';
import adminRouter from '../../admin';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);
app.use('/course', courseRouter);

let adminToken: string;
let professorId: number;
let courseId: number;
let sessionId: number;

beforeAll(async () => {
  // Create test admin
  const adminEmail = 'admin-session@example.com';
  const adminPassword = 'adminsession123';
  const hash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.create({
    data: {
      name: 'Session Admin',
      email: adminEmail,
      passwordHash: hash,
    },
  });

  // Login as admin
  const res = await request(app)
    .post('/admin/login')
    .send({ email: adminEmail, password: adminPassword });
  adminToken = res.body.token;

  // Create test professor
  const professor = await prisma.professor.create({
    data: {
      name: 'Session Professor',
      email: 'prof-session@example.com',
      bio: 'Bio',
      profilePictureUrl: '',
    },
  });
  professorId = professor.id;

  // Create test course
  const course = await prisma.course.create({
    data: {
      title: 'Session Course',
      description: 'Course for sessions',
      professorId,
      isActive: true,
    },
  });
  courseId = course.id;
}, 20000);

afterAll(async () => {
  await prisma.class.deleteMany({ where: { title: 'Test Session' } });
  await prisma.course.deleteMany({ where: { title: 'Session Course' } });
  await prisma.professor.deleteMany({
    where: { email: 'prof-session@example.com' },
  });
  await prisma.admin.deleteMany({
    where: { email: 'admin-session@example.com' },
  });
  await prisma.$disconnect();
}, 20000);

describe('Session (Class) Routes', () => {
  it('should create a session (class) in a course', async () => {
    const res = await request(app)
      .post(`/course/${courseId}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Session',
        description: 'Session desc',
        objectives: 'Learn',
        orderIndex: 1,
        basePrice: 100,
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Session');
    sessionId = res.body.id;
  });

  it('should list all sessions in a course', async () => {
    const res = await request(app)
      .get(`/course/${courseId}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should get a session by id', async () => {
    const res = await request(app)
      .get(`/course/${courseId}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionId);
  });

  it('should update a session', async () => {
    const res = await request(app)
      .put(`/course/${courseId}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Updated Session',
        description: 'Updated',
        objectives: 'Updated',
        orderIndex: 2,
        basePrice: 150,
      });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Session');
  });

  it('should delete a session', async () => {
    const res = await request(app)
      .delete(`/course/${courseId}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204, 404]).toContain(res.status);
  });
});
