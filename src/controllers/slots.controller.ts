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
  rawValue: any
): T[keyof T] {
  if (rawValue === undefined || rawValue === null)
    throw new Error(`Enum value required`);
  const value = String(rawValue);
  const found = Object.entries(enumType).find(
    ([k, v]) =>
      k.toLowerCase() === value.toLowerCase() ||
      v.toLowerCase() === value.toLowerCase()
  );
  if (!found)
    throw new Error(
      `Invalid enum ${JSON.stringify(enumType)} value: ${rawValue}`
    );
  return found[1] as T[keyof T];
}

function parseDate(value: any, field: string): Date {
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (isNaN(d.getTime()))
    throw new Error(`Field '${field}' must be a valid date/ISO string`);
  return d;
}

function parseIntField(
  value: any,
  field: string,
  opts: { allowNull?: boolean; min?: number } = {}
): number | null {
  const { allowNull = false, min } = opts;
  if (value === null) {
    if (allowNull) return null;
    throw new Error(`Field '${field}' cannot be null`);
  }
  if (value === undefined) throw new Error(`Field '${field}' is required`);
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n))
    throw new Error(`Field '${field}' must be an integer`);
  if (min !== undefined && n < min)
    throw new Error(`Field '${field}' must be >= ${min}`);
  return n;
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
    // Basic validations
    if (data.endTime <= data.startTime)
      throw new Error(`'endTime' must be after 'startTime'`);
    if (data.minStudents !== undefined && data.minStudents !== null) {
      const minS = parseIntField(data.minStudents, 'minStudents', {
        allowNull: true,
        min: 0,
      });
      data.minStudents = minS;
    }
    if (data.maxStudents !== undefined) {
      const maxS = parseIntField(data.maxStudents, 'maxStudents', { min: 1 });
      data.maxStudents = maxS as number;
    }
    if (
      data.minStudents !== undefined &&
      data.minStudents !== null &&
      data.maxStudents !== undefined &&
      typeof data.maxStudents === 'number' &&
      (data.minStudents as number) > (data.maxStudents as number)
    )
      throw new Error(`'minStudents' cannot be greater than 'maxStudents'`);
    const slot = await prismaSlot.create({
      data,
      include: {
        professor: true,
        class: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
            course: {
              select: {
                id: true,
                title: true,
                acronym: true,
              },
            },
          },
        },
        reservations: {
          include: {
            student: true,
            payment: true,
          },
        },
      },
    });
    res.status(201).json(slot);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// READ ALL
router.get('/', async (req, res) => {
  try {
    const slots = await prismaSlot.findMany({
      include: {
        professor: true,
        class: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
            course: {
              select: {
                id: true,
                title: true,
                acronym: true,
              },
            },
          },
        },
        reservations: {
          include: {
            student: true,
            payment: true,
          },
        },
      },
    });
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
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: 'Invalid slot id' });

    // Disallow attempts to change immutable relationships
    const forbiddenFields = [
      'professorId',
      'classId',
      'professor',
      'class',
      'courseId',
      'course',
    ];
    const attemptedForbidden = Object.keys(req.body).filter((k) =>
      forbiddenFields.includes(k)
    );
    if (attemptedForbidden.length > 0)
      return res.status(400).json({
        error: `These fields are not editable: ${attemptedForbidden.join(
          ', '
        )}`,
      });

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
    if ('maxStudents' in req.body)
      data.maxStudents = parseIntField(req.body.maxStudents, 'maxStudents', {
        min: 1,
      });
    if ('minStudents' in req.body)
      data.minStudents =
        req.body.minStudents === null
          ? null
          : parseIntField(req.body.minStudents, 'minStudents', {
              allowNull: true,
              min: 0,
            });
    if ('location' in req.body) {
      const loc = req.body.location;
      if (loc === null) data.location = null;
      else if (typeof loc === 'string') data.location = loc.trim() || null;
      else throw new Error("Field 'location' must be a string or null");
    }
    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    // Cross-field validations may require current values
    let current: {
      startTime: Date;
      endTime: Date;
      maxStudents: number;
      minStudents: number | null;
    } | null = null;

    const needsDateValidation = 'startTime' in data || 'endTime' in data;
    const needsStudentsValidation =
      'maxStudents' in data || 'minStudents' in data;

    if (needsDateValidation || needsStudentsValidation) {
      current = await prismaSlot.findUnique({
        where: { id },
        select: {
          startTime: true,
          endTime: true,
          maxStudents: true,
          minStudents: true,
        },
      });
      if (!current) return res.status(404).json({ error: 'Slot not found' });
    }

    if (needsDateValidation && current) {
      const effectiveStart =
        'startTime' in data ? (data.startTime as Date) : current.startTime;
      const effectiveEnd =
        'endTime' in data ? (data.endTime as Date) : current.endTime;
      if (effectiveEnd <= effectiveStart)
        throw new Error(`'endTime' must be after 'startTime'`);
    }

    if (needsStudentsValidation && current) {
      const effectiveMin =
        'minStudents' in data
          ? (data.minStudents as number | null)
          : current.minStudents;
      const effectiveMax =
        'maxStudents' in data
          ? (data.maxStudents as number)
          : current.maxStudents;
      if (
        effectiveMin !== null &&
        effectiveMin !== undefined &&
        effectiveMin > effectiveMax
      )
        throw new Error(`'minStudents' cannot be greater than 'maxStudents'`);
    }

    const slot = await prismaSlot.update({
      where: { id },
      data,
      include: {
        professor: true,
        class: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
            course: {
              select: {
                id: true,
                title: true,
                acronym: true,
              },
            },
          },
        },
        reservations: {
          include: {
            student: true,
            payment: true,
          },
        },
      },
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
