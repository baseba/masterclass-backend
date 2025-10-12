import morgan from 'morgan';
import express from 'express';
import passport from 'passport';
import bodyParser from 'body-parser';
import cors from 'cors';
import authRouter from './routes/auth';
import helloRouter from './routes/hello';
import adminRouter from './routes/admin';
import professorRouter from './routes/professor/professors';
import courseRouter from './routes/course/courses';
import authenticateJwt from './middleware/authenticateJwt';
import slotRouter from './controllers/slots.controller';
import sessionRouter from './routes/course/sessions';

const allowedOrigins = ['http://localhost:4321'];

const app = express();
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(passport.initialize());
// Log body only for POST/PUT/PATCH
morgan.token('body', (req: any) => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return '';
  return 'body: ' + JSON.stringify(req.body);
});

app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms :body')
);

app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/professors', professorRouter);
app.use('/courses', courseRouter);
app.use('/slots', slotRouter);
app.use('/', helloRouter);

app.get('/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

app.get('/protected', authenticateJwt, (req, res) => {
  // @ts-ignore
  res.json({ message: `Hello ${req.user.email}` });
});

export default app;
