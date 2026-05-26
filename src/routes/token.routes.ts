import { Router } from 'express';
import { TokenController } from '../controllers/token.controller';
import { tokenLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.get('/generate-token', tokenLimiter, TokenController.generateToken);
router.get('/validate-token/:token', TokenController.validateToken);

export default router;
