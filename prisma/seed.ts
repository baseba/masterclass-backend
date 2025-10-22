import { PrismaClient, Role, SlotModality } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Standard password for seeded professor accounts (override with env var in CI/dev if needed)
const STANDARD_PROFESSOR_PASSWORD = process.env.PROFESSOR_SEED_PASSWORD || 'Professor1!';

function randomPhone(prefix = "+1") {
  const n = () => Math.floor(Math.random() * 9000000000) + 1000000000;
  return `${prefix}${n()}`;
}

async function main() {
  // We'll create unified Users and keep legacy tables populated for compatibility.

  // Admins / Users with role=admin
  const admins = [
    { name: "Ariadne Cortez", email: "admin@masterclass.dev", password: "AdminPass123!" },
    { name: "Marco Silva", email: "admin2@masterclass.dev", password: "AdminPass456!" },
  ];

  for (const a of admins) {
    const existingUser = await prisma.user.findUnique({ where: { email: a.email } });
    if (!existingUser) {
      const passwordHash = await bcrypt.hash(a.password, 10);
      await prisma.user.create({ data: { name: a.name, email: a.email, passwordHash, role: Role.admin } });
      console.log(`Created admin user: ${a.email}`);
    }
    // keep legacy Admin row for now
    const existingAdmin = await prisma.admin.findUnique({ where: { email: a.email } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(a.password, 10);
      await prisma.admin.create({ data: { name: a.name, email: a.email, passwordHash } });
    }
  }

  // Professors
  const professorsData = [
    { name: "Elena Rodriguez", email: "elena@masterclass.dev", password: "Professor1!", phone: randomPhone() },
    { name: "Dr. Kenji Watanabe", email: "kenji@masterclass.dev", password: "Professor1!", phone: randomPhone() },
    { name: "Amara N'diaye", email: "amara@masterclass.dev", password: "Professor1!", phone: randomPhone() },
  ];

  const professors: Array<any> = [];
  for (const prof of professorsData) {
    // create or reuse unified User
    let user = await prisma.user.findUnique({ where: { email: prof.email } });
    // follow students pattern: use prof.password from the data object
    const passwordToUse = prof.password;
    if (!user) {
      const passwordHash = await bcrypt.hash(passwordToUse, 10);
      user = await prisma.user.create({ data: { name: prof.name, email: prof.email, role: Role.professor, passwordHash, phone: prof.phone } });
      console.log(`Created user (professor): ${prof.email}`);
    } else if (!user.passwordHash) {
      const passwordHash = await bcrypt.hash(passwordToUse, 10);
      user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      console.log(`Backfilled password for existing user (professor): ${prof.email}`);
    }
    // legacy Professor row
    let legacy = await prisma.professor.findUnique({ where: { email: prof.email } });
    if (!legacy) {
      legacy = await prisma.professor.create({ data: { name: prof.name, email: prof.email } });
      console.log(`Created legacy Professor: ${prof.email}`);
    }
    professors.push({ user, legacy });
  }

  // write professor password mapping for dev usage
  try {
    const mapping: Record<string, string> = {};
    for (const [i, prof] of professorsData.entries()) {
      const email = prof.email;
      mapping[email] = prof.password;
    }
    const fs = require('fs');
    fs.mkdirSync('./tmp', { recursive: true });
    fs.writeFileSync('./tmp/professor-passwords.json', JSON.stringify(mapping, null, 2));
    console.log('Wrote ./tmp/professor-passwords.json (contains notes on passwords)');
  } catch (e) {
    console.warn('Could not write professor password mapping:', e);
  }

  // Students
  const studentsData = [
    { name: "Liam Murphy", email: "liam@student.dev", password: "Student1!", phone: randomPhone() },
    { name: "Sofia Patel", email: "sofia@student.dev", password: "Student2!", phone: randomPhone() },
    { name: "Noah Kim", email: "noah@student.dev", password: "Student3!", phone: randomPhone() },
  ];

  const students: Array<any> = [];
  for (const s of studentsData) {
    let user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(s.password, 10);
      user = await prisma.user.create({ data: { name: s.name, email: s.email, passwordHash, role: Role.student, phone: s.phone } });
      console.log(`Created user (student): ${s.email}`);
    }
    let legacy = await prisma.student.findUnique({ where: { email: s.email } });
    if (!legacy) {
      const passwordHash = await bcrypt.hash(s.password, 10);
      legacy = await prisma.student.create({ data: { name: s.name, email: s.email, passwordHash, phone: s.phone } });
      console.log(`Created legacy Student: ${s.email}`);
    }
    students.push({ user, legacy });
  }

  // Courses (associate both legacy professorId and professorUserId temporary FK)
  const coursesData = [
    { title: "Foundations of Piano", description: "Beginner to intermediate piano techniques.", professorIndex: 0 },
    { title: "Advanced Music Theory", description: "Harmonic analysis and arranging.", professorIndex: 1 },
    { title: "Vocal Performance Lab", description: "Stage presence, breath control, and repertoire.", professorIndex: 2 },
  ];

  const courses: Array<any> = [];
  for (const c of coursesData) {
    const prof = professors[c.professorIndex];
    let existing = await prisma.course.findFirst({ where: { title: c.title, professorId: prof.legacy.id } });
    if (!existing) {
      existing = await prisma.course.create({ data: { title: c.title, description: c.description, professorId: prof.legacy.id, professorUserId: prof.user.id } });
      console.log(`Created course: ${c.title}`);
    }
    courses.push(existing);
  }

  // Classes for each course
  const classes: Array<any> = [];
  for (const [i, course] of courses.entries()) {
    for (let j = 1; j <= 3; j++) {
      const title = `${course.title} — Session ${j}`;
      let existing = await prisma.class.findFirst({ where: { title, courseId: course.id } });
      if (!existing) {
        existing = await prisma.class.create({ data: { title, description: `In-depth session ${j} for ${course.title}`, objectives: `Objectives for ${title}`, orderIndex: j, basePrice: 49.99 + i * 10 + j, courseId: course.id } });
        console.log(`Created class: ${title}`);
      }
      classes.push(existing);
    }
  }

  // Slots: create a couple of slots per class with varied times and modalities
  const slots: Array<any> = [];
  for (const [i, classObj] of classes.entries()) {
    const profForCourse = await prisma.course.findUnique({ where: { id: classObj.courseId } });
    const professorUserId = profForCourse?.professorUserId ?? null;
    for (let k = 0; k < 2; k++) {
      const start = new Date();
      start.setDate(start.getDate() + i + k);
      start.setHours(9 + k * 3, 30, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const modality = k % 2 === 0 ? SlotModality.group : SlotModality.private;
      const status = "candidate";
      const minStudents = modality === SlotModality.group ? 2 : 1;
      const maxStudents = modality === SlotModality.group ? 12 : 1;

      let existing = await prisma.slot.findFirst({ where: { classId: classObj.id, startTime: start } });
      if (!existing) {
        existing = await prisma.slot.create({ data: { classId: classObj.id, professorId: (profForCourse?.professorId as number) || 0, professorUserId, startTime: start, endTime: end, modality, status, minStudents, maxStudents } });
        console.log(`Created slot for class ${classObj.id} at ${start.toISOString()}`);
      }
      slots.push(existing);
    }
  }

  // Reservations: make each student reserve the first slot of the first class
  if (slots.length > 0) {
    const firstSlot = slots[0];
    for (const s of students) {
      let existing = await prisma.reservation.findFirst({ where: { slotId: firstSlot.id, studentId: s.legacy.id } });
      if (!existing) {
        existing = await prisma.reservation.create({ data: { slotId: firstSlot.id, studentId: s.legacy.id, studentUserId: s.user.id, status: "pending" } });
        console.log(`Created reservation for student ${s.legacy.email} on slot ${firstSlot.id}`);
      }
    }
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
