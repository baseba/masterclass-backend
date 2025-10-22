/*
Migration script: scripts/migrate-to-user.js
- Copies Admin, Professor, Student into User model, merging by email (Admin > Professor > Student)
- Populates temporary FK columns course.professorUserId, slot.professorUserId, reservation.studentUserId, payment.studentUserId
- Outputs mapping files in ./tmp/user-mapping.json

Run this with: node scripts/migrate-to-user.js
Make sure DATABASE_URL is set to the target DB.
*/

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to User model...');

  // Fetch existing rows
  const [admins, professors, students] = await Promise.all([
    prisma.admin.findMany(),
    prisma.professor.findMany(),
    prisma.student.findMany(),
  ]);

  // Map by email
  const emailToUser = new Map();

  function ensureUserFromRecord(rec, rolePref) {
    if (!rec || !rec.email) return;
    const email = rec.email.toLowerCase();
    const existing = emailToUser.get(email) || null;
    if (!existing) {
      emailToUser.set(email, { role: rolePref, sources: [rec] });
    } else {
      // upgrade role if higher precedence
      const precedence = { admin: 3, professor: 2, student: 1 };
      if (precedence[rolePref] > precedence[existing.role]) existing.role = rolePref;
      existing.sources.push(rec);
    }
  }

  admins.forEach(a => ensureUserFromRecord(a, 'admin'));
  professors.forEach(p => ensureUserFromRecord(p, 'professor'));
  students.forEach(s => ensureUserFromRecord(s, 'student'));

  const emailList = Array.from(emailToUser.keys());
  console.log(`Creating ${emailList.length} users...`);

  const emailToNewUserId = {};

  for (const email of emailList) {
    const entry = emailToUser.get(email);
    // select best source by precedence
    const source = entry.sources.find(s => s.email && s.email.toLowerCase() === email);
    let name = source.name || source.email;
    let passwordHash = source.passwordHash || null;
    let bio = source.bio || null;
    let profilePictureUrl = source.profilePictureUrl || null;

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: entry.role,
        bio,
        profilePictureUrl,
      }
    });
    emailToNewUserId[email] = newUser.id;
  }

  // write mapping
  const mappingPath = './tmp/user-mapping.json';
  fs.mkdirSync('./tmp', { recursive: true });
  fs.writeFileSync(mappingPath, JSON.stringify(emailToNewUserId, null, 2));
  console.log(`Wrote mapping to ${mappingPath}`);

  // Update courses.professorUserId where possible
  const courses = await prisma.course.findMany();
  for (const c of courses) {
    const prof = await prisma.professor.findUnique({ where: { id: c.professorId } });
    if (prof && prof.email && emailToNewUserId[prof.email.toLowerCase()]) {
      await prisma.course.update({ where: { id: c.id }, data: { professorUserId: emailToNewUserId[prof.email.toLowerCase()] } });
    }
  }

  // Update slots.professorUserId
  const slots = await prisma.slot.findMany();
  for (const s of slots) {
    const prof = await prisma.professor.findUnique({ where: { id: s.professorId } });
    if (prof && prof.email && emailToNewUserId[prof.email.toLowerCase()]) {
      await prisma.slot.update({ where: { id: s.id }, data: { professorUserId: emailToNewUserId[prof.email.toLowerCase()] } });
    }
  }

  // Update reservations.studentUserId and payments.studentUserId
  const reservations = await prisma.reservation.findMany();
  for (const r of reservations) {
    const student = await prisma.student.findUnique({ where: { id: r.studentId } });
    if (student && student.email && emailToNewUserId[student.email.toLowerCase()]) {
      await prisma.reservation.update({ where: { id: r.id }, data: { studentUserId: emailToNewUserId[student.email.toLowerCase()] } });
    }
  }

  const payments = await prisma.payment.findMany();
  for (const p of payments) {
    const student = await prisma.student.findUnique({ where: { id: p.studentId } });
    if (student && student.email && emailToNewUserId[student.email.toLowerCase()]) {
      await prisma.payment.update({ where: { id: p.id }, data: { studentUserId: emailToNewUserId[student.email.toLowerCase()] } });
    }
  }

  console.log('Migration to User model completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
