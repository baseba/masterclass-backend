import { Router } from 'express';
import passport from '../middleware/passport';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { signJwt, signConfirmationToken, verifyConfirmationToken } from '../utils/jwt';
import { sendMail } from '../utils/mailer';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, rut, name } = req.body as {
      email: string;
      password: string;
      rut: string;
      name: string;
    };

    if (!email || !password || !rut || !name)
      return res
        .status(400)
        .json({ message: 'Email, password, RUT and name required' });

    const existing = await prisma.student.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({
      data: { email, passwordHash: hash, name: name, rut: rut },
    });
      const { passwordHash: _, ...studentInfo } = student as any;

      // Generate confirmation token and send confirmation email
      try {
        const token = signConfirmationToken(student.email);
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const confirmUrl = `${appUrl.replace(/\/$/, '')}/auth/confirm?token=${encodeURIComponent(
          token
        )}`;
        const subject = 'Confirma tu cuenta';
        const text = `Hola ${student.name || ''},\n\nPor favor confirma tu cuenta haciendo clic en el siguiente enlace: ${confirmUrl}\n\nSi no solicitaste esto, ignora este correo.`;
        const html = `<p>Hola ${escapeHtml(student.name || '')},</p>
  <p>Por favor confirma tu cuenta haciendo clic en el siguiente enlace:</p>
  <p><a href="${escapeHtml(confirmUrl)}">Confirmar cuenta</a></p>
  <p>Si no solicitaste esto, ignora este correo.</p>`;
        await sendMail({ to: student.email, subject, text, html });
      } catch (err) {
        // Log error but don't fail registration if email sending fails
        console.error('Failed to send confirmation email', err);
      }

      res.status(201).json(studentInfo);
  } catch (err) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

  // Confirm account endpoint
  router.get('/confirm', async (req, res) => {
    try {
      const token = String(req.query.token || '');
      if (!token) return res.status(400).json({ message: 'Token is required' });
      let payload: any;
      try {
        payload = verifyConfirmationToken(token);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      const email = payload.email;
      const student = await prisma.student.findUnique({ where: { email } });
      if (!student) return res.status(404).json({ message: 'User not found' });
    await (prisma as any).student.update({ where: { email }, data: { confirmed: true } });
      // Optionally redirect to a frontend confirmation page
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      return res.json({ message: 'Account confirmed', email });
    } catch (err) {
      return res.status(500).json({ message: 'Confirmation failed' });
    }
  });

  // Small helper to escape HTML in interpolation
  function escapeHtml(str: string) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
