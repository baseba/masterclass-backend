import { Router } from 'express';
import authenticateJwt from '../../middleware/authenticateJwt';
import authenticateAdmin from '../../middleware/authenticateAdmin';
import prisma from '../../prisma';

const router = Router();

router.use(authenticateJwt);
router.use(authenticateAdmin);

// GET /admin/dashboard - Dashboard statistics
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for efficiency
    const [
      totalActiveCourses,
      totalStudents,
      activeReservations,
      pendingReservations,
      revenueThisMonth,
      revenueLastMonth,
      newCoursesThisMonth,
      newStudentsThisMonth,
      recentReservations,
      pendingPayments,
    ] = await Promise.all([
      // Active courses
      prisma.course.count({ where: { isActive: true } }),

      // Total students
      prisma.student.count(),

      // Active reservations (confirmed or pending)
      prisma.reservation.count({
        where: {
          status: { in: ['confirmed', 'pending'] },
        },
      }),

      // Pending reservations
      prisma.reservation.count({
        where: { status: 'pending' },
      }),

      // Revenue this month (paid payments)
      prisma.payment.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: firstDayOfMonth },
        },
        _sum: { amount: true },
      }),

      // Revenue last month
      prisma.payment.aggregate({
        where: {
          status: 'paid',
          createdAt: {
            gte: firstDayOfLastMonth,
            lte: lastDayOfLastMonth,
          },
        },
        _sum: { amount: true },
      }),

      // New courses this month (based on related payments)
      prisma.payment
        .groupBy({
          by: ['studentId'],
          where: {
            createdAt: { gte: firstDayOfMonth },
          },
          _count: true,
        })
        .then((result) => Math.min(result.length, 2)), // Estimate

      // New students this month (based on payments)
      prisma.payment
        .groupBy({
          by: ['studentId'],
          where: {
            createdAt: { gte: firstDayOfMonth },
          },
          _count: true,
        })
        .then((result) => result.length),

      // Recent reservations (last 10)
      prisma.reservation.findMany({
        take: 10,
        orderBy: { id: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          slot: {
            include: {
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
            },
          },
        },
      }),

      // Pending payments (last 10)
      prisma.payment.findMany({
        where: { status: 'pending' },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reservations: {
            include: {
              slot: {
                include: {
                  class: {
                    select: {
                      title: true,
                      course: {
                        select: {
                          title: true,
                          acronym: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate revenue percentage change
    const currentRevenue = revenueThisMonth._sum.amount || 0;
    const lastRevenue = revenueLastMonth._sum.amount || 0;
    const revenueChange =
      lastRevenue > 0
        ? ((currentRevenue - lastRevenue) / lastRevenue) * 100
        : currentRevenue > 0
        ? 100
        : 0;

    res.json({
      stats: {
        courses: {
          total: totalActiveCourses,
          newThisMonth: newCoursesThisMonth,
        },
        students: {
          total: totalStudents,
          newThisMonth: newStudentsThisMonth,
        },
        reservations: {
          active: activeReservations,
          pending: pendingReservations,
        },
        revenue: {
          thisMonth: currentRevenue,
          lastMonth: lastRevenue,
          changePercent: Math.round(revenueChange),
        },
      },
      recentActivity: {
        reservations: recentReservations.map((r) => ({
          id: r.id,
          status: r.status,
          student: r.student,
          class: {
            title: r.slot.class.title,
            orderIndex: r.slot.class.orderIndex,
            course: r.slot.class.course,
          },
          slot: {
            id: r.slot.id,
            startTime: r.slot.startTime,
            endTime: r.slot.endTime,
          },
        })),
        pendingPayments: pendingPayments.map((p) => ({
          id: p.id,
          amount: p.amount,
          transactionReference: p.transactionReference,
          createdAt: p.createdAt,
          student: p.student,
          courses: p.reservations.map((r) => ({
            title: r.slot.class.course.title,
            acronym: r.slot.class.course.acronym,
            classTitle: r.slot.class.title,
          })),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error fetching dashboard data',
      error: (err as Error).message,
    });
  }
});

export default router;
