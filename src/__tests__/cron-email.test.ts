import request from 'supertest';
import app from '../app';
import prisma from '../prisma';

jest.setTimeout(120000);

/**
 * Integration test that creates a slot for tomorrow and a confirmed reservation
 * for a test email, then triggers the cron endpoint to send the meet link.
 *
 * Requirements to run this test manually:
 * - Set environment variables: TEST_RECEIVE_EMAIL, CRON_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * - Optionally set MEET_PROVIDER=google and Google service account env vars if you want a Google Meet link.
 *
 * The test will be skipped if the required env vars are not present.
 */
describe('Cron job email integration', () => {
  const TEST_EMAIL = process.env.TEST_RECEIVE_EMAIL;
  const CRON_KEY = process.env.CRON_KEY;
  const SENDGRID_OK = Boolean(process.env.SENDGRID_API_KEY && TEST_EMAIL);

  let createdStudentId: number | null = null;
  let createdSlotId: number | null = null;
  let createdReservationId: number | null = null;

  beforeAll(async () => {
    if (!TEST_EMAIL) {
      console.warn(
        'Skipping email test: set TEST_RECEIVE_EMAIL env var to run it.'
      );
      return;
    }
    if (!CRON_KEY) {
      console.warn('Skipping email test: set CRON_KEY env var to run it.');
      return;
    }
    if (!SENDGRID_OK) {
      console.warn(
        'Skipping email test: SendGrid not configured (SENDGRID_API_KEY/TEST_RECEIVE_EMAIL).'
      );
      return;
    }
    // ensure there is at least one professor and one class to attach the slot to
    const professor = await prisma.professor.findFirst();
    const classObj = await prisma.class.findFirst();
    // ensure there is at least one professor and one class to attach the slot to
    // If missing, create minimal fixtures (professor -> course -> class)
    let prof = professor;
    if (!prof) {
      prof = await prisma.professor.create({
        data: {
          name: 'Test Prof',
          email: `prof+${Date.now()}@example.com`,
          passwordHash: 'test',
          rut: `prof-${Date.now()}`,
        },
      });
      // no cleanup for professors in this test to avoid interfering with other tests
    }

    let classObjLocal = classObj;
    if (!classObjLocal) {
      // create a course and connect the professor
      const course = await prisma.course.create({
        data: {
          title: `Test Course ${Date.now()}`,
          description: 'auto-created for test',
          professors: { connect: { id: prof.id } },
        },
      });
      classObjLocal = await prisma.class.create({
        data: {
          courseId: course.id,
          title: 'Test Class',
          description: 'auto',
          orderIndex: 1,
          basePrice: 0.0,
        },
      });
    }

    // create or find student with TEST_EMAIL
    let student = await prisma.student.findUnique({
      where: { email: TEST_EMAIL } as any,
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          name: 'Test Receiver',
          email: TEST_EMAIL,
          passwordHash: 'test',
          rut: `test-${Date.now()}`,
        },
      });
      createdStudentId = student.id;
    }

    // create a slot for tomorrow at 10:00 - 11:00
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 60 * 60 * 1000);

    const slot = await prisma.slot.create({
      data: {
        classId: classObjLocal.id,
        professorId: prof.id,
        startTime: tomorrow,
        endTime: end,
        modality: 'remote',
        studentsGroup: 'private',
        status: 'confirmed',
        maxStudents: 10,
      },
    });
    createdSlotId = slot.id;

    const reservation = await prisma.reservation.create({
      data: { studentId: student.id, slotId: slot.id, status: 'confirmed' },
    });
    createdReservationId = reservation.id;
  });

  afterAll(async () => {
    // cleanup created records
    if (createdReservationId) {
      await prisma.reservation.deleteMany({
        where: { id: createdReservationId } as any,
      });
    }
    if (createdSlotId) {
      await prisma.slot.deleteMany({ where: { id: createdSlotId } as any });
    }
    if (createdStudentId) {
      await prisma.student.deleteMany({
        where: { id: createdStudentId } as any,
      });
    }
  });

  it('invokes cron endpoint and returns a summary', async () => {
    if (!TEST_EMAIL || !CRON_KEY || !SENDGRID_OK) {
      return;
    }

    const res = await request(app)
      .post(`/cron/daily-job?key=${encodeURIComponent(CRON_KEY)}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    // print results for manual inspection
    console.log('Cron response:', JSON.stringify(res.body, null, 2));
    // Basic sanity: results should be an array and count >= 0
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});
