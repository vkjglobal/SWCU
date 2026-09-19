import "server-only";

import { randomUUID } from "node:crypto";

const safeSegment = /^[a-z0-9][a-z0-9-]*$/;

export function createMediaObjectKey(input: {
  tenantSlug: string;
  category: string;
  extension: string;
}): string {
  const tenantSlug = input.tenantSlug.toLowerCase();
  const category = input.category.toLowerCase();
  const extension = input.extension.toLowerCase().replace(/^\./, "");

  if (
    !safeSegment.test(tenantSlug) ||
    !safeSegment.test(category) ||
    !/^[a-z0-9]+$/.test(extension)
  ) {
    throw new Error("Invalid media key segment");
  }

  return `${tenantSlug}/${category}/${randomUUID()}.${extension}`;
}