import "server-only";

import { db } from "@/lib/db";
import { ASK_SWCU_CONNECTION_READY, planAskSwcuChange } from "@/lib/ask-swcu-policy";

export async function saveAskSwcuVisibility(input: {
  tenantId: string;
  organisationName: string;
  actorUserId: string;
  requested: boolean;
}, database: Pick<typeof db, "$transaction"> = db) {
  // Reject before any write, even when an old row happens to have the same value.
  planAskSwcuChange(false, input.requested, ASK_SWCU_CONNECTION_READY);

  await database.$transaction(async (tx) => {
    const previous = await tx.tenantSettings.findUnique({
      where: { tenantId: input.tenantId },
      select: { showAskSwcu: true },
    });
    const change = planAskSwcuChange(previous?.showAskSwcu ?? false, input.requested, ASK_SWCU_CONNECTION_READY);
    if (!change) return;

    const settings = await tx.tenantSettings.upsert({
      where: { tenantId: input.tenantId },
      update: { showAskSwcu: change.after },
      create: {
        tenantId: input.tenantId,
        organisationName: input.organisationName,
        showAskSwcu: change.after,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "ASK_SWCU_VISIBILITY_CHANGED",
        targetType: "TenantSettings",
        targetId: settings.id,
        changeMetadata: change,
      },
    });
  });
}