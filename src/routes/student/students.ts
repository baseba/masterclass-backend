import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../prisma';
import authenticateAdmin from '../../middleware/authenticateAdmin';
import { parsePagination } from '../../controllers/helpers/parsePagination';
const router = Router();

function buildStudentWhere(query: any): any {
  const { q, email, rut, name } = query;
  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: String(q), mode: 'insensitive' } },
      { email: { contains: String(q), mode: 'insensitive' } },
      { rut: { contains: String(q), mode: 'insensitive' } },
      { phone: { contains: String(q), mode: 'insensitive' } },
      { address: { contains: String(q), mode: 'insensitive' } },
    ];
  }
  if (email) where.email = { contains: String(email), mode: 'insensitive' };
  if (rut) where.rut = { contains: String(rut), mode: 'insensitive' };
  if (name) where.name = { contains: String(name), mode: 'insensitive' };
  return where;
}

// List students with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildStudentWhere(req.query);

    const [total, data] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
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
          address: true,
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
    res.status(500).json({ message: 'Failed to list students', error: err });
  }
});

// Get student by ID (admin)
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        rut: true,
        address: true,
      },
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch student', error: err });
  }
});

// Create student (admin)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, rut, phone, address } = req.body as {
      name: string;
      email: string;
      password: string;
      rut: string;
      phone?: string;
      address?: string;
    };

    if (!name || !email || !password || !rut) {
      return res
        .status(400)
        .json({ message: 'name, email, password and rut are required' });
    }

    const existing = await prisma.student.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({
      data: { name, email, passwordHash, rut, phone, address },
      select: {
        id: true,
        name: true,
        email: true,
        rut: true,
        phone: true,
        address: true,
      },
    });
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create student', error: err });
  }
});

// Update student (admin)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, password, rut, phone, address } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      rut?: string;
      phone?: string;
      address?: string;
    };

    const data: any = { name, email, rut, phone, address };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const student = await prisma.student.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        rut: true,
        phone: true,
        address: true,
      },
    });
    res.json(student);
  } catch (err) {
    res
      .status(404)
      .json({ message: 'Student not found or update failed', error: err });
  }
});

// Delete student (admin)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    res
      .status(404)
      .json({ message: 'Student not found or delete failed', error: err });
  }
});

export default router;
