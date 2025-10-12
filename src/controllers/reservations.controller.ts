import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import authenticateJwt from "../middleware/authenticateJwt";

const prisma = new PrismaClient();
const router = Router();

// Create reservation
router.post("/", authenticateJwt, async (req, res) => {
  const { slotId, studentId, status, paymentId } = req.body;
  try {
    const reservation = await prisma.reservation.create({
      data: { slotId, studentId, status, paymentId },
    });
    res.status(201).json(reservation);
  } catch (err) {
    res.status(400).json({ message: "Could not create reservation", error: err });
  }
});

// Get all reservations
router.get("/", async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: { slot: true, student: true, payment: true },
    });
    res.json(reservations);
  } catch (err) {
    res.status(400).json({ message: "Could not retrieve reservations", error: err });
  }
});

// Get reservation by id
router.get("/:id", authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { slot: true, student: true, payment: true },
  });
  if (!reservation) return res.status(404).json({ message: "Reservation not found" });
  res.json(reservation);
});

// Update reservation
router.put("/:id", authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const { slotId, studentId, status, paymentId } = req.body;
  try {
    const reservation = await prisma.reservation.update({
      where: { id },
      data: { slotId, studentId, status, paymentId },
    });
    res.json(reservation);
  } catch (err) {
    res.status(400).json({ message: "Could not update reservation", error: err });
  }
});

// Delete reservation
router.delete("/:id", authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.reservation.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ message: "Could not delete reservation", error: err });
  }
});

export default router;
