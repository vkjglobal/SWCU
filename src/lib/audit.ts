import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type AuditInput = {
  tenantId: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  changeMetadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput) {
  return db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      changeMetadata: input.changeMetadata,
    },
  });
}