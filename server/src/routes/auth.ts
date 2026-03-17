import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken, authenticate } from '../middleware/auth';
import { logAudit, logSystem } from '../lib/logger';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for']?.toString();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      logAudit({ action: 'LOGIN_FAILED', details: { email, reason: 'User not found' }, ipAddress: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.active) {
      logAudit({ action: 'LOGIN_FAILED', userId: user.id, userEmail: user.email, userName: user.name, userRole: user.role, details: { reason: 'Account deactivated' }, ipAddress: ip });
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logAudit({ action: 'LOGIN_FAILED', userId: user.id, userEmail: user.email, userName: user.name, userRole: user.role, details: { reason: 'Invalid password' }, ipAddress: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, role: user.role });

    logAudit({ action: 'LOGIN', userId: user.id, userEmail: user.email, userName: user.name, userRole: user.role, ipAddress: ip });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    logSystem({ level: 'ERROR', source: 'AUTH', message: 'Login error', details: { error: String(error) } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, defaultCommissionRate: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
