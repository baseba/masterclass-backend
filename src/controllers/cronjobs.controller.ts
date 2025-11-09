import prisma from '../prisma';
import { Router } from 'express';
import { sendMail } from '../utils/mailer';

const router = Router();

// Runs the daily job that sends meet links for slots happening the next day.
// Expects an environment variable CRON_KEY for simple protection.
router.post('/daily-job', async (req, res) => {
  if (req.query.key !== process.env.CRON_KEY) {
    return res.status(403).send('Forbidden');
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);

    // Find slots happening tomorrow that are confirmed and remote.
    // We'll fetch reservations and filter un-notified ones at runtime to avoid mismatch with generated Prisma client types.
    const slots = await prisma.slot.findMany({
      where: {
        startTime: {
          gte: tomorrow,
          lt: dayAfter,
        },
        status: 'confirmed',
        modality: 'remote',
      },
      include: {
        reservations: {
          where: { status: 'confirmed' },
          include: { student: true },
        },
        class: true,
        professor: true,
      },
    });

    const results: Array<{ slotId: number; sent: number; failed: number; errors?: string[] }> = [];

    for (const slot of slots as any) {
      // filter reservations that are not yet notified (field may not exist until migration is applied)
      const reservations = (slot.reservations || []).filter((r: any) => !r.notificationSentAt);
      if (!reservations.length) continue;

      const slotLabel = `${slot.class?.title || 'Class'} - ${slot.startTime.toISOString()}`;
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      // Ensure or create a meet link (persisted to slot.location). If that fails, we'll skip sending.
      let resolvedMeetLink = slot.location || '';
      try {
        const meetUtil = await import('../utils/meet');
        resolvedMeetLink = await meetUtil.ensureMeetLink(slot);
      } catch (err) {
        console.warn('Meet link resolution failed for slot', slot.id, String(err));
      }

      if (!resolvedMeetLink) {
        errors.push('No meet link available for this slot, skipping');
        results.push({ slotId: slot.id, sent, failed, errors });
        continue;
      }

      for (const r of reservations as any[]) {
        // Use a DB advisory lock per reservation id to avoid concurrent sends across processes.
        const lockId = Number(r.id) || Date.now();
        let acquired = false;
        try {
          const lockRes: any = await (prisma as any).$queryRaw`SELECT pg_try_advisory_lock(${BigInt(lockId)}) as acquired`;
          // normalize result
          const row = Array.isArray(lockRes) ? lockRes[0] : lockRes;
          acquired = Boolean(row && (row.acquired === true || Object.values(row)[0] === 1 || Object.values(row)[0] === true));
        } catch (lockErr) {
          console.warn('Could not acquire advisory lock, proceeding optimistically for reservation', r.id, (lockErr as any)?.message || lockErr);
          acquired = false;
        }

        if (!acquired) {
          // If we couldn't acquire the lock, skip to avoid duplicates
          // (best-effort; if advisory locks are unavailable we'll fallback to optimistic flow below)
          // continue; // commented out to allow fallback to optimistic flow when locks are unsupported
        }

        try {
          const student = (r as any).student as any;
          const subject = `Enlace para la clase de mañana: ${slot.class?.title ?? ''}`;

          // Format dates in Chilean time (America/Santiago) and Spanish locale
          const formatChile = (d: any) =>
            new Date(d).toLocaleString('es-CL', { timeZone: 'America/Santiago' });

          const whenText = formatChile(slot.startTime);

          const text = `Hola ${student.name},\n\nAquí está el enlace para tu clase programada mañana (${whenText}):\n\n${resolvedMeetLink}\n\n¡Nos vemos entonces!`;

          const escapeHtml = (s: string) =>
            s
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');

          const prettyTitle = escapeHtml(slot.class?.title ?? 'Tu clase');
          const prettyStudent = escapeHtml(student.name || 'Estudiante');
          const when = escapeHtml(formatChile(slot.startTime));

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
              <h2 style="margin-bottom:6px;">${prettyTitle}</h2>
              <p>Hola ${prettyStudent},</p>
              <p>Este es el enlace para tu clase programada mañana: <strong>${when}</strong></p>
              <p>
                <a href="${escapeHtml(resolvedMeetLink)}" style="display:inline-block;padding:12px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Unirse a la reunión</a>
              </p>
              <p style="color:#6b7280;font-size:13px;">O ábrelo en tu navegador: <a href="${escapeHtml(resolvedMeetLink)}">${escapeHtml(urlHost)}</a></p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />
              <p style="font-size:13px;color:#6b7280;">¡Nos vemos!</p>
            </div>
          `;

          // send with retries
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

          // Try to avoid duplicate sends: use advisory lock + check notificationSentAt via raw SQL (client may not have the field)
          let skipBecauseNotified = false;
          try {
            const freshRaw: any = await (prisma as any).$queryRaw`
              SELECT "notificationSentAt" FROM "Reservation" WHERE id = ${r.id} LIMIT 1
            `;
            const row = Array.isArray(freshRaw) ? freshRaw[0] : freshRaw;
            if (row && row.notificationSentAt) skipBecauseNotified = true;
          } catch (selErr) {
            // If the column is not present or selection fails, we can't rely on DB check
          }

          if (skipBecauseNotified) {
            // already notified, skip
            continue;
          }

          try {
            await sendWithRetry({ to: student.email, subject, text, html }, 3);
            sent++;

            // log success so we can confirm delivery attempts in server logs
            // (the actual SendGrid response is returned by sendWithRetry but we keep logs minimal)
            // eslint-disable-next-line no-console
            console.log(`Sent meet link email to ${student.email} for slot ${slot.id}`);

            // mark reservation as notified (guarded - update may fail if client types are outdated)
            try {
              await (prisma as any).reservation.update({ where: { id: r.id }, data: { notificationSentAt: new Date() } });
            } catch (updateErr) {
              console.warn('Failed to mark reservation via Prisma client, attempting raw SQL fallback:', String(updateErr));
              try {
                // fallback using raw SQL to set the column regardless of client validation
                await (prisma as any).$executeRaw`
                  UPDATE "Reservation" SET "notificationSentAt" = ${new Date()} WHERE id = ${r.id}
                `;
              } catch (rawErr) {
                console.warn('Raw fallback to mark reservation failed:', String(rawErr));
              }
            }
          } catch (sendErr) {
            failed++;
            errors.push(String((sendErr as any)?.message || sendErr));
          }
        } catch (err: any) {
          failed++;
          errors.push(String(err.message || err));
        } finally {
          // release advisory lock if acquired
          try {
            if (acquired) {
              await (prisma as any).$queryRaw`SELECT pg_advisory_unlock(${BigInt(lockId)})`;
            }
          } catch (unlockErr) {
            // ignore
          }
        }
      }

      results.push({ slotId: slot.id, sent, failed, errors });
    }

    return res.json({ ok: true, count: slots.length, results });
  } catch (err) {
    console.error('Daily job failed', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
