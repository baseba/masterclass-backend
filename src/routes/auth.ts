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

    // Use the new User model for registration. Keep a legacy Student row for compatibility.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash: hash, name: req.body.name || email, role: 'student' } });

    // create legacy student row for compatibility if needed
    const existingStudent = await prisma.student.findUnique({ where: { email } });
    if (!existingStudent) {
      await prisma.student.create({ data: { email, passwordHash: hash, name: req.body.name || email } });
    }

    const { passwordHash: _, ...userInfo } = user as any;
    res.status(201).json(userInfo);

  } catch (err) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err: unknown, student: any | false | undefined, info: { message?: string } | undefined) => {
    if (err || !student) return res.status(401).json({ message: info?.message || 'Login failed' });
  // student is the user object from passport; pass its actual role if present
  const userRole = (student.role as 'student' | 'professor' | 'admin') || 'student';
  const token = signJwt(student, userRole);
    res.json({ token });
  })(req, res, next);
});

export default router;
