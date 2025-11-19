#!/usr/bin/env node
(async () => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    console.log('Connecting to DB and enabling pgcrypto extension...');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('pgcrypto extension ensured.');

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to enable pgcrypto:', err);
    process.exit(1);
  }
})();
