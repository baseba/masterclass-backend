import request from 'supertest';
import express from 'express';
import adminRouter from '../admin';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

describe('Admin Login', () => {
  let adminEmail = 'admin@example.com';
  let adminPassword = 'securepassword';

  beforeAll(async () => {
    // Create test admin
    const hash = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        name: 'Test Admin',
        email: adminEmail,
        passwordHash: hash,
      },
    });
  });

  afterAll(async () => {
    await prisma.admin.deleteMany({ where: { email: adminEmail } });
    await prisma.$disconnect();
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should fail with wrong password', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ email: adminEmail, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('should fail with non-existent email', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ email: 'notfound@example.com', password: adminPassword });
    expect(res.status).toBe(401);
  });
});
