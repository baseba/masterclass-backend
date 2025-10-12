import { PrismaClient, SlotStudentsGroup, SlotModality } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admins
  const admins = [
    { name: 'Demo Admin', email: 'admin@demo.com', password: 'admin123' },
    { name: 'Admin 2', email: 'admin2@demo.com', password: 'admin456' },
  ];
  for (const admin of admins) {
    const existing = await prisma.admin.findUnique({
      where: { email: admin.email },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      await prisma.admin.create({
        data: { name: admin.name, email: admin.email, passwordHash },
      });
      console.log('Admin user created:', {
        email: admin.email,
        password: admin.password,
      });
    }
  }

  // Students
  const studentsData = [
    {
      name: 'Demo Student',
      email: 'student@demo.com',
      password: 'student123',
      phone: '1234567890',
      rut: '12345678-9',
      address: '123 Main St',
    },
    {
      name: 'Student 2',
      email: 'student2@demo.com',
      password: 'student456',
      phone: '2345678901',
      rut: '98765432-1',
      address: '456 Elm St',
    },
    {
      name: 'Student 3',
      email: 'student3@demo.com',
      password: 'student789',
      phone: '3456789012',
      rut: '11223344-5',
      address: '789 Oak St',
    },
    {
      name: 'Student 4',
      email: 'student4@demo.com',
      password: 'student101',
      phone: '4567890123',
      rut: '55667788-0',
      address: '101 Pine St',
    },
  ];
  const students: Array<{
    id: number;
    email: string;
    name: string;
    passwordHash: string;
    phone: string | null;
  }> = [];
  for (const student of studentsData) {
    let existing = await prisma.student.findUnique({
      where: { email: student.email },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(student.password, 10);
      existing = await prisma.student.create({
        data: {
          name: student.name,
          email: student.email,
          passwordHash,
          phone: student.phone,
          rut: student.rut,
          address: student.address,
        },
      });
      console.log('Student user created:', {
        email: student.email,
        password: student.password,
      });
    }
    students.push(existing);
  }

  // Professors
  const professorsData = [
    {
      name: 'Demo Professor',
      email: 'professor@demo.com',
      password: 'professor123',
      bio: 'Demo professor bio',
      profilePictureUrl: '',
      rut: '12.345.678-9',
    },
    {
      name: 'Professor 2',
      email: 'prof2@demo.com',
      password: 'professor456',
      bio: 'Bio 2',
      profilePictureUrl: '',
      rut: '98.765.432-1',
    },
    {
      name: 'Professor 3',
      email: 'prof3@demo.com',
      password: 'professor789',
      bio: 'Bio 3',
      profilePictureUrl: '',
      rut: '11.223.344-5',
    },
    {
      name: 'Professor 4',
      email: 'prof4@demo.com',
      password: 'professor101',
      bio: 'Bio 4',
      profilePictureUrl: '',
      rut: '55.667.788-0',
    },
  ];
  const professors: Array<{
    id: number;
    email: string;
    name: string;
    bio: string | null;
    profilePictureUrl: string | null;
    rut: string | null;
  }> = [];
  for (const prof of professorsData) {
    let existing = await prisma.professor.findUnique({
      where: { email: prof.email },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        profilePictureUrl: true,
        rut: true,
      },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(prof.password, 10);
      const { password, ...profData } = prof;
      existing = await prisma.professor.create({
        data: { ...profData, passwordHash },
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          profilePictureUrl: true,
          rut: true,
        },
      });
      console.log('Professor user created:', { email: prof.email });
    }
    professors.push(existing);
  }

  // Courses
  const coursesData = [
    {
      title: 'Course 1',
      description: 'Description 1',
      professors: [professors[0], professors[1]], // 2 profesores
    },
    {
      title: 'Course 2',
      description: 'Description 2',
      professors: [], // sin profesor
    },
    {
      title: 'Course 3',
      description: 'Description 3',
      professors: [professors[2]], // 1 profesor
    },
    {
      title: 'Course 4',
      description: 'Description 4',
      professors: [professors[1], professors[3]], // 2 profesores
    },
    {
      title: 'Course 5',
      description: 'Description 5',
      professors: [], // sin profesor
    },
  ];
  const courses = [];
  for (const course of coursesData) {
    let existing = await prisma.course.findFirst({
      where: { title: course.title },
      include: { professors: true },
    });
    if (!existing) {
      existing = await prisma.course.create({
        data: {
          title: course.title,
          description: course.description,
          professors: course.professors.length
            ? {
                connect: course.professors.map((p) => ({ id: p.id })),
              }
            : undefined,
        },
        include: { professors: true },
      });
      console.log('Course created:', { title: course.title });
    }
    courses.push(existing);
  }

  // Classes
  const classes: Array<{
    id: number;
    title: string;
    description: string;
    courseId: number;
    objectives: string | null;
    orderIndex: number;
    basePrice: number;
  }> = [];
  for (const [i, course] of courses.entries()) {
    for (let j = 1; j <= 2; j++) {
      for (const suffix of ['a', 'b']) {
        const title = `Class ${i + 1}-${suffix}`;
        let existing = await prisma.class.findFirst({
          where: { title, courseId: course.id },
        });
        if (!existing) {
          existing = await prisma.class.create({
            data: {
              title,
              description: `Description for ${title}`,
              objectives: `Objectives for ${title}`,
              orderIndex: j,
              basePrice: 100 + i * 10 + j,
              courseId: course.id,
            },
          });
          console.log('Class created:', { title });
        }
        classes.push(existing);
      }
    }
  }

  // Slots
  const slots: Array<{
    id: number;
    professorId: number;
    classId: number;
    startTime: Date;
    endTime: Date;
    modality: string;
    status: string;
    minStudents: number | null;
    maxStudents: number;
  }> = [];
  for (const [i, classObj] of classes.entries()) {
    // Get the course for this class
    const course = courses.find((c) => c.id === classObj.courseId);
    // Only create slots if the course has at least one professor assigned
    if (!course || !course.professors || course.professors.length === 0)
      continue;

    for (let k = 0; k < 2; k++) {
      // Generate random start time between 9:00 and 21:00 today
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      // Pick a random day in the current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const randomDay = Math.floor(Math.random() * daysInMonth) + 1;
      const minHour = 9;
      const maxHour = 21;
      const randomHour =
        Math.floor(Math.random() * (maxHour - minHour + 1)) + minHour;
      const randomMinute = Math.floor(Math.random() * 60);
      const startTime = new Date(
        currentYear,
        currentMonth,
        randomDay,
        randomHour,
        randomMinute,
        0,
        0
      );
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      const modality = k % 2 === 0 ? SlotModality.remote : SlotModality.onsite;
      const studentsGroup =
        k % 3 === 0 ? SlotStudentsGroup.group : SlotStudentsGroup.private;
      const location = modality === SlotModality.remote ? 'online' : 'sala A1';
      const status = 'candidate';
      const minStudents = 1;
      const maxStudents = 10;
      // Pick a random professor from the course's professors
      const professorId =
        course.professors[Math.floor(Math.random() * course.professors.length)]
          .id;
      let existing = await prisma.slot.findFirst({
        where: { classId: classObj.id, startTime },
      });
      if (!existing) {
        existing = await prisma.slot.create({
          data: {
            classId: classObj.id,
            professorId,
            startTime,
            endTime,
            modality,
            studentsGroup,
            location,
            status,
            minStudents,
            maxStudents,
          },
        });
        console.log('Slot created:', { classId: classObj.id, startTime });
      }
      slots.push(existing);
    }
  }

  // Reservations
  for (const slot of slots) {
    for (const student of students) {
      let existing = await prisma.reservation.findFirst({
        where: { slotId: slot.id, studentId: student.id },
      });
      if (!existing) {
        existing = await prisma.reservation.create({
          data: {
            slotId: slot.id,
            studentId: student.id,
            status: 'pending',
          },
        });
        console.log('Reservation created:', {
          slotId: slot.id,
          studentId: student.id,
        });
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
