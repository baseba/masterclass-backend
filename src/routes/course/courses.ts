import sessionRouter from './sessions';
import { Router } from 'express';
import prisma from '../../prisma';
import authenticateAdmin from '../../middleware/authenticateAdmin';
import authenticateJwt from '../../middleware/authenticateJwt';

// ...existing code...
const router = Router();
// Mount session routes under each course
router.use('/:courseId/sessions', sessionRouter);

// Reutilizable include config for courses with nested data
const courseInclude = {
  professors: true,
  classes: {
    include: {
      slots: {
        include: {
          reservations: true,
        },
      },
    },
  },
};

// Get courses for the authenticated user
router.get('/me', authenticateJwt, async (req, res) => {
  try {
    const studentId = (req.user as any)?.id;
    if (!studentId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Find all courses where the student has a reservation in any slot of any class in the course
    const studentCourses = await prisma.course.findMany({
      where: {
        classes: {
          some: {
            slots: {
              some: {
                reservations: {
                  some: { studentId },
                },
              },
            },
          },
        },
      },
      include: courseInclude,
    });

    return res.json(studentCourses);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching courses', error: err });
  }
});

router.get('/:id', authenticateJwt, async (req, res) => {
  try {
    const studentId = (req.user as any)?.id;
    if (!studentId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const studentCourses = await prisma.course.findUnique({
      where: {
        id: Number(req.params.id),
        classes: {
          some: {
            slots: {
              some: {
                reservations: {
                  some: { studentId },
                },
              },
            },
          },
        },
      },
      include: courseInclude,
    });

    return res.json(studentCourses);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching courses', error: err });
  }
});

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
      include: courseInclude,
    });
    return res.json(studentCourses);
  }
  const courses = await prisma.course.findMany({
    include: courseInclude,
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
      include: courseInclude,
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
