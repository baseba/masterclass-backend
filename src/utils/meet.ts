import prisma from '../prisma';
import { randomUUID } from 'crypto';

/**
 * Ensure a slot has a meet (Jitsi) link. If `slot.location` is present it will
 * be returned. Otherwise generate a Jitsi room URL, persist it to the slot and
 * return it.
 */
export async function ensureMeetLink(slot: any): Promise<string> {
  // If slot object already contains a location, use it
  if (slot.location) return slot.location;

  // Ensure we have the canonical slot record (to read class title / startTime)
  const slotDb = await prisma.slot.findUnique({
    where: { id: slot.id },
    include: { class: true },
  });
  if (!slotDb) throw new Error(`Slot not found: ${slot.id}`);
  if (slotDb.location) return slotDb.location;

  // Build a deterministic, human-friendly slug from class title + date + slot id
  const title = (slotDb.class && slotDb.class.title) || 'masterclass';
  const start = slotDb.startTime ? new Date(slotDb.startTime) : new Date();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(
    start.getDate()
  )}`;

  const slugify = (s: string) =>
    s
      .toString()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  // Deterministic room name: slugified title + date + slot id (no randomness)
  const base = `${slugify(title)}-${dateStr}-${slotDb.id}`;
  const room = base.slice(0, 64);
  const jitsiUrl = `https://meet.jit.si/${room}`;

  // Atomically set location only if it is still null to avoid races between processes
  try {
    const res = await prisma.slot.updateMany({
      where: { id: slotDb.id, location: null },
      data: { location: jitsiUrl },
    });
    if ((res as any).count && (res as any).count > 0) {
      // we set it successfully
      return jitsiUrl;
    }
  } catch (err) {
    // ignore and try to read existing value
  }

  // Another process likely set it first — read and return current location
  const refreshed = await prisma.slot.findUnique({ where: { id: slotDb.id } });
  if (refreshed && refreshed.location) return refreshed.location as string;
  // as a last resort return our computed URL
  return jitsiUrl;
}
