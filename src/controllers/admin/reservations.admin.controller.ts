import { Router } from 'express';
import authenticateJwt from '../../middleware/authenticateJwt';
import authenticateAdmin from '../../middleware/authenticateAdmin';
import prisma from '../../prisma';
import genTransactionRef from '../../utils/createTransactionRef';
const router = Router();

router.use(authenticateJwt);
router.use(authenticateAdmin);

router.post('/', async (req, res) => {
  const { studentId, slotId, pricingPlanId } = req.body;
  if (!studentId) {
    return res.status(401).json({ message: 'Student ID is required' });
  }

  const student = await prisma.student.findUnique({
    where: { id: Number(studentId) },
  });

  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  if (!slotId) {
    return res.status(400).json({ message: 'Slot ID is required' });
  }

  if (!pricingPlanId) {
    return res.status(400).json({ message: 'Pricing Plan ID is required' });
  }

  let txResult = null;
  const slot = await prisma.slot.findUnique({
    where: { id: Number(slotId) },
    include: { class: true },
  });

  if (!slot) return res.status(404).json({ message: 'Slot not found' });

  const pricingPlan = await prisma.pricingPlan.findUnique({
    where: { id: Number(pricingPlanId) },
  });

  if (!pricingPlan) {
    return res.status(404).json({ message: 'Pricing Plan not found' });
  }

  const amount = pricingPlan.price;
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
        pricingPlanId: Number(pricingPlanId),
      },
    });

    return { payment, reservation };
  });

  res.status(201).json(txResult);
});

// Get all reservations
router.get('/', async (req, res) => {
  const reservations = await prisma.reservation.findMany({
    include: { slot: true, student: true, payment: true },
  });
  res.json(reservations);
});

// Get reservation by id
router.get('/:id', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
