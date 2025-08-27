import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@demo.com';
  const password = 'admin123';
  const name = 'Demo Admin';

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.admin.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });
  console.log('Admin user created:', { email, password });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
