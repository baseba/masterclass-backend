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

/**
 * Generate a deterministic Jitsi room URL from slot metadata (class title + date + slot id).
 * This function does not read or write the database and does not rely on `slot.location`.
 */
export function generateMeetLinkFromSlot(slot: any): string {
  // Prefer a slot.link value (UUID or room name). If it's already a full URL,
  // return it as-is. Otherwise treat it as a Jitsi room name (URL-encoded).
  try {
    const rawLink = (slot as any).link;
    if (rawLink) {
      if (/^https?:\/\//i.test(rawLink)) return String(rawLink);
      return `https://meet.jit.si/${encodeURIComponent(String(rawLink))}`;
    }
  } catch (e) {
    // ignore and fall back to deterministic slug
  }

  const title = (slot.class && slot.class.title) || 'masterclass';
  const start = slot.startTime ? new Date(slot.startTime) : new Date();

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

  const base = `${slugify(title)}-${dateStr}-${slot.id}`;
  const room = base.slice(0, 64);
  return `https://meet.jit.si/${room}`;
}
