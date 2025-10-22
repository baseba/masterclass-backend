import { Router } from 'express';
import prisma from '../../prisma';
import authenticateAdmin from '../../middleware/authenticateAdmin';

const router = Router();

// List professors
router.get('/', authenticateAdmin, async (req, res) => {
  const professors = await prisma.professor.findMany();
  res.json(professors);
});

// Get professor by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  const professor = await prisma.professor.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!professor)
    return res.status(404).json({ message: 'Professor not found' });
  res.json(professor);
});

// Promote student to professor
router.post('/promote/:studentId', authenticateAdmin, async (req, res) => {
  const studentId = Number(req.params.studentId);
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  // Check if already a professor
  const existingProfessor = await prisma.professor.findUnique({
    where: { email: student.email },
  });
  if (existingProfessor)
    return res.status(409).json({ message: 'Student is already a professor' });

  // Create professor from student
  const professor = await prisma.professor.create({
    data: {
      name: student.name,
      email: student.email,
      passwordHash: student.passwordHash,
      bio: '',
      profilePictureUrl: '',
      rut: student.rut,
    },
  });
  res.status(201).json(professor);
});

export default router;
