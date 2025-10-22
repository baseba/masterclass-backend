import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import authenticateAdmin from '../../middleware/authenticateAdmin';

const prisma = new PrismaClient();
const router = Router();

// Admin: list all users (students, professors, admins)
router.get('/all-users', async (req, res) => {
  try {
    const [students, professors, admins] = await Promise.all([
      prisma.student.findMany(),
      prisma.professor.findMany(),
      prisma.admin.findMany(),
    ]);

    // Remove sensitive fields
    const safeStudents = students.map((s: any) => {
      const { passwordHash, ...rest } = s;
      return rest;
    });
    const safeAdmins = admins.map((a: any) => {
      const { passwordHash, ...rest } = a;
      return rest;
    });

    res.json({ students: safeStudents, professors, admins: safeAdmins });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch users', error: err });
  }
});

// List professors
router.get('/', authenticateAdmin, async (req, res) => {
  const professors = await prisma.professor.findMany();
  res.json(professors);
});

// Get professor by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  const professor = await prisma.professor.findUnique({ where: { id: Number(req.params.id) } });
  if (!professor) return res.status(404).json({ message: 'Professor not found' });
  res.json(professor);
});

// Promote student to professor
router.post('/promote/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  // Check if already a professor
  const existingProfessor = await prisma.professor.findUnique({ where: { email: student.email } });
  if (existingProfessor) return res.status(409).json({ message: 'Student is already a professor' });

  // Create professor from student
  const professor = await prisma.professor.create({
    data: {
      name: student.name,
      email: student.email,
      bio: '',
      profilePictureUrl: '',
    },
  });
  res.status(201).json(professor);
});


// demote professor to student
router.post('/demote/:professorId', authenticateAdmin, async (req, res) => {
  const professorId = Number(req.params.professorId);
  const professor = await prisma.professor.findUnique({ where: { id: professorId } });
  if (!professor) return res.status(404).json({ message: 'Professor not found' });

  // Check if a student with the same email already exists
  const existingStudent = await prisma.student.findUnique({ where: { email: professor.email } });
  if (existingStudent) return res.status(409).json({ message: 'A student with this email already exists' });

  // Create student from professor
  const student = await prisma.student.create({
    data: {
      name: professor.name,
      email: professor.email,
      passwordHash: '', // Set a default or temporary password hash
      phone: '',
    },
  });

  // Delete the professor record
  await prisma.professor.delete({ where: { id: professorId } });

  res.status(200).json({ message: 'Professor demoted to student', student });
});
export default router;
