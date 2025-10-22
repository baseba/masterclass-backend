import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// List users (with optional role filter)
router.get("/", async (req, res) => {
  const { role } = req.query;
  try {
    const where = role ? { role: (role as string) as Role } : undefined;
    const users = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to list users", error: err });
  }
});

// Get user
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, phone: true, bio: true, profilePictureUrl: true, createdAt: true } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user", error: err });
  }
});

// Create user
router.post("/", async (req, res) => {
  try {
    const { name, email, passwordHash, role = Role.student, phone, bio, profilePictureUrl } = req.body;
    if (!name || !email) return res.status(400).json({ message: "name and email required" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const user = await prisma.user.create({ data: { name, email, passwordHash, role, phone, bio, profilePictureUrl } });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to create user", error: err });
  }
});

// Update user
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const { name, phone, bio, profilePictureUrl, role } = req.body;
    const user = await prisma.user.update({ where: { id }, data: { name, phone, bio, profilePictureUrl, role } });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update user", error: err });
  }
});

// Delete user
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user", error: err });
  }
});

export default router;
