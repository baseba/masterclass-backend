import request from 'supertest';
import express from 'express';
import courseRouter from '../courses';
import adminRouter from '../../admin';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);
app.use('/course', courseRouter);

let adminToken: string;
let professorId: number;
let courseId: number;

beforeAll(async () => {
  // Create test admin
  const adminEmail = 'admin-course@example.com';
  const adminPassword = 'admincourse123';
  const hash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.create({
    data: {
      name: 'Course Admin',
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
      name: 'Course Professor',
      email: 'prof-course@example.com',
      bio: 'Bio',
      profilePictureUrl: '',
    },
  });
  professorId = professor.id;
});

afterAll(async () => {
  await prisma.admin.deleteMany({
    where: { email: 'admin-course@example.com' },
  });
  await prisma.professor.deleteMany({
    where: { email: 'prof-course@example.com' },
  });
  await prisma.course.deleteMany({ where: { title: 'Test Course' } });
  await prisma.$disconnect();
});

describe('Course Routes', () => {
  it('should create a course', async () => {
    const res = await request(app)
      .post('/course')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Course',
        description: 'A test course',
        professorId,
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Course');
    courseId = res.body.id;
  });

  it('should list all courses', async () => {
    const res = await request(app)
      .get('/course')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should get course by id', async () => {
    const res = await request(app)
      .get(`/course/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(courseId);
  });

  it('should update a course', async () => {
    const res = await request(app)
      .put(`/course/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Course', description: 'Updated', professorId });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Course');
  });

  it('should delete a course', async () => {
    const res = await request(app)
      .delete(`/course/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204, 404]).toContain(res.status);
  });
});
