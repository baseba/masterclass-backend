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
        const token = signConfirmationToken(student.email, (student as any).confirmed === true);
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
      if (!token)
        return res.status(400).send(renderHtml('Token is required', 'The confirmation token is missing.'));
      let payload: any;
      try {
        payload = verifyConfirmationToken(token);
      } catch (err) {
        return res
          .status(400)
          .send(renderHtml('Invalid or expired token', 'The confirmation token is invalid or has expired.'));
      }
      const email = payload.email;
      const student = await prisma.student.findUnique({ where: { email } });
      if (!student)
        return res.status(404).send(renderHtml('User not found', 'No account matches this confirmation token.'));
      await prisma.student.update({ where: { email }, data: { confirmed: true } } as any);
      // Optionally redirect to a frontend confirmation page
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const message = `Your account (${escapeHtml(email)}) has been confirmed.`;
      const continueLink = `https://www.salvaramos.cl/ingresar`;
      const salvaramosLink = `https://salvaramos.cl/auth/confirm?token=${encodeURIComponent(token)}`;
      const body = `${message} <p><a href="${escapeHtml(continueLink)}">Ir a la aplicación</a></p>`;
      return res.send(renderHtml('Account confirmed', body));
    } catch (err) {
      return res.status(500).send(renderHtml('Confirmation failed', 'An unexpected error occurred while confirming your account.'));
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

  function renderHtml(title: string, body: string) {
    return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7f8}
        .card{background:white;padding:24px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.08);max-width:520px}
        a{color:#0366d6}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${escapeHtml(title)}</h1>
        <p>${body}</p>
      </div>
    </body>
  </html>`;
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
