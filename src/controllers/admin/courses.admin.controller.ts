import { Router } from 'express';
import prisma from '../../prisma';
import { Prisma } from '@prisma/client';
import { parsePagination } from '../helpers/parsePagination';
const router = Router();

const fullCourseInclude = {
  professors: true,
  students: true,
  classes: {
    include: {
      slots: {
        include: {
          reservations: {
            include: { payment: true, student: true },
          },
        },
      },
      materials: true,
    },
  },
  _count: {
    select: { classes: true, students: true, professors: true },
  },
} as const;

// GET /admin/courses - consolidated index
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const [total, courses] = await Promise.all([
      prisma.course.count(),
      prisma.course.findMany({
        select: {
          id: true,
          title: true,
          acronym: true,
          description: true,
          isActive: true,
          _count: {
            select: { classes: true, students: true, professors: true },
          },
        },
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
    ]);

    const result = courses.map((c: (typeof courses)[number]) => ({
      id: c.id,
      title: c.title,
      acronym: c.acronym,
      description: c.description,
      isActive: c.isActive,
      classesCount: c._count.classes,
      studentsCount: c._count.students,
      professorsCount: c._count.professors,
    }));

    res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: result,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching courses', error: err });
  }
});

// GET /admin/courses/:id - full detail
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: fullCourseInclude,
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching course', error: err });
  }
});

// POST /admin/courses - create course
router.post('/', async (req, res) => {
  const {
    title,
    acronym,
    description,
    isActive = true,
    professorIds,
  } = req.body as {
    title?: string;
    acronym?: string;
    description?: string;
    isActive?: boolean;
    professorIds?: number[];
  };
  if (!title || !acronym) {
    return res.status(400).json({ message: 'title and acronym are required' });
  }
  try {
    const course = await prisma.course.create({
      data: {
        title,
        acronym,
        description: description ?? '',
        isActive,
        ...(professorIds && professorIds.length
          ? { professors: { connect: professorIds.map((id) => ({ id })) } }
          : {}),
      },
      include: fullCourseInclude,
    });
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: 'Could not create course', error: err });
  }
});

// PUT /admin/courses/:id - update course
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { title, acronym, description, isActive, professorIds } = req.body as {
    title?: string;
    acronym?: string;
    description?: string;
    isActive?: boolean;
    professorIds?: number[];
  };
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const data: any = { title, acronym, description, isActive };
    // Clean undefined keys
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    if (Array.isArray(professorIds)) {
      data.professors = {
        set: [], // reset all
        ...(professorIds.length
          ? { connect: professorIds.map((pid) => ({ id: pid })) }
          : {}),
      };
    }

    const course = await prisma.course.update({
      where: { id },
      data,
      include: fullCourseInclude,
    });
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: 'Could not update course', error: err });
  }
});

// DELETE /admin/courses/:id - delete course with cascade cleanup
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find classes -> slots -> reservations for the course and delete dependents first
      const classes = await tx.class.findMany({
        where: { courseId: id },
        select: { id: true, slots: { select: { id: true } } },
      });
      const slotIds = classes.flatMap(
        (c: { id: number; slots: { id: number }[] }) =>
          c.slots.map((s: { id: number }) => s.id)
      );
      if (slotIds.length) {
        await tx.reservation.deleteMany({ where: { slotId: { in: slotIds } } });
        await tx.slot.deleteMany({ where: { id: { in: slotIds } } });
      }
      const classIds = classes.map((c: { id: number }) => c.id);
      if (classIds.length) {
        await tx.material.deleteMany({ where: { classId: { in: classIds } } });
        await tx.class.deleteMany({ where: { id: { in: classIds } } });
      }
      // Disconnect M:N relations
      await tx.course.update({
        where: { id },
        data: { students: { set: [] }, professors: { set: [] } },
      });
      // Finally delete course
      await tx.course.delete({ where: { id } });
    });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: 'Could not delete course', error: err });
  }
});

// POST /admin/courses/:id/students - add student to course
router.post('/:id/students', async (req, res) => {
  const id = Number(req.params.id);
  const { studentId } = req.body as { studentId?: number };
  if (!studentId)
    return res.status(400).json({ message: 'studentId is required' });
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { students: { connect: { id: Number(studentId) } } },
      include: fullCourseInclude,
    });
    res.status(200).json(course);
  } catch (err) {
    res.status(400).json({ message: 'Could not add student', error: err });
  }
});

