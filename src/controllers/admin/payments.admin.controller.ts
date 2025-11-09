import { Router } from 'express';
import authenticateJwt from '../../middleware/authenticateJwt';
import authenticateAdmin from '../../middleware/authenticateAdmin';
import prisma from '../../prisma';
import { parsePagination } from '../helpers/parsePagination';

const router = Router();

router.use(authenticateJwt);
router.use(authenticateAdmin);

router.get('/', async (req, res) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const { id, transactionReference, courseId } = req.query as {
      id?: string;
      transactionReference?: string;
      courseId?: string;
    };

    const or: any[] = [];
    if (id) or.push({ id: Number(id) });
    if (transactionReference)
      or.push({ transactionReference: String(transactionReference) });

    const where: any = or.length ? { OR: or } : {};

    if (courseId) {
      Object.assign(where, {
        reservations: {
          some: {
            slot: {
              class: {
                courseId: Number(courseId),
              },
            },
          },
        },
      });
    }
    const [total, data] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          student: true,
          reservations: {
            include: {
              slot: {
                include: {
                  class: {
                    include: {
                      course: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take,
        orderBy: [{ id: 'desc' }],
      }),
    ]);

    res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error fetching payments',
      error: (err as Error).message,
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status, transactionReference } = req.body;

    // Validate input
    if (!amount && !status && !transactionReference) {
      return res.status(400).json({ message: 'No fields to update provided' });
    }

    // Validate status
    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status value. Valid values are: ${validStatuses.join(
          ', '
        )}`,
      });
    }

    // Build update data
    const updateData: any = {};
    if (amount !== undefined) updateData.amount = amount;
    if (status !== undefined) updateData.status = status;
    if (transactionReference !== undefined)
      updateData.transactionReference = transactionReference;

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.json({
      message: 'Payment updated successfully',
      data: updatedPayment,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error updating payment',
      error: (err as Error).message,
    });
  }
});

export default router;
