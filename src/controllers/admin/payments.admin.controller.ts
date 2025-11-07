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

export default router;
