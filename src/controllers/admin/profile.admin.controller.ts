import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../prisma';
const router = Router();

router.get('/me', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const user = await prisma.admin.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        rut: true,
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve admin', error: err });
  }
});

router.put('/me', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, email, rut } = req.body as {
      name?: string;
      email?: string;
      rut?: string;
    };

    const data: any = { name, email, rut };

    const admin = await prisma.admin.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        rut: true,
      },
    });
    res.json(admin);
  } catch (err) {
    res
      .status(404)
      .json({ message: 'admin not found or update failed', error: err });
  }
});

export default router;
