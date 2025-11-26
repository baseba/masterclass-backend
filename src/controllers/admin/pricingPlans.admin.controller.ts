import { Router } from 'express';
import prisma from '../../prisma';
import { parsePagination } from '../helpers/parsePagination';
const router = Router();

router.get('/', async (req, res) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const [total, pricingPlans] = await Promise.all([
      prisma.pricingPlan.count(),
      prisma.pricingPlan.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          isActive: true,
        },
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
    ]);

    const result = pricingPlans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      isActive: p.isActive,
    }));

    res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data: result,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Error fetching pricing plans', error: err });
  }
});

// GET /admin/pricing-plans/:id - get full detail of a pricing plan
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const pricingPlan = await prisma.pricingPlan.findUnique({
      where: { id },
    });
    if (!pricingPlan)
      return res.status(404).json({ message: 'Pricing plan not found' });
    res.json(pricingPlan);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Error fetching pricing plan', error: err });
  }
});

// POST /admin/pricing-plans - create new pricing plan
router.post('/', async (req, res) => {
  const {
    name,
    description,
    price,
    isActive = true,
    reservationCount,
  } = req.body as {
    name?: string;
    description?: string;
    price?: number;
    isActive?: boolean;
    reservationCount?: number;
  };

  if (!name || price === undefined || reservationCount === undefined) {
    return res
      .status(400)
      .json({ message: 'name, price and reservationCount are required' });
  }

  try {
    const pricingPlan = await prisma.pricingPlan.create({
      data: {
        name,
        description: description ?? '',
        price,
        isActive,
        reservationCount,
      },
    });
    res.status(201).json(pricingPlan);
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not create pricing plan', error: err });
  }
});

// PUT /admin/pricing-plans/:id - update pricing plan
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, price, isActive, classCount, classIds } =
    req.body as {
      name?: string;
      description?: string;
      price?: number;
      isActive?: boolean;
      classCount?: number;
      classIds?: number[];
    };

  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    const data: any = { name, description, price, isActive, classCount };
    // Clean undefined keys
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    if (Array.isArray(classIds)) {
      data.classes = {
        set: [], // reset all
        ...(classIds.length
          ? { connect: classIds.map((cid) => ({ id: cid })) }
          : {}),
      };
    }

    const pricingPlan = await prisma.pricingPlan.update({
      where: { id },
      data,
    });
    res.json(pricingPlan);
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not update pricing plan', error: err });
  }
});

// DELETE /admin/pricing-plans/:id - delete pricing plan
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    // Disconnect all classes before deleting
    await prisma.pricingPlan.update({
      where: { id },
      data: { reservations: { set: [] } },
    });

    await prisma.pricingPlan.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not delete pricing plan', error: err });
  }
});

export default router;
