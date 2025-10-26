import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { User } from '../types';

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (
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
