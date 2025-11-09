import { Router } from 'express';
import authenticateJwt from '../middleware/authenticateJwt';
import prisma from '../prisma';
import { sendMail } from '../utils/mailer';
import genTransactionRef from '../utils/createTransactionRef';
const router = Router();

// Create reservation
router.post('/', authenticateJwt, async (req, res) => {
  const studentId = (req.user as any)?.id;
  if (!studentId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { slotId } = req.body;

  if (!slotId) {
    return res.status(400).json({ message: 'slotId is required' });
  }

  let txResult = null;
  const slot = await prisma.slot.findUnique({
    where: { id: Number(slotId) },
    include: { class: true },
  });
  if (!slot) return res.status(404).json({ message: 'Slot not found' });

  const amount = slot.class?.basePrice ?? 0;
  txResult = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        studentId,
        amount,
        currency: 'CLP',
        status: 'pending',
        paymentProvider: 'manual',
        transactionReference: genTransactionRef(),
      },
    });

    const reservation = await tx.reservation.create({
      data: {
        slotId: Number(slotId),
        studentId,
        status: 'pending',
        paymentId: payment.id,
      },
    });

    return { payment, reservation };
  });

  res.status(201).json(txResult);
});

// Get all reservations
router.get('/', authenticateJwt, async (req, res) => {
  const reservations = await prisma.reservation.findMany({
    include: { slot: true, student: true, payment: true },
  });
  res.json(reservations);
});

// Get reservation by id
router.get('/:id', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { slot: true, student: true, payment: true },
  });
  if (!reservation)
    return res.status(404).json({ message: 'Reservation not found' });
  res.json(reservation);
});

// Update reservation
router.put('/:id', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const { slotId, studentId, status, paymentId } = req.body;
  try {
    // fetch previous reservation to detect status transitions
    const prevReservation = await prisma.reservation.findUnique({
      where: { id },
      include: { student: true, slot: { include: { class: true } } },
    });
    const prevStatus = prevReservation?.status;

    const reservation = await prisma.reservation.update({
      where: { id },
      data: { slotId, studentId, status, paymentId },
    });
    res.json(reservation);

    // check  the quantity of reservations for the slot
    const slotReservations = await prisma.reservation.count({
      where: { slotId: reservation.slotId, status: 'confirmed' },
    });
    const slot = await prisma.slot.findUnique({
      where: { id: reservation.slotId },
    });
    if (slotReservations > (slot?.maxStudents || 0)) {
      // If over capacity, revert the status change and notify
      await prisma.reservation.update({
        where: { id },
        data: { status: 'pending' },
      });
    }
    // if more than minimum and less than maximum, promote slot to confirmed
    if (
      slotReservations >= (slot?.minStudents || 0) &&
      slotReservations <= (slot?.maxStudents || 0)
    ) {
      await prisma.reservation.update({
        where: { id },
        data: { status: 'confirmed' },
      });
    }

    // After all potential status changes, fetch the final reservation and send email
    try {
      const final = await prisma.reservation.findUnique({
        where: { id },
        include: { student: true, slot: { include: { class: true } } },
      });
      const finalStatus = final?.status;
      const alreadyNotified = (final as any)?.notificationSentAt;
      if (
        final &&
        finalStatus === 'confirmed' &&
        prevStatus !== 'confirmed' &&
        !alreadyNotified
      ) {
        const student = final.student as any;
        const slot = (final.slot as any) || {};

        // Resolve meet link the same way cronjob does (ensureMeetLink may persist into slot.location)
        let resolvedMeetLink = slot.location || '';
        try {
          const meetUtil = await import('../utils/meet');
          resolvedMeetLink = await meetUtil.ensureMeetLink(slot);
        } catch (meetErr) {
          console.warn('Meet link resolution failed for reservation email, proceeding without link', (meetErr as any)?.message || meetErr);
        }

        const formatChile = (d: any) =>
          new Date(d).toLocaleString('es-CL', { timeZone: 'America/Santiago' });

        const subject = `Confirmación de reserva: ${slot.class?.title ?? ''}`;
        const when = slot.startTime ? formatChile(slot.startTime) : '';
        const text = `Hola ${student.name},\n\nTu reserva para la clase "${slot.class?.title ?? ''}" ha sido confirmada.\nFecha y hora: ${when}\n\nEnlace de la reunión: ${resolvedMeetLink || ''}\n\n¡Nos vemos en clase!`;

        const escapeHtml = (s: string) =>
          s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const urlHost = (() => {
          try {
            const u = new URL(resolvedMeetLink);
            return `${u.hostname}${u.pathname}`;
          } catch (e) {
            return resolvedMeetLink;
          }
        })();

        const html = `
          <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
            <h2 style="margin-bottom:6px;">${escapeHtml(slot.class?.title ?? 'Tu clase')}</h2>
            <p>Hola ${escapeHtml(student.name || 'Estudiante')},</p>
            <p>Tu reserva ha sido <strong>confirmada</strong> para el <strong>${escapeHtml(when)}</strong>.</p>
            <p>
              <a href="${escapeHtml(resolvedMeetLink)}" style="display:inline-block;padding:12px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Unirse a la reunión</a>
            </p>
            <p style="color:#6b7280;font-size:13px;">O ábrelo en tu navegador: <a href="${escapeHtml(resolvedMeetLink)}">${escapeHtml(urlHost)}</a></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />
            <p style="font-size:13px;color:#6b7280;">Si no puedes asistir, por favor cancela la reserva.</p>
            <p style="font-size:13px;color:#6b7280;">¡Nos vemos!</p>
          </div>
        `;

        const sendWithRetry = async (opts: any, attempts = 3) => {
          let lastErr: any = null;
          for (let i = 0; i < attempts; i++) {
            try {
              return await sendMail(opts);
            } catch (e) {
              lastErr = e;
              const delay = Math.pow(2, i) * 1000;
              // eslint-disable-next-line no-await-in-loop
              await new Promise((res) => setTimeout(res, delay));
            }
          }
          throw lastErr;
        };

        try {
          await sendWithRetry({ to: student.email, subject, text, html }, 3);
          // mark reservation as notified
          try {
            await prisma.reservation.update({
              where: { id },
              data: { notificationSentAt: new Date() } as any,
            });
          } catch (updateErr) {
            // ignore failure to mark notification
            console.warn(
              'Failed to set notificationSentAt for reservation',
              id,
              String(updateErr)
            );
          }
        } catch (mailErr) {
          console.warn(
            'Failed to send confirmation email for reservation',
            id,
            String(mailErr)
          );
        }
      }
    } catch (emailErr) {
      console.warn(
        'Error while preparing or sending confirmation email for reservation',
        id,
        String(emailErr)
      );
    }
    // if less than minimum, keep as pending
    return res.status(400).json({
      message: 'Reservation exceeds slot capacity. Status reverted to pending.',
    });
  } catch (err) {
    res

      .status(400)

      .json({ message: 'Could not update reservation', error: err });
  }
});

// Delete reservation
router.delete('/:id', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.reservation.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not delete reservation', error: err });
  }
});

export default router;
