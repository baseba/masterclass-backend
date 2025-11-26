import { Router } from 'express';
import {
  coursesAdminController,
  paymentsAdminController,
  dashboardAdminController,
  pricingPlansAdminController,
  profileAdminController,
} from '../controllers/admin';

const router = Router();

router.use('/dashboard', dashboardAdminController);
router.use('/courses', coursesAdminController);
router.use('/payments', paymentsAdminController);
router.use('/pricing-plans', pricingPlansAdminController);
router.use('/', profileAdminController);

export default router;
