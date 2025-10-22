import { Router } from "express";
import { PrismaClient, SlotModality } from "@prisma/client";
import authenticateJwt from "../../middleware/authenticateJwt";
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = Router();

// Helper: get current user id from req.user (set by authenticateJwt)
function currentUserId(req: any): number | null {
  // @ts-ignore
  return req.user?.id ?? null;
}

// 1) Ver todos los cursos
router.get("/courses", async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: { classes: true, professor: true, professorUser: true },
    });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Failed to list courses", error: err });
  }
});

// New: list upcoming slots for booking
// query: daysAhead (default 7)
router.get("/upcoming", async (req: any, res) => {
  try {
    const daysAhead = Number(req.query.daysAhead ?? 7);
    if (Number.isNaN(daysAhead) || daysAhead < 0) return res.status(400).json({ message: "Invalid daysAhead" });

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    // fetch slots in the window with class and course info
    const slots = await prisma.slot.findMany({
      where: { startTime: { gte: now, lt: end }, status: "candidate" },
      include: { class: { include: { course: true } } },
      orderBy: { startTime: 'asc' }
    });

    // For each slot get reservation count and whether current user reserved
    const slotIds = slots.map(s => s.id);
    const counts = await prisma.reservation.groupBy({ by: ['slotId'], where: { slotId: { in: slotIds }, status: 'pending' }, _count: { slotId: true } });
    const countsMap: Record<number, number> = {};
    for (const c of counts) countsMap[c.slotId] = c._count.slotId;

    // If a Bearer token is sent, attempt to decode it so we can detect "isReservedByMe" without forcing auth
    let currentUser: any = null;
    try {
      const auth = req.headers?.authorization as string | undefined;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_here');
        if (payload?.id) {
          // load user from db (to get email if needed)
          const u = await prisma.user.findUnique({ where: { id: payload.id } });
          if (u) currentUser = u;
        }
      }
    } catch (e) {
      // ignore invalid token and proceed as unauthenticated
      currentUser = null;
    }
    let userReservationMap: Record<number, boolean> = {};
    if (currentUser && currentUser.id) {
      const userRes = await prisma.reservation.findMany({ where: { slotId: { in: slotIds }, OR: [{ studentUserId: currentUser.id }, { student: { email: currentUser.email } }] } });
      for (const r of userRes) userReservationMap[r.slotId] = true;
    }

    const result = slots.map(s => ({
      id: s.id,
      classId: s.classId,
      classTitle: s.class?.title,
      courseId: s.class?.course?.id,
      courseTitle: s.class?.course?.title,
      startTime: s.startTime,
      endTime: s.endTime,
      modality: s.modality,
      status: s.status,
      maxStudents: s.maxStudents,
      reservedCount: countsMap[s.id] ?? 0,
      isReservedByMe: !!userReservationMap[s.id],
      available: s.maxStudents ? (countsMap[s.id] ?? 0) < s.maxStudents : true,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch upcoming slots', error: err });
  }
});

// 2) Ver todas las clases disponibles por curso
router.get("/courses/:courseId/classes", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(courseId))
      return res.status(400).json({ message: "Invalid courseId" });
    const classes = await prisma.class.findMany({
      where: { courseId },
      include: { slots: true },
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Failed to list classes", error: err });
  }
});

// 3) Reservar un slot en una clase
router.post(
  "/slots/:slotId/reserve",
  authenticateJwt,
  async (req: any, res) => {
    try {
      const slotId = Number(req.params.slotId);
      if (Number.isNaN(slotId))
        return res.status(400).json({ message: "Invalid slotId" });
      const userId = currentUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // find slot
      const slot = await prisma.slot.findUnique({ where: { id: slotId } });
      if (!slot) return res.status(404).json({ message: "Slot not found" });

      // check capacity for group slots
      if (slot.modality === SlotModality.group && slot.maxStudents) {
        const count = await prisma.reservation.count({
          where: { slotId, status: "pending" },
        });
        if (count >= slot.maxStudents)
          return res.status(409).json({ message: "Slot full" });
      }

      // create reservation linking legacy student and migrated user where possible
      // find legacy student for this user
      const legacyStudent = await prisma.student.findUnique({
        where: { email: req.user?.email },
      });

      // Prevent duplicate reservation by same user for the same slot (ignore cancelled reservations)
      const duplicateWhere: any = {
        slotId,
        status: { not: 'cancelled' },
        OR: [
          { studentUserId: userId },
        ],
      };
      if (legacyStudent) duplicateWhere.OR.push({ studentId: legacyStudent.id });
      const existingReservation = await prisma.reservation.findFirst({ where: duplicateWhere });
      if (existingReservation) return res.status(409).json({ message: 'You have already reserved this slot' });

      const data: any = {
        slotId,
        studentUserId: userId,
        status: "pending",
      };
      if (legacyStudent) data.studentId = legacyStudent.id;

      const reservation = await prisma.reservation.create({ data });
      res.status(201).json(reservation);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to create reservation", error: err });
    }
  }
);

// 4) Cancelar mi reserva de un slot
router.post(
  "/reservations/:reservationId/cancel",
  authenticateJwt,
  async (req: any, res) => {
    try {
      const reservationId = Number(req.params.reservationId);
      if (Number.isNaN(reservationId))
        return res.status(400).json({ message: "Invalid reservationId" });
      const userId = currentUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // ensure reservation belongs to user
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });
      if (!reservation)
        return res.status(404).json({ message: "Reservation not found" });
      const legacyForReqUser = await prisma.student.findUnique({
        where: { email: req.user?.email },
      });
      if (
        reservation.studentUserId !== userId &&
        reservation.studentId !== legacyForReqUser?.id
      )
        return res.status(403).json({ message: "Forbidden" });

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "cancelled" },
      });
      res.json(updated);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to cancel reservation", error: err });
    }
  }
);

// 5) Ver todas mis reservas y cursos a los que me he registrado
router.get("/me/reservations", authenticateJwt, async (req: any, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });


    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { studentUserId: userId },
          { student: { email: req.user?.email } },
        ],
      },
      include: { slot: { include: { class: { include: { course: true } } } } },
    });

    // derive unique courses from reservations
    const courseIds = new Set<number>();
    for (const r of reservations) {
      const courseId = r.slot?.class?.courseId;
      if (courseId) courseIds.add(courseId);
    }
    const courses = await prisma.course.findMany({
      where: { id: { in: Array.from(courseIds) } },
    });

    res.json({ reservations, courses });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch user reservations", error: err });
  }
});

export default router;
