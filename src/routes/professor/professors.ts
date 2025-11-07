import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../prisma';
import authenticateAdmin from '../../middleware/authenticateAdmin';

const router = Router();

function parsePagination(query: any) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 10));
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}

function buildProfessorWhere(query: any): any {
  const { q, email, rut, name } = query;
  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: String(q), mode: 'insensitive' } },
      { email: { contains: String(q), mode: 'insensitive' } },
      { rut: { contains: String(q), mode: 'insensitive' } },
      { bio: { contains: String(q), mode: 'insensitive' } },
    ];
  }
  if (email) where.email = { contains: String(email), mode: 'insensitive' };
  if (rut) where.rut = { contains: String(rut), mode: 'insensitive' };
  if (name) where.name = { contains: String(name), mode: 'insensitive' };
  return where;
}

// List professors with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildProfessorWhere(req.query);

    const [total, data] = await Promise.all([
      prisma.professor.count({ where }),
      prisma.professor.findMany({
        where,
        skip,
        take,
        orderBy: [{ id: 'desc' }],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          rut: true,
          bio: true,
          profilePictureUrl: true,
        },
      }),
    ]);

    res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list professors', error: err });
  }
});

// Get professor by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  const professor = await prisma.professor.findUnique({
    where: { id: Number(req.params.id) },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      rut: true,
      bio: true,
      profilePictureUrl: true,
    },
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

// Create professor (admin)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, rut, phone, bio, profilePictureUrl } =
      req.body as {
        name: string;
        email: string;
        password: string;
        rut: string;
        phone?: string;
        bio?: string;
        profilePictureUrl?: string;
      };

    if (!name || !email || !password || !rut) {
      return res
        .status(400)
        .json({ message: 'name, email, password and rut are required' });
    }

    const existing = await prisma.professor.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const professor = await prisma.professor.create({
      data: { name, email, passwordHash, rut, phone, bio, profilePictureUrl },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        rut: true,
        bio: true,
        profilePictureUrl: true,
      },
    });
    res.status(201).json(professor);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create professor', error: err });
  }
});

// Update professor (admin)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, password, rut, phone, bio, profilePictureUrl } =
      req.body as {
        name?: string;
        email?: string;
        password?: string;
        rut?: string;
        phone?: string;
        bio?: string;
        profilePictureUrl?: string;
      };

    const data: any = { name, email, rut, phone, bio, profilePictureUrl };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const professor = await prisma.professor.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        rut: true,
        bio: true,
        profilePictureUrl: true,
      },
    });
    res.json(professor);
  } catch (err) {
    res
      .status(404)
      .json({ message: 'Professor not found or update failed', error: err });
  }
});

// Delete professor (admin)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await prisma.professor.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    res
      .status(404)
      .json({ message: 'Professor not found or delete failed', error: err });
  }
});

export default router;
