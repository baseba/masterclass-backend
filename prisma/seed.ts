import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin
  const adminEmail = 'admin@demo.com';
  const adminPassword = 'admin123';
  const adminName = 'Demo Admin';
  const adminExisting = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!adminExisting) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: adminPasswordHash,
      },
    });
    console.log('Admin user created:', { email: adminEmail, password: adminPassword });
  } else {
    console.log('Admin user already exists.');
  }

  // Student
  const studentEmail = 'student@demo.com';
  const studentPassword = 'student123';
  const studentName = 'Demo Student';
  const studentExisting = await prisma.student.findUnique({ where: { email: studentEmail } });
  if (!studentExisting) {
    const studentPasswordHash = await bcrypt.hash(studentPassword, 10);
    await prisma.student.create({
      data: {
        name: studentName,
        email: studentEmail,
        passwordHash: studentPasswordHash,
        phone: '1234567890',
      },
    });
    console.log('Student user created:', { email: studentEmail, password: studentPassword });
  } else {
    console.log('Student user already exists.');
  }

  // Professor
  const professorEmail = 'professor@demo.com';
  const professorName = 'Demo Professor';
  const professorExisting = await prisma.professor.findUnique({ where: { email: professorEmail } });
  if (!professorExisting) {
    await prisma.professor.create({
      data: {
        name: professorName,
        email: professorEmail,
        bio: 'Demo professor bio',
        profilePictureUrl: '',
      },
    });
    console.log('Professor user created:', { email: professorEmail });
  } else {
    console.log('Professor user already exists.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
