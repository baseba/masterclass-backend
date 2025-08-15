import { Router } from 'express';
import passport from '../middleware/passport';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { signJwt } from '../utils/jwt';
import { User, AuthPayload } from '../types';

const prisma = new PrismaClient();
const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash } });
    const { password: _, ...userInfo } = user;
    res.status(201).json(userInfo);

  } catch (err) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err: unknown, user: User | false | undefined, info: { message?: string } | undefined) => {
    if (err || !user) return res.status(401).json({ message: info?.message || 'Login failed' });
    const token = signJwt(user as User);
    res.json({ token });
  })(req, res, next);
});

export default router;
