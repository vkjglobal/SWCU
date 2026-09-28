"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveAskSwcuVisibility } from "@/lib/ask-swcu-settings";

export async function saveAskSwcuAction(formData: FormData) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const value = formData.get("showAskSwcu");
  if (value !== "on" && value !== "off") throw new Error("Choose ON or OFF.");
  await saveAskSwcuVisibility({
    tenantId: tenant.id,
    organisationName: tenant.displayName,
    actorUserId: session.user.id,
    requested: value === "on",
  });
  revalidatePath("/admin/ask-swcu");
  revalidatePath("/", "layout");
}