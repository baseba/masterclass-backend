import sessionRouter from './sessions';
import { Router } from 'express';
import prisma from '../../prisma';
import authenticateAdmin from '../../middleware/authenticateAdmin';

// ...existing code...
const router = Router();
// Mount session routes under each course
router.use('/:courseId/sessions', sessionRouter);

// List all courses
router.get('/', async (req, res) => {
  const { studentId } = req.query;
  if (studentId) {
    // Find all courses where the student has a reservation in any slot of any class in the course
    const studentCourses = await prisma.course.findMany({
      where: {
        classes: {
          some: {
            slots: {
              some: {
                reservations: {
                  some: { studentId: Number(studentId) },
                },
              },
            },
          },
        },
      },
      include: { professors: true, classes: true },
    });
    return res.json(studentCourses);
  }
  const courses = await prisma.course.findMany({
    include: { professors: true, classes: true },
  });
  res.json(courses);
});

// Get course by ID
router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Course ID is required' });
    }
    const course = await prisma.course.findUnique({
      where: { id: Number(req.params.id) },
      include: { professors: true, classes: true },
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(400).json(err);
  }
});

// Create a course and assign professor
router.post('/', authenticateAdmin, async (req, res) => {
  const { title, description, professorId, isActive } = req.body;
  if (!title || !professorId)
    return res.status(400).json({ message: 'Title and professorId required' });
  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        professors: { connect: { id: professorId } },
        isActive: isActive ?? true,
      },
    });
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: 'Could not create course', error: err });
  }
});

// Update a course
router.put('/:id', authenticateAdmin, async (req, res) => {
  const { title, description, professorId, isActive } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id: Number(req.params.id) },
      data: {
        title,
        description,
        professors: { connect: { id: professorId } },
        isActive,
      },
    });
    res.json(course);
  } catch (err) {
    res
      .status(404)
      .json({ message: 'Course not found or update failed', error: err });
  }
});

// Delete a course
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await prisma.course.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    res
      .status(404)
      .json({ message: 'Course not found or delete failed', error: err });
  }
});

export default router;
