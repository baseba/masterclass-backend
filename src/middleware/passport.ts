import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { User } from '../types';
import { signConfirmationToken } from '../utils/jwt';
import { sendMail } from '../utils/mailer';

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password', passReqToCallback: true },
    async (
      req: any,
      email: string,
      password: string,
      done: (error: any, user?: any, info?: any) => void
    ) => {
      try {
        const student = await prisma.student.findUnique({ where: { email } });
        if (!student) return done(null, false, { message: 'Incorrect email.' });
        // Ensure passwordHash is present (Prisma schema defines it as required,
        // but the generated types may still allow null in certain setups). Do
        // a runtime check to satisfy TypeScript and avoid passing null to
        // bcrypt.compare which expects a string.
        if (student.passwordHash == null)
          return done(null, false, { message: 'No password set for user.' });
        const valid = await bcrypt.compare(password, student.passwordHash);
        if (!valid)
          return done(null, false, { message: 'Incorrect password.' });
        // Ensure the user has confirmed their email
        if ((student as any).confirmed === false) {
          // Attempt to resend confirmation email when a user tries to login but
          // hasn't confirmed their account yet. Do not block the login flow on
          // email errors - just log them and return the informative message.
          try {
            const token = signConfirmationToken(student.email);
            const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
            const confirmUrl = `${appUrl.replace(/\/$/, '')}/auth/confirm?token=${encodeURIComponent(
              token
            )}`;
            const subject = 'Confirma tu cuenta';
            const text = `Hola ${student.name || ''},\n\nPor favor confirma tu cuenta usando este enlace: ${confirmUrl}\n\nSi no solicitaste esto, ignora este correo.`;
            const html = `<p>Hola ${escapeHtml(student.name || '')},</p><p>Por favor confirma tu cuenta usando este enlace:</p><p><a href="${escapeHtml(
              confirmUrl
            )}">Confirmar cuenta</a></p>`;
            await sendMail({ to: student.email, subject, text, html });
          } catch (err) {
            console.error('Failed to resend confirmation email on login attempt', err);
          }
          return done(null, false, {
            message:
              'Please confirm your email address. A confirmation link was (re)sent to your email.',
          });
        }
        return done(null, student);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_here',
    },
    async (
      payload: any,
      done: (error: any, user?: any, info?: any) => void
    ) => {
      try {
        if (payload.role === 'admin') {
          const admin = await prisma.admin.findUnique({
            where: { id: payload.id },
          });
          if (!admin) return done(null, false);
          return done(null, { ...admin, role: 'admin' });
        } else {
          const student = await prisma.student.findUnique({
            where: { id: payload.id },
          });
          if (!student) return done(null, false);
          return done(null, { ...student, role: 'user' });
        }
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

export default passport;