// DELETE /admin/courses/:id/students/:studentId - remove student from course and their reservations in this course
router.delete('/:id/students/:studentId', async (req, res) => {
  const id = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  if (Number.isNaN(id) || Number.isNaN(studentId))
    return res.status(400).json({ message: 'Invalid id' });
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find slot ids for this course
      const classes = await tx.class.findMany({
        where: { courseId: id },
        select: { slots: { select: { id: true } } },
      });
      const slotIds = classes.flatMap((c: { slots: { id: number }[] }) =>
        c.slots.map((s: { id: number }) => s.id)
      );
      if (slotIds.length) {
        await tx.reservation.deleteMany({
          where: { slotId: { in: slotIds }, studentId },
        });
      }
      // Disconnect from course
      await tx.course.update({
        where: { id },
        data: { students: { disconnect: { id: studentId } } },
      });
    });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: 'Could not remove student', error: err });
  }
});

// POST /admin/courses/:id/classes - add class to course
router.post('/:id/classes', async (req, res) => {
  const courseId = Number(req.params.id);
  const { title, description, objectives, orderIndex } = req.body as {
    title?: string;
    description?: string;
    objectives?: string;
    orderIndex?: number;
  };
  if (!title || orderIndex === undefined) {
    return res
      .status(400)
      .json({ message: 'title and orderIndex are required' });
  }
  try {
    const newClass = await prisma.class.create({
      data: {
        courseId,
        title,
        description: description ?? '',
        objectives,
        orderIndex,
      },
      include: { slots: true, materials: true },
    });
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ message: 'Could not create class', error: err });
  }
});

// DELETE /admin/courses/:id/classes/:classId - delete class and its slots/reservations
router.delete('/:id/classes/:classId', async (req, res) => {
  const classId = Number(req.params.classId);
  if (Number.isNaN(classId))
    return res.status(400).json({ message: 'Invalid classId' });
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const slots = await tx.slot.findMany({
        where: { classId },
        select: { id: true },
      });
      const slotIds = slots.map((s: { id: number }) => s.id);
      if (slotIds.length) {
        await tx.reservation.deleteMany({ where: { slotId: { in: slotIds } } });
        await tx.slot.deleteMany({ where: { id: { in: slotIds } } });
      }
      await tx.material.deleteMany({ where: { classId } });
      await tx.class.delete({ where: { id: classId } });
    });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: 'Could not delete class', error: err });
  }
});

// POST /admin/courses/:id/professors - assign professor to course
router.post('/:id/professors', async (req, res) => {
  const id = Number(req.params.id);
  const { professorId } = req.body as { professorId?: number };
  if (!professorId)
    return res.status(400).json({ message: 'professorId is required' });
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { professors: { connect: { id: Number(professorId) } } },
      include: fullCourseInclude,
    });
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: 'Could not assign professor', error: err });
  }
});

// DELETE /admin/courses/:id/professors/:professorId - remove professor from course
router.delete('/:id/professors/:professorId', async (req, res) => {
  const id = Number(req.params.id);
  const professorId = Number(req.params.professorId);
  if (Number.isNaN(id) || Number.isNaN(professorId))
    return res.status(400).json({ message: 'Invalid id' });
  try {
    await prisma.course.update({
      where: { id },
      data: { professors: { disconnect: { id: professorId } } },
    });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: 'Could not remove professor', error: err });
  }
});

export default router;

// REMOVE student from a specific class (all reservations in that class)
router.delete(
  '/:courseId/classes/:classId/students/:studentId',
  async (req, res) => {
    const courseId = Number(req.params.courseId);
    const classId = Number(req.params.classId);
    const studentId = Number(req.params.studentId);
    if ([courseId, classId, studentId].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: 'Invalid ids' });
    }
    try {
      const cls = await prisma.class.findFirst({
        where: { id: classId, courseId },
      });
      if (!cls)
        return res.status(404).json({ message: 'Class not found in course' });
      const slots = await prisma.slot.findMany({
        where: { classId },
        select: { id: true },
      });
      const slotIds = slots.map((s) => s.id);
      if (slotIds.length) {
        await prisma.reservation.deleteMany({
          where: { slotId: { in: slotIds }, studentId },
        });
      }
      return res.status(204).send();
    } catch (err) {
      res
        .status(400)
        .json({ message: 'Could not remove student from class', error: err });
    }
  }
);

// REMOVE student from a specific slot (reservation)
router.delete(
  '/:courseId/slots/:slotId/students/:studentId',
  async (req, res) => {
    const courseId = Number(req.params.courseId);
    const slotId = Number(req.params.slotId);
    const studentId = Number(req.params.studentId);
    if ([courseId, slotId, studentId].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: 'Invalid ids' });
    }
    try {
      const slot = await prisma.slot.findUnique({
        include: { class: true },
        where: { id: slotId },
      });
      if (!slot || slot.class.courseId !== courseId) {
        return res.status(404).json({ message: 'Slot not found in course' });
      }
      await prisma.reservation.deleteMany({ where: { slotId, studentId } });
      return res.status(204).send();
    } catch (err) {
      res
        .status(400)
        .json({ message: 'Could not remove student from slot', error: err });
    }
  }
);
