import { Router } from 'express';
import passport from '../middleware/passport';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { signJwt } from '../utils/jwt';
import { User, AuthPayload } from '../types';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, rut } = req.body;

    if (!email || !password || !rut)
      return res
        .status(400)
        .json({ message: 'Email, password and RUT required' });

    const existing = await prisma.student.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({
      data: { email, passwordHash: hash, name: email, rut: rut },
    });
    const { passwordHash: _, ...studentInfo } = student;
    res.status(201).json(studentInfo);
  } catch (err) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate(
    'local',
    { session: false },
    (
      err: unknown,
      student: any | false | undefined,
      info: { message?: string } | undefined
    ) => {
      if (err || !student)
        return res
          .status(401)
          .json({ message: info?.message || 'Login failed' });
      const token = signJwt(student, 'user');
      res.json({ token });
    }
  )(req, res, next);
});

router.get(
  '/validate',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json({
      success: true,
      message: 'Token válido',
      user: req.user, // Passport lo agrega automáticamente
    });
  }
);

export default router;
