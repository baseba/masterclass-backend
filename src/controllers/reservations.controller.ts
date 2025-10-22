import { Router } from 'express';
import authenticateJwt from '../middleware/authenticateJwt';
import prisma from '../prisma';
const router = Router();

// Create reservation
router.post('/', authenticateJwt, async (req, res) => {
  const { slotId, studentId, status, paymentId } = req.body;
  try {
    const reservation = await prisma.reservation.create({
      data: { slotId, studentId, status, paymentId },
    });
    res.status(201).json(reservation);
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not create reservation', error: err });
  }
});

// Get all reservations
router.get('/', authenticateJwt, async (req, res) => {
  const reservations = await prisma.reservation.findMany({
    include: { slot: true, student: true, payment: true },
  });
  res.json(reservations);
});

// Get reservation by id
router.get('/:id', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { slot: true, student: true, payment: true },
  });
  if (!reservation)
    return res.status(404).json({ message: 'Reservation not found' });
  res.json(reservation);
});

// Update reservation
router.put('/:id', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const { slotId, studentId, status, paymentId } = req.body;
  try {
    const reservation = await prisma.reservation.update({
      where: { id },
      data: { slotId, studentId, status, paymentId },
    });
    res.json(reservation);

    // check  the quantity of reservations for the slot
    const slotReservations = await prisma.reservation.count({
      where: { slotId: reservation.slotId, status: 'confirmed' },
    });
    const slot = await prisma.slot.findUnique({
      where: { id: reservation.slotId },
    });
    if (slotReservations > (slot?.maxStudents || 0)) {
      // If over capacity, revert the status change and notify
      await prisma.reservation.update({
        where: { id },
        data: { status: 'pending' },
      });
    }
    // if more than minimum and less than maximum, promote slot to confirmed
    if (
      slotReservations >= (slot?.minStudents || 0) &&
      slotReservations <= (slot?.maxStudents || 0)
    ) {
      await prisma.reservation.update({
        where: { id },
        data: { status: 'confirmed' },
      });
    }
    // if less than minimum, keep as pending
    return res.status(400).json({
      message: 'Reservation exceeds slot capacity. Status reverted to pending.',
    });
  } catch (err) {
    res

      .status(400)

      .json({ message: 'Could not update reservation', error: err });
  }
});

// Delete reservation
router.delete('/:id', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.reservation.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not delete reservation', error: err });
  }
});

export default router;
