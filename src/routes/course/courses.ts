import sessionRouter from './sessions';
import { Router } from 'express';
import prisma from '../../prisma';
import authenticateAdmin from '../../middleware/authenticateAdmin';
import authenticateJwt from '../../middleware/authenticateJwt';
import genTransactionRef from '../../utils/createTransactionRef';

// ...existing code...
const router = Router();

// GET enrollment info (public)
router.get('/enroll', async (req, res) => {
  const { courseId, courseAcronym, slotId } = req.query;
  if (!courseAcronym && !courseId)
    return res
      .status(400)
      .json({ message: 'courseAcronym or courseId are required' });
  try {
    const whereClause = courseId
      ? { id: Number(courseId) }
      : { acronym: String(courseAcronym) };
    const course = await prisma.course.findFirst({
      where: whereClause,
      include: courseInclude,
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    let slot = null;
    if (slotId) {
      slot = await prisma.slot.findUnique({
        where: { id: Number(slotId) },
        include: { class: true },
      });

      if (!slot) {
        return res.status(404).json({ message: 'Slot not found' });
      }

      if (slot.class.courseId !== course.id) {
        return res
          .status(400)
          .json({ message: 'El slot no pertenece a este curso' });
      }
    }
    return res.status(200).json({ course, slot });
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Error fetching enrollment info', error: err });
  }
});

// Mount session routes under each course
router.use('/:courseId/sessions', sessionRouter);
router.get('/sessions', async (req, res) => {
  //get all sesions
  const sessions = await prisma.class.findMany();
  res.json(sessions);
});

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

    // const studentCourses = await prisma.course.findMany({
    //   where: {
    //     classes: {
    //       some: {
    //         slots: {
    //           some: {
    //             reservations: {
    //               some: { studentId },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    //   include: courseInclude,
    // });

    const studentCourses = await prisma.course.findMany({
      where: {
        students: {
          some: { id: studentId },
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

router.get('/:acronym/slots', async (req, res) => {
  try {
    const { acronym } = req.params;

    // Debugging log to check the received acronym
    console.log('Received acronym:', acronym);

    if (!acronym) {
      return res.status(400).json({ message: 'Course acronym is required' });
    }

    const course = await prisma.course.findFirst({
      where: {
        acronym: String(acronym),
      },
      select: {
        classes: {
          select: {
            title: true,
            slots: {
              include: {
                reservations: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      console.log('Course not found for acronym:', acronym); // Debugging log
      return res.status(404).json({ message: 'Course not found' });
    }

    // Filter out slots that are full
    course.classes = course.classes.map((cls: any) => ({
      ...cls,
      slots: (cls.slots || []).filter((slot: any) => {
        const max = slot.maxStudents ?? Infinity;
        const resCount = (slot.reservations || []).length;
        return resCount < max;
      }),
    }));

    res.json(course);
  } catch (err) {
    console.error('Error fetching slots for acronym:', req.params.acronym, err); // Debugging log
    res.status(500).json({ message: 'Error fetching slots', error: err });
  }
});

// Get course by ID
router.get('/:id', authenticateJwt, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!req.params.id) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    const studentId = user.id;
    const courseId = Number(req.params.id);

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        students: {
          some: { id: studentId },
        },
      },
      include: {
        professors: true,
        classes: {
          include: {
            slots: {
              where: {
                class: {
                  slots: {
                    every: {
                      reservations: {
                        none: { studentId },
                      },
                    },
                  },
                },
              },
              include: {
                reservations: {
                  where: { studentId },
                  include: { payment: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) return res.status(404).json({ message: 'Course not found' });

    res.json(course);
  } catch (err) {
    res.status(400).json(err);
  }
});

// Create a course and assign professor
router.post('/', authenticateAdmin, async (req, res) => {
  const { title, description, professorId, acronym, isActive } = req.body;
  if (!title || !professorId || !acronym)
    return res
      .status(400)
      .json({ message: 'Title, professorId and acronym are required' });
  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        acronym,
        professors: { connect: { id: professorId } },
        isActive: isActive ?? true,
      },
    });
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: 'Could not create course', error: err });
  }
});

// POST enrollment (authenticated)
router.post('/enroll', authenticateJwt, async (req, res) => {
  const studentId = (req.user as any)?.id;
  if (!studentId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  const { courseId, slotId } = req.body;
  if (!courseId)
    return res.status(400).json({ message: 'courseId is required' });
  try {
    const course = await prisma.course.findUnique({
      where: { id: Number(courseId) },
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        students: {
          connect: { id: studentId },
        },
      },
      include: courseInclude,
    });

    let txResult = null;

    if (slotId) {
      const slot = await prisma.slot.findUnique({
        where: { id: Number(slotId) },
        include: { class: true },
      });
      if (!slot) return res.status(404).json({ message: 'Slot not found' });

      const amount = slot.class?.basePrice ?? 0;
      txResult = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            studentId,
            amount,
            currency: 'CLP',
            status: 'pending',
            paymentProvider: 'manual',
            transactionReference: genTransactionRef(),
          },
        });

        const reservation = await tx.reservation.create({
          data: {
            slotId: Number(slotId),
            studentId,
            status: 'pending',
            paymentId: payment.id,
          },
        });

        return { payment, reservation };
      });
    }

    res.status(201).json({
      course: updatedCourse,
      ...(txResult && {
        payment: txResult.payment,
        reservation: txResult.reservation,
      }),
    });
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
