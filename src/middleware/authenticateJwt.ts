import passport from './passport';
import { Request, Response, NextFunction } from 'express';

const authenticateJwt = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: unknown, user: Express.User | false | undefined) => {
    if (err || !user) {
      return res.status(409).json({ message: 'Unauthorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

export default authenticateJwt;
