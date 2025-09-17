import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import authenticateJwt from '../../middleware/authenticateJwt';

const prisma = new PrismaClient();
const router = Router({ mergeParams: true });

// Access control middleware
async function sessionAccessControl(req: any, res: any, next: any) {
  const user = req.user;
  const courseId = Number(req.params.courseId);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  // Admins always allowed
  if (user.role === 'admin') return next();

  // Professors: check if user is assigned professor for the course
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return res.status(404).json({ message: 'Course not found' });
  const professor = await prisma.professor.findUnique({ where: { email: user.email } });
  if (professor && course.professorId === professor.id) return next();

  return res.status(403).json({ message: 'Forbidden' });
}

// Create session (class)
router.post('/', authenticateJwt, sessionAccessControl, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { title, description, objectives, orderIndex, basePrice } = req.body;
  try {
    const session = await prisma.class.create({
      data: { courseId, title, description, objectives, orderIndex, basePrice },
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ message: 'Could not create session', error: err });
  }
});

// List sessions in course
router.get('/', authenticateJwt, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const sessions = await prisma.class.findMany({ where: { courseId } });
  res.json(sessions);
});

// Get session by id
router.get('/:sessionId', authenticateJwt, sessionAccessControl, async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const session = await prisma.class.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json(session);
});

// Update session
router.put('/:sessionId', authenticateJwt, sessionAccessControl, async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const { title, description, objectives, orderIndex, basePrice } = req.body;
  try {
    const session = await prisma.class.update({
      where: { id: sessionId },
      data: { title, description, objectives, orderIndex, basePrice },
    });
    res.json(session);
  } catch (err) {
    res.status(404).json({ message: 'Session not found or update failed', error: err });
  }
});

// Delete session
router.delete('/:sessionId', authenticateJwt, sessionAccessControl, async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  try {
    await prisma.class.delete({ where: { id: sessionId } });
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ message: 'Session not found or delete failed', error: err });
  }
});

export default router;
