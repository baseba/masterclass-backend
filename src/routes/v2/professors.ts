import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import authenticateJwt from '../../middleware/authenticateJwt';

const prisma = new PrismaClient();
const router = Router();

// Create a new Class (professors only)
router.post('/classes', authenticateJwt, async (req, res) => {
  try {
    // @ts-ignore
    const user = req.user as any;
    if (!user || (user.role !== 'professor' && user.role !== 'admin')) {
      return res.status(403).json({ message: 'Forbidden: professor role required' });
    }

    const { courseId, title, description, objectives, orderIndex, basePrice } = req.body;
    if (!courseId || !title) return res.status(400).json({ message: 'courseId and title are required' });

    const course = await prisma.course.findUnique({ where: { id: Number(courseId) } });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // ensure the professor owns the course unless admin
    if (user.role !== 'admin') {
      // course may have professorUserId (migration) or legacy professorId
      if (!course.professorUserId || course.professorUserId !== user.id) {
        return res.status(403).json({ message: 'You are not the owner of this course' });
      }
    }

    const newClass = await prisma.class.create({ data: {
      courseId: Number(courseId),
      title,
      description: description || '',
      objectives: objectives || null,
      orderIndex: orderIndex ? Number(orderIndex) : 0,
      basePrice: basePrice ? Number(basePrice) : 0,
    }});

    res.status(201).json(newClass);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create class', error: err });
  }
});

export default router;
