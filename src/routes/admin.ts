import { Router } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import { signJwt } from '../utils/jwt';
import {
  coursesAdminController,
  paymentsAdminController,
  dashboardAdminController,
  pricingPlansAdminController,
} from '../controllers/admin';

const router = Router();

// Admin login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signJwt(admin, 'admin');
  res.json({ token });
});

router.use('/dashboard', dashboardAdminController);
router.use('/courses', coursesAdminController);
router.use('/payments', paymentsAdminController);
router.use('/pricing-plans', pricingPlansAdminController);

export default router;
