import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admins
  const admins = [
    { name: "Demo Admin", email: "admin@demo.com", password: "admin123" },
    { name: "Admin 2", email: "admin2@demo.com", password: "admin456" },
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
      console.log("Admin user created:", {
        email: admin.email,
        password: admin.password,
      });
    }
  }

  // Students
  const studentsData = [
    {
      name: "Demo Student",
      email: "student@demo.com",
      password: "student123",
      phone: "1234567890",
    },
    {
      name: "Student 2",
      email: "student2@demo.com",
      password: "student456",
      phone: "2345678901",
    },
    {
      name: "Student 3",
      email: "student3@demo.com",
      password: "student789",
      phone: "3456789012",
    },
    {
      name: "Student 4",
      email: "student4@demo.com",
      password: "student101",
      phone: "4567890123",
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
        },
      });
      console.log("Student user created:", {
        email: student.email,
        password: student.password,
      });
    }
    students.push(existing);
  }

  // Professors
  const professorsData = [
    {
      name: "Demo Professor",
      email: "professor@demo.com",
      bio: "Demo professor bio",
      profilePictureUrl: "",
    },
    {
      name: "Professor 2",
      email: "prof2@demo.com",
      bio: "Bio 2",
      profilePictureUrl: "",
    },
    {
      name: "Professor 3",
      email: "prof3@demo.com",
      bio: "Bio 3",
      profilePictureUrl: "",
    },
    {
      name: "Professor 4",
      email: "prof4@demo.com",
      bio: "Bio 4",
      profilePictureUrl: "",
    },
  ];
  const professors: Array<{
    id: number;
    email: string;
    name: string;
    bio: string | null;
    profilePictureUrl: string | null;
  }> = [];
  for (const prof of professorsData) {
    let existing = await prisma.professor.findUnique({
      where: { email: prof.email },
    });
    if (!existing) {
      existing = await prisma.professor.create({ data: prof });
      console.log("Professor user created:", { email: prof.email });
    }
    professors.push(existing);
  }

  // Courses
  const coursesData = [
    {
      title: "Course 1",
      description: "Description 1",
      professorId: professors[0].id,
    },
    {
      title: "Course 2",
      description: "Description 2",
      professorId: professors[1].id,
    },
    {
      title: "Course 3",
      description: "Description 3",
      professorId: professors[2].id,
    },
    {
      title: "Course 4",
      description: "Description 4",
      professorId: professors[3].id,
    },
  ];
  const courses: Array<{
    id: number;
    professorId: number;
    title: string;
    description: string;
    isActive: boolean;
  }> = [];
  for (const course of coursesData) {
    let existing = await prisma.course.findFirst({
      where: { title: course.title, professorId: course.professorId },
    });
    if (!existing) {
      existing = await prisma.course.create({ data: course });
      console.log("Course created:", { title: course.title });
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
      for (const suffix of ["a", "b"]) {
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
          console.log("Class created:", { title });
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
    for (let k = 0; k < 2; k++) {
      // Generate random start time between 9:00 and 21:00 today
      const today = new Date();
      today.setHours(9, 0, 0, 0); // Set to 9:00
      const minHour = 9;
      const maxHour = 21; // Last slot starts at 21:00, ends at 22:00
      const randomHour =
        Math.floor(Math.random() * (maxHour - minHour + 1)) + minHour;
      const randomMinute = Math.floor(Math.random() * 60);
      const startTime = new Date(today);
      startTime.setHours(randomHour, randomMinute, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      const modality = k % 2 === 0 ? "group" : "private";
      const status = "candidate";
      const minStudents = 1;
      const maxStudents = 10;
      let existing = await prisma.slot.findFirst({
        where: { classId: classObj.id, startTime },
      });
      if (!existing) {
        existing = await prisma.slot.create({
          data: {
            classId: classObj.id,
            professorId: courses[Math.floor(i / 4)].professorId,
            startTime,
            endTime,
            modality,
            status,
            minStudents,
            maxStudents,
          },
        });
        console.log("Slot created:", { classId: classObj.id, startTime });
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
            status: "pending",
          },
        });
        console.log("Reservation created:", {
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
