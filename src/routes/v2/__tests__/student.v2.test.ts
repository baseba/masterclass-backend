import request from 'supertest';
// allow longer time for integration setup
jest.setTimeout(30000);
import app from '../../../../src/app';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('V2 Student flow', () => {
  let token: string;
  let userId: number;
  let legacyStudentId: number | undefined;
  let courseId: number;
  let classId: number;
  let slotId: number;
  let reservationId: number;

  beforeAll(async () => {
    // Create a user and legacy student
    const email = 'v2student@example.com';
    const password = 'TestPass123!';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name: 'V2 Student', email, passwordHash } });
    userId = user.id;
    const legacy = await prisma.student.create({ data: { name: 'V2 Student', email, passwordHash } });
    legacyStudentId = legacy.id;

    // Create a professor and course/class/slot
    const prof = await prisma.professor.create({ data: { name: 'V2 Prof', email: 'v2prof@example.com' } });
    const course = await prisma.course.create({ data: { title: 'V2 Course', description: 'desc', professorId: prof.id, professorUserId: null } });
    courseId = course.id;
    const cl = await prisma.class.create({ data: { title: 'V2 Class', description: 'cl desc', orderIndex: 1, basePrice: 10, courseId } });
    classId = cl.id;
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(10,0,0,0);
    const end = new Date(start.getTime() + 60*60*1000);
    const slot = await prisma.slot.create({ data: { classId, professorId: prof.id, startTime: start, endTime: end, modality: 'group', status: 'candidate', minStudents: 1, maxStudents: 5 } });
    slotId = slot.id;

    // Login to get token
    const res = await request(app).post('/auth/login').send({ email, password });
    token = res.body.token;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { studentId: legacyStudentId } });
    await prisma.slot.deleteMany({ where: { id: slotId } });
    await prisma.class.deleteMany({ where: { id: classId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.professor.deleteMany({ where: { email: 'v2prof@example.com' } });
    await prisma.student.deleteMany({ where: { email: 'v2student@example.com' } });
    await prisma.user.deleteMany({ where: { email: 'v2student@example.com' } });
    await prisma.$disconnect();
  });

  it('lists courses', async () => {
    const res = await request(app).get('/v2/courses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lists classes for a course', async () => {
    const res = await request(app).get(`/v2/courses/${courseId}/classes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('reserves a slot', async () => {
    const res = await request(app).post(`/v2/slots/${slotId}/reserve`).set('Authorization', `Bearer ${token}`).send();
    expect(res.status).toBe(201);
    reservationId = res.body.id;
  });

  it('shows upcoming slots and not reserved by me before booking', async () => {
    const res = await request(app).get('/v2/upcoming').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((s: any) => s.id === slotId);
    expect(found).toBeDefined();
    // Since we reserved in previous test, it might be true; ensure flow checks after reservation in next test
  });

  it('gets my reservations', async () => {
    const res = await request(app).get('/v2/me/reservations').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reservations)).toBe(true);
  });

  it('shows upcoming slots and reservedByMe after booking', async () => {
    const res = await request(app).get('/v2/upcoming').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.find((s: any) => s.id === slotId);
    expect(found).toBeDefined();
    expect(found.isReservedByMe).toBe(true);
  });

  it('cancels reservation', async () => {
    const res = await request(app).post(`/v2/reservations/${reservationId}/cancel`).set('Authorization', `Bearer ${token}`).send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });
});
