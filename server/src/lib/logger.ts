import prisma from './prisma';
import { Request } from 'express';

// ============ AUDIT LOG (user actions) ============

interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditLogEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        userName: entry.userName,
        userRole: entry.userRole,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/** Helper to extract user info + IP from an authenticated request */
export function auditFromReq(req: Request) {
  return {
    userId: req.user?.userId,
    userEmail: (req as any)._auditEmail as string | undefined,
    userName: (req as any)._auditName as string | undefined,
    userRole: req.user?.role,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
  };
}

/** Middleware that loads user email/name for audit log enrichment */
export async function enrichAuditUser(req: Request, _res: any, next: any) {
  if (req.user?.userId) {
    try {
      const u = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { email: true, name: true } });
      if (u) {
        (req as any)._auditEmail = u.email;
        (req as any)._auditName = u.name;
      }
    } catch {}
  }
  next();
}

// ============ SYSTEM LOG (webhooks, errors, system events) ============

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface SystemLogEntry {
  level?: LogLevel;
  source: string;
  message: string;
  details?: Record<string, any>;
}

export async function logSystem(entry: SystemLogEntry) {
  try {
    await prisma.systemLog.create({
      data: {
        level: entry.level || 'INFO',
        source: entry.source,
        message: entry.message,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  } catch (err) {
    console.error('Failed to write system log:', err);
  }
}
