import morgan from 'morgan';
import express from 'express';
import passport from 'passport';
import bodyParser from 'body-parser';
import cors from 'cors';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import professorRouter from './routes/professor/professors';
import courseRouter from './routes/course/courses';
import studentRouter from './routes/student/students';
import slotRouter from './controllers/slots.controller';
import reservationRouter from './controllers/reservations.controller';
import cronjobsController from './controllers/cronjobs.controller';
import authenticateJwt from './middleware/authenticateJwt';
import authenticateAdmin from './middleware/authenticateAdmin';
const allowedOrigins = [
  'http://localhost:4321',
  'https://masterclass-frontend.vercel.app',
  'https://www.salvaramos.cl',
];

const app = express();
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(passport.initialize());

// Redact sensitive data in request bodies before logging
const SENSITIVE_KEYS = new Set(
  [
    'password',
    'currentPassword',
    'newPassword',
    'passwordhash',
    'confirmed_password',
    'confirmpassword',
    'token',
    'authorization',
    'jwt',
    'secret',
    'apikey',
    'api_key',
  ].map((k) => k.toLowerCase())
);

function redactBody(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((v) => redactBody(v));
  if (input && typeof input === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>
    )) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower)) {
        obj[key] = '[REDACTED]';
      } else {
        obj[key] = redactBody(value);
      }
    }
    return obj;
  }
  return input;
}

morgan.token('body', (req: any) => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return '';
  try {
    const redacted = redactBody(req.body);
    return 'body: ' + JSON.stringify(redacted);
  } catch {
    return 'body: [unserializable]';
  }
});

app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms :body')
);

app.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    serverStatus: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
  });
});

app.use('/auth', authRouter);

app.use(authenticateJwt);
app.use('/professors', professorRouter);
app.use('/courses', courseRouter);
app.use('/students', studentRouter);
app.use('/slots', slotRouter);
app.use('/reservations', reservationRouter);
app.use('/cron', cronjobsController);

app.use(authenticateAdmin);

app.use('/admin', adminRouter);

export default app;
