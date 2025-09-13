import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prismaSlot = new PrismaClient().slot;
const router = Router();

// CREATE
router.post("/", async (req, res) => {
  try {
    const slot = await prismaSlot.create({
      data: req.body,
    });
    res.status(201).json(slot);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// READ ALL
router.get("/", async (req, res) => {
  try {
    const slots = await prismaSlot.findMany();
    res.json(slots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// READ ONE
router.get("/:id", async (req, res) => {
  try {
    const slot = await prismaSlot.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    res.json(slot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const slot = await prismaSlot.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.json(slot);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await prismaSlot.delete({
      where: { id: Number(req.params.id) },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
