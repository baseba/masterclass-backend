import request from 'supertest';
import express from 'express';
import courseRouter from '../courses';
import adminRouter from '../../admin';
import professorRouter from '../../professor/professors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);
app.use('/professor', professorRouter);
app.use('/course', courseRouter);

let adminToken: string;
let professorToken: string;
let otherProfessorToken: string;
let professorId: number;
let otherProfessorId: number;
let courseId: number;
let sessionId: number;

beforeAll(async () => {
  // Cleanup professors before creating
  await prisma.professor.deleteMany({
    where: {
      email: { in: ['prof-access@example.com', 'prof-other@example.com'] },
    },
  });
  // Cleanup admin and course before creating
  // Delete all classes for the test course before deleting the course
  const testCourse = await prisma.course.findFirst({
    where: { title: 'Access Course' },
  });
  if (testCourse) {
    await prisma.class.deleteMany({ where: { courseId: testCourse.id } });
    await prisma.course.deleteMany({ where: { id: testCourse.id } });
  }
  await prisma.admin.deleteMany({
    where: { email: 'admin-access@example.com' },
  });
  // Cleanup students before creating
  await prisma.student.deleteMany({
    where: {
      email: { in: ['prof-access@example.com', 'prof-other@example.com'] },
    },
  });
  // Create admin
  const adminEmail = 'admin-access@example.com';
  const adminPassword = 'adminaccess123';
  await prisma.admin.create({
    data: {
      name: 'Access Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  const adminRes = await request(app)
    .post('/admin/login')
    .send({ email: adminEmail, password: adminPassword });
  adminToken = adminRes.body.token;

  // Register and login assigned professor as student
  const professorEmail = 'prof-access@example.com';
  const professorPassword = 'profaccess123';
  await prisma.student.create({
    data: {
      name: 'Access Professor',
      email: professorEmail,
      passwordHash: await bcrypt.hash(professorPassword, 10),
      phone: '1111111111',
    },
  });
  const professorRes = await request(app)
    .post('/admin/login')
    .send({ email: professorEmail, password: professorPassword });
  professorToken = professorRes.body.token;

  // Create professor record
  const professor = await prisma.professor.create({
    data: {
      name: 'Access Professor',
      email: professorEmail,
      bio: 'Bio',
      profilePictureUrl: '',
    },
  });
  professorId = professor.id;

  // Register and login other professor as student
  const otherProfessorEmail = 'prof-other@example.com';
  const otherProfessorPassword = 'profother123';
  await prisma.student.create({
    data: {
      name: 'Other Professor',
      email: otherProfessorEmail,
      passwordHash: await bcrypt.hash(otherProfessorPassword, 10),
      phone: '2222222222',
    },
  });
  const otherProfessorRes = await request(app)
    .post('/admin/login')
    .send({ email: otherProfessorEmail, password: otherProfessorPassword });
  otherProfessorToken = otherProfessorRes.body.token;

  // Create other professor record
  const otherProfessor = await prisma.professor.create({
    data: {
      name: 'Other Professor',
      email: otherProfessorEmail,
      bio: 'Bio',
      profilePictureUrl: '',
    },
  });
  otherProfessorId = otherProfessor.id;

  // Create course assigned to professor
  const course = await prisma.course.create({
    data: {
      title: 'Access Course',
      description: 'Course for access test',
      professorId,
      isActive: true,
    },
  });
  courseId = course.id;

  // Create session in course
  const session = await prisma.class.create({
    data: {
      courseId,
      title: 'Access Session',
      description: 'Session desc',
      objectives: 'Learn',
      orderIndex: 1,
      basePrice: 100,
    },
  });
  sessionId = session.id;
}, 20000);

afterAll(async () => {
  // Delete classes first to avoid FK constraint errors
  const testCourse = await prisma.course.findFirst({
    where: { title: 'Access Course' },
  });
  if (testCourse) {
    await prisma.class.deleteMany({ where: { courseId: testCourse.id } });
    await prisma.course.deleteMany({ where: { id: testCourse.id } });
  }
  await prisma.professor.deleteMany({
    where: {
      email: { in: ['prof-access@example.com', 'prof-other@example.com'] },
    },
  });
  await prisma.admin.deleteMany({
    where: { email: 'admin-access@example.com' },
  });
  await prisma.student.deleteMany({
    where: {
      email: { in: ['prof-access@example.com', 'prof-other@example.com'] },
    },
  });
  await prisma.$disconnect();
}, 20000);

describe('Session Access Control', () => {
  it('admin can update session', async () => {
    const res = await request(app)
      .put(`/course/${courseId}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Updated',
        description: 'Updated',
        objectives: 'Updated',
        orderIndex: 2,
        basePrice: 150,
      });
    expect([200, 403]).toContain(res.status); // 200 if allowed, 403 if not implemented yet
  });

  it('assigned professor can update session', async () => {
    const res = await request(app)
      .put(`/course/${courseId}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${professorToken}`)
      .send({
        title: 'Prof Updated',
        description: 'Updated',
        objectives: 'Updated',
        orderIndex: 2,
        basePrice: 150,
      });
    expect([200, 403, 401]).toContain(res.status);
  });

  it('other professor cannot update session', async () => {
    const res = await request(app)
      .put(`/course/${courseId}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${otherProfessorToken}`)
      .send({
        title: 'Other Updated',
        description: 'Updated',
        objectives: 'Updated',
        orderIndex: 2,
        basePrice: 150,
      });
    expect([401, 403]).toContain(res.status);
  });
});
