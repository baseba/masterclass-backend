import { Router } from 'express';
import {
  PrismaClient,
  SlotModality,
  SlotStudentsGroup,
  SlotStatus,
} from '@prisma/client';

const prismaSlot = new PrismaClient().slot;
const router = Router();

// Helpers -----------------------------------------------------------------
function mapEnum<T extends Record<string, string>>(
  enumType: T,
  value: string
): T[keyof T] {
  if (!(value in enumType))
    throw new Error(`Invalid enum ${JSON.stringify(enumType)} value: ${value}`);
  return enumType[value as keyof T];
}

function parseDate(value: any, field: string): Date {
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (isNaN(d.getTime()))
    throw new Error(`Field '${field}' must be a valid date/ISO string`);
  return d;
}

// CREATE ------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const data = {
      ...req.body,
      startTime: parseDate(req.body.startTime, 'startTime'),
      endTime: parseDate(req.body.endTime, 'endTime'),
      modality: mapEnum(SlotModality, req.body.modality),
      studentsGroup: mapEnum(SlotStudentsGroup, req.body.studentsGroup),
      status: mapEnum(SlotStatus, req.body.status),
    };
    const slot = await prismaSlot.create({ data });
    res.status(201).json(slot);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// READ ALL
router.get('/', async (req, res) => {
  try {
    const slots = await prismaSlot.findMany();
    res.json(slots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// READ ONE
router.get('/:id', async (req, res) => {
  try {
    const slot = await prismaSlot.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json(slot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE (partial)
router.patch('/:id', async (req, res) => {
  try {
    const data: any = {};

    if ('startTime' in req.body)
      data.startTime = parseDate(req.body.startTime, 'startTime');
    if ('endTime' in req.body)
      data.endTime = parseDate(req.body.endTime, 'endTime');
    if ('modality' in req.body)
      data.modality = mapEnum(SlotModality, req.body.modality);
    if ('studentsGroup' in req.body)
      data.studentsGroup = mapEnum(SlotStudentsGroup, req.body.studentsGroup);
    if ('status' in req.body)
      data.status = mapEnum(SlotStatus, req.body.status);

    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    const slot = await prismaSlot.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(slot);
  } catch (error: any) {
    if (error?.code === 'P2025')
      return res.status(404).json({ error: 'Slot not found' });
    res.status(400).json({ error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await prismaSlot.delete({
      where: { id: Number(req.params.id) },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
