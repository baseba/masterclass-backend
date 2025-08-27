
import express from 'express';
import passport from 'passport';
import bodyParser from 'body-parser';
import cors from 'cors';
import authRouter from './routes/auth';
import helloRouter from './routes/hello';
import authenticateJwt from './middleware/authenticateJwt';


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(passport.initialize());

app.use('/auth', authRouter);
app.use('/', helloRouter);

app.get('/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

app.get('/protected', authenticateJwt, (req, res) => {
  // @ts-ignore
  res.json({ message: `Hello ${req.user.email}` });
});

export default app;
