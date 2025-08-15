import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { User } from '../types';

const prisma = new PrismaClient();

passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email: string, password: string, done: (error: any, user?: any, info?: any) => void) => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return done(null, false, { message: 'Incorrect email.' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return done(null, false, { message: 'Incorrect password.' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);


passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_here',
    },
    async (payload: any, done: (error: any, user?: any, info?: any) => void) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

export default passport;
