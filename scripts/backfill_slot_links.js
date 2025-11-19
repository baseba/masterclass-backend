#!/usr/bin/env node
// Load environment variables like other scripts (e.g. trigger_twice.js)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Helpful diagnostic for connection issues
if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL not set in environment. Make sure .env exists or export DATABASE_URL.');
}

(async () => {
  const prisma = new PrismaClient();
  try {
    console.log('Finding slots with null link (raw SQL)...');
    // Use a raw query to find NULL links. The Prisma schema currently marks
    // `link` as non-nullable, so using the regular client `where: { link: null }`
    // triggers a validation error. Raw SQL bypasses that validation so we can
    // backfill the existing NULLs before making the column NOT NULL.
    const rows = await prisma.$queryRaw`SELECT id FROM "Slot" WHERE link IS NULL;`;
    const slots = Array.isArray(rows) ? rows.map(r => ({ id: r.id })) : [];
    console.log(`Found ${slots.length} slots to backfill.`);

    for (const s of slots) {
      const uuid = crypto.randomUUID();
      await prisma.slot.update({ where: { id: s.id }, data: { link: uuid } });
      console.log(`Backfilled slot ${s.id} -> ${uuid}`);
    }

    console.log('All slots backfilled. Setting column to NOT NULL.');
    await prisma.$executeRawUnsafe('ALTER TABLE "public"."Slot" ALTER COLUMN "link" SET NOT NULL;');
    console.log('Column set to NOT NULL.');

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
