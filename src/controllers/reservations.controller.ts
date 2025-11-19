import { Router } from 'express';
import authenticateJwt from '../middleware/authenticateJwt';
import prisma from '../prisma';
import { sendMail } from '../utils/mailer';
import genTransactionRef from '../utils/createTransactionRef';
const router = Router();

router.get('/enroll', async (req, res) => {
  const { courseId, courseAcronym, slotId, pricingPlanId } = req.query;
  if (!courseAcronym && !courseId)
    return res
      .status(400)
      .json({ message: 'courseAcronym or courseId are required' });
  try {
    const whereClause = courseId
      ? { id: Number(courseId) }
      : { acronym: String(courseAcronym) };
    const course = await prisma.course.findFirst({
      where: whereClause,
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    let slot = null;
    if (slotId) {
      slot = await prisma.slot.findUnique({
        where: { id: Number(slotId) },
        include: { class: true },
      });
    }

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    if (slot.class.courseId !== course.id) {
      return res
        .status(400)
        .json({ message: 'El slot no pertenece a este curso' });
    }

    const pricingPlan = await prisma.pricingPlan.findUnique({
      where: { id: Number(pricingPlanId), isActive: true },
    });

    return res.status(200).json({ course, slot, pricingPlan });
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Error fetching enrollment info', error: err });
  }
});
// Create reservation
router.post('/', authenticateJwt, async (req, res) => {
  const studentId = (req.user as any)?.id;
  if (!studentId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { slotId, pricingPlanId } = req.body;

  if (!slotId) {
    return res.status(400).json({ message: 'slotId is required' });
  }

  if (!pricingPlanId) {
    return res.status(400).json({ message: 'pricingPlanId is required' });
  }

  let txResult = null;
  const slot = await prisma.slot.findUnique({
    where: { id: Number(slotId) },
    include: { class: true },
  });
  if (!slot) return res.status(404).json({ message: 'Slot not found' });

  const pricingPlan = await prisma.pricingPlan.findUnique({
    where: { id: Number(pricingPlanId) },
  });

  if (!pricingPlan) {
    return res.status(404).json({ message: 'Pricing Plan not found' });
  }
  const amount = pricingPlan.price;
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
        pricingPlanId: Number(pricingPlanId),
      },
    });

    return { payment, reservation };
  });

  res.status(201).json(txResult);
});

// Get all reservations
router.get('/', authenticateJwt, async (req, res) => {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const reservations = await prisma.reservation.findMany({
    where: { studentId: user.id },
    include: {
      slot: {
        include: {
          class: {
            include: {
              course: true,
            },
          },
          professor: true,
        },
      },
      payment: true,
    },
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
        include: {
          student: true,
          slot: { include: { class: true, professor: true } },
        },
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

        // Prefer a persisted `link` on the slot. If it's not a full URL and a
        // `MEET_BASE_URL` is configured, compose a URL. Otherwise fall back to
        // the generated meet link from utils/meet.
        let resolvedMeetLink = '';
        try {
          const rawLink = (slot as any).link;
          if (rawLink) {
            if (/^https?:\/\//i.test(rawLink)) {
              resolvedMeetLink = rawLink;
            } else {
              // Use Jitsi meet (room = the provided link, typically a UUID)
              resolvedMeetLink = `https://meet.jit.si/${encodeURIComponent(
                String(rawLink)
              )}`;
            }
          } else {
            const meetUtil = await import('../utils/meet');
            resolvedMeetLink = meetUtil.generateMeetLinkFromSlot(slot as any);
          }
        } catch (meetErr) {
          console.warn(
            'Meet link generation failed for reservation email, proceeding without link',
            (meetErr as any)?.message || meetErr
          );
          console.warn(
            'Meet link resolution failed for reservation email, proceeding without link',
            (meetErr as any)?.message || meetErr
          );
        }

        const formatChile = (d: any) =>
          new Date(d).toLocaleString('es-CL', { timeZone: 'America/Santiago' });

        const subject = `Confirmación de reserva: ${slot.class?.title ?? ''}`;
        const when = slot.startTime ? formatChile(slot.startTime) : '';
        const text = `Hola ${student.name},\n\nTu reserva para la clase "${
          slot.class?.title ?? ''
        }" ha sido confirmada.\nFecha y hora: ${when}\n\nEnlace de la reunión: ${
          resolvedMeetLink || ''
        }\n\n¡Nos vemos en clase!`;

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
            <h2 style="margin-bottom:6px;">${escapeHtml(
              slot.class?.title ?? 'Tu clase'
            )}</h2>
            <p>Hola ${escapeHtml(student.name || 'Estudiante')},</p>
            <p>Tu reserva ha sido <strong>confirmada</strong> para el <strong>${escapeHtml(
              when
            )}</strong>.</p>
            <p>
              <a href="${escapeHtml(
                resolvedMeetLink
              )}" style="display:inline-block;padding:12px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Unirse a la reunión</a>
            </p>
            <p style="color:#6b7280;font-size:13px;">O ábrelo en tu navegador: <a href="${escapeHtml(
              resolvedMeetLink
            )}">${escapeHtml(urlHost)}</a></p>
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

          // Also notify the professor/teacher
          try {
            const professor = (final.slot as any)?.professor as any;
            if (professor && professor.email) {
              const profSubject = `Reserva confirmada: ${
                slot.class?.title ?? ''
              }`;
              const profText = `Hola ${
                professor.name || 'Profesor'
              },\n\nLa reserva del estudiante ${student.name} para la clase "${
                slot.class?.title ?? ''
              }" programada para ${when} ha sido confirmada.\n\nEnlace de la reunión: ${
                resolvedMeetLink || ''
              }\n\nSaludos.`;

              const profHtml = `
                <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
                  <h2 style="margin-bottom:6px;">${escapeHtml(
                    slot.class?.title ?? 'Tu clase'
                  )}</h2>
                  <p>Hola ${escapeHtml(professor.name || 'Profesor')},</p>
                  <p>La reserva del estudiante <strong>${escapeHtml(
                    student.name || ''
                  )}</strong> para tu clase ha sido <strong>confirmada</strong> para el <strong>${escapeHtml(
                when
              )}</strong>.</p>
                  <p>
                    <a href="${escapeHtml(
                      resolvedMeetLink
                    )}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Abrir enlace de la reunión</a>
                  </p>
                  <p style="color:#6b7280;font-size:13px;">O ábrelo en tu navegador: <a href="${escapeHtml(
                    resolvedMeetLink
                  )}">${escapeHtml(urlHost)}</a></p>
                </div>
              `;

              try {
                await sendWithRetry(
                  {
                    to: professor.email,
                    subject: profSubject,
                    text: profText,
                    html: profHtml,
                  },
                  3
                );
              } catch (profMailErr) {
                console.warn(
                  'Failed to send confirmation email to professor for reservation',
                  id,
                  String(profMailErr)
                );
              }
            }
            // Notify all admins
            try {
              const admins = await prisma.admin.findMany({ select: { email: true, name: true } });
              if (admins && admins.length) {
                const adminSubject = `Reserva confirmada: ${slot.class?.title ?? ''}`;
                const adminText = `La reserva del estudiante ${student.name} para la clase "${slot.class?.title ?? ''}" programada para ${when} ha sido confirmada.`;
                const adminHtml = `
                  <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
                    <h2>${escapeHtml(slot.class?.title ?? 'Clase')}</h2>
                    <p>La reserva del estudiante <strong>${escapeHtml(student.name || '')}</strong> para la clase programada para <strong>${escapeHtml(when)}</strong> ha sido <strong>confirmada</strong>.</p>
                    <p>Profesor: ${escapeHtml((professor && professor.name) || 'N/A')}</p>
                    <p><a href="${escapeHtml(resolvedMeetLink)}">Abrir enlace de la reunión</a></p>
                  </div>
                `;

                for (const a of admins) {
                  try {
                    await sendWithRetry({ to: a.email, subject: adminSubject, text: adminText, html: adminHtml }, 3);
                  } catch (adminErr) {
                    console.warn('Failed to send confirmation email to admin', a.email, String(adminErr));
                  }
                }
              }
            } catch (adminFetchErr) {
              console.warn('Failed to fetch admins for confirmation notification', String(adminFetchErr));
            }
          } catch (profErr) {
            console.warn(
              'Error while preparing/sending professor notification',
              String(profErr)
            );
          }

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
      // Notify student when reservation gets cancelled
      if (final && finalStatus === 'cancelled' && prevStatus !== 'cancelled') {
        try {
          const student = final.student as any;
          const slot = (final.slot as any) || {};
          const formatChile = (d: any) =>
            new Date(d).toLocaleString('es-CL', {
              timeZone: 'America/Santiago',
            });
          const when = slot.startTime ? formatChile(slot.startTime) : '';

          const subject = `Reserva cancelada: ${slot.class?.title ?? ''}`;
          const text = `Hola ${student.name},\n\nTu reserva para la clase "${
            slot.class?.title ?? ''
          }" programada para ${when} ha sido cancelada.\n\nSi crees que esto es un error, contacta al equipo.`;

          const escapeHtml = (s: string) =>
            s
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');

          const html = `
            <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
              <h2 style="margin-bottom:6px;">${escapeHtml(
                slot.class?.title ?? 'Tu clase'
              )}</h2>
              <p>Hola ${escapeHtml(student.name || 'Estudiante')},</p>
              <p>Tu reserva para la clase <strong>${escapeHtml(
                slot.class?.title ?? ''
              )}</strong> programada para <strong>${escapeHtml(
            when
          )}</strong> ha sido <strong>cancelada</strong>.</p>
              <p style="font-size:13px;color:#6b7280;">Si crees que esto es un error, por favor contacta al equipo de soporte.</p>
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
          } catch (mailErr) {
            console.warn(
              'Failed to send cancellation email for reservation',
              id,
              String(mailErr)
            );
          }
          // Notify professor and admins about cancellation
          try {
            const professor = (final.slot as any)?.professor as any;
            const profSubject = `Reserva cancelada: ${slot.class?.title ?? ''}`;
            const profText = `La reserva del estudiante ${student.name} para la clase "${slot.class?.title ?? ''}" programada para ${when} ha sido cancelada.`;
            const profHtml = `
              <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
                <h2>${escapeHtml(slot.class?.title ?? 'Clase')}</h2>
                <p>Hola ${escapeHtml((professor && professor.name) || 'Profesor')},</p>
                <p>La reserva del estudiante <strong>${escapeHtml(student.name || '')}</strong> para la clase programada para <strong>${escapeHtml(when)}</strong> ha sido <strong>cancelada</strong>.</p>
              </div>
            `;
            if (professor && professor.email) {
              try {
                await sendWithRetry({ to: professor.email, subject: profSubject, text: profText, html: profHtml }, 3);
              } catch (profNotifyErr) {
                console.warn('Failed to send cancellation email to professor', String(profNotifyErr));
              }
            }

            // notify admins
            try {
              const admins = await prisma.admin.findMany({ select: { email: true, name: true } });
              if (admins && admins.length) {
                const adminSubject = `Reserva cancelada: ${slot.class?.title ?? ''}`;
                const adminText = `La reserva del estudiante ${student.name} para la clase "${slot.class?.title ?? ''}" programada para ${when} ha sido cancelada.`;
                const adminHtml = `
                  <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
                    <h2>${escapeHtml(slot.class?.title ?? 'Clase')}</h2>
                    <p>La reserva del estudiante <strong>${escapeHtml(student.name || '')}</strong> para la clase programada para <strong>${escapeHtml(when)}</strong> ha sido <strong>cancelada</strong>.</p>
                  </div>
                `;
                for (const a of admins) {
                  try {
                    await sendWithRetry({ to: a.email, subject: adminSubject, text: adminText, html: adminHtml }, 3);
                  } catch (adminErr) {
                    console.warn('Failed to send cancellation email to admin', a.email, String(adminErr));
                  }
                }
              }
            } catch (adminFetchErr) {
              console.warn('Failed to fetch admins for cancellation notification', String(adminFetchErr));
            }
          } catch (notifyErr) {
            console.warn('Error preparing cancellation email', id, String(notifyErr));
          }
        } catch (notifyErr) {
          console.warn(
            'Error preparing cancellation email',
            id,
            String(notifyErr)
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
