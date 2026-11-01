import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/auth';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);

// Optional authentication: logging out without a valid session should still
// clear cookies and return 204 rather than failing.
authRouter.post('/logout', optionalAuthenticate, controller.logout);

authRouter.get('/me', authenticate, controller.me);

authRouter.post(
  '/password',
  authenticate,
  sensitiveLimiter,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);
