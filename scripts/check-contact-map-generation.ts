import { db } from "../src/lib/db";
import { attachContactMapGeneration, removeContactMapGeneration, replaceMedia, retireMedia } from "../src/lib/media-service";
import { createCmsDraft } from "../src/lib/cms-workflow";
import { CmsDraftKind, CmsDraftOperation } from "../src/generated/prisma/client";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";

let assertions = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Contact Map generation assertion failed: ${message}`);
  assertions++;
}

async function main() {
  assertQaExecutionSafe();
  const suffix = Date.now().toString(36);
  const tenant = await db.tenant.create({ data: { slug: `contact-map-generation-${suffix}`, displayName: "Contact Map Generation QA" } });
  const actorId = `contact-map-generation-actor-${suffix}`;
  const objectKeys: string[] = [];
  try {
    await db.user.create({ data: { id: actorId, email: `${actorId}@qa.invalid`, name: "Contact Map Generation QA" } });
    await db.staffMembership.create({ data: { tenantId: tenant.id, userId: actorId, role: "ADMINISTRATOR" } });
    const settings = await db.contactSettings.create({ data: { tenantId: tenant.id, organisationName: "QA", streetAddress: "QA", postalAddress: "QA", telephone: "QA", publicEmail: "qa@example.invalid" } });
    const resolved = { id: tenant.id, slug: tenant.slug, displayName: tenant.displayName };
    const makeAsset = (name: string) => {
      const objectKey = `qa/${tenant.id}/${name}-${suffix}.webp`;
      objectKeys.push(objectKey);
      return db.mediaAsset.create({ data: { tenantId: tenant.id, objectKey, originalFilename: `${name}.webp`, mimeType: "image/webp", purpose: "contact-map", byteSize: 1, width: 1, height: 1, createdBy: actorId } });
    };
    const first = await makeAsset("first");
    const second = await makeAsset("second");
    const results = await Promise.allSettled([
      attachContactMapGeneration({ tenant: resolved, actorUserId: actorId, uploadedMediaId: first.id, expectedMediaId: null, operation: "UPLOAD" }),
      attachContactMapGeneration({ tenant: resolved, actorUserId: actorId, uploadedMediaId: second.id, expectedMediaId: null, operation: "UPLOAD" }),
    ]);
    assert(results.filter((result) => result.status === "fulfilled").length === 1, "concurrent null-generation upload has one winner");
    assert(results.filter((result) => result.status === "rejected").length === 1, "concurrent null-generation upload rejects stale writer");
    const current = await db.contactSettings.findUniqueOrThrow({ where: { id: settings.id }, select: { contactMapMediaAssetId: true } });
    assert(Boolean(current.contactMapMediaAssetId), "winning generation is attached");
    const assets = await db.mediaAsset.findMany({ where: { id: { in: [first.id, second.id] } }, select: { id: true, retiredAt: true } });
    assert(assets.every((asset) => asset.id === current.contactMapMediaAssetId || asset.retiredAt), "stale uploaded generation is retired");
    const stale = await makeAsset("stale-replace");
    await assertRejects(
      attachContactMapGeneration({ tenant: resolved, actorUserId: actorId, uploadedMediaId: stale.id, expectedMediaId: "stale-old-generation", operation: "REPLACE" }),
      "replace with stale expected generation",
    );
    const staleRow = await db.mediaAsset.findUniqueOrThrow({ where: { id: stale.id }, select: { retiredAt: true } });
    assert(Boolean(staleRow.retiredAt), "stale replace upload is compensated");
    await assertRejects(removeContactMapGeneration({ tenant: resolved, actorUserId: actorId, expectedMediaId: "stale-old-generation" }), "stale remove does not remove current generation");
    const beforeOrdering = await db.contactSettings.findUniqueOrThrow({ where: { id: settings.id }, select: { contactMapMediaAssetId: true } });
    const orderedReplacement = await makeAsset("ordered-replace");
    const ordered = await Promise.allSettled([
      attachContactMapGeneration({ tenant: resolved, actorUserId: actorId, uploadedMediaId: orderedReplacement.id, expectedMediaId: beforeOrdering.contactMapMediaAssetId, operation: "REPLACE" }),
      removeContactMapGeneration({ tenant: resolved, actorUserId: actorId, expectedMediaId: beforeOrdering.contactMapMediaAssetId! }),
    ]);
    assert(ordered.filter((result) => result.status === "fulfilled").length === 1, "replace-vs-remove ordering has one winner");
    const afterOrdering = await db.contactSettings.findUniqueOrThrow({ where: { id: settings.id }, select: { contactMapMediaAssetId: true } });
    if (!afterOrdering.contactMapMediaAssetId) {
      const restored = await makeAsset("restored");
      await attachContactMapGeneration({ tenant: resolved, actorUserId: actorId, uploadedMediaId: restored.id, expectedMediaId: null, operation: "UPLOAD" });
    }
    const activeMap = await db.contactSettings.findUniqueOrThrow({ where: { id: settings.id }, select: { contactMapMediaAssetId: true } });
    const activeMapId = activeMap.contactMapMediaAssetId!;
    await assertRejects(replaceMedia({ tenant: resolved, actorUserId: actorId, mediaId: activeMapId, file: new File(["not used"], "map.png", { type: "image/png" }) }), "generic replace rejects Contact Map");
    await assertRejects(retireMedia(resolved, actorId, activeMapId), "generic retire rejects Contact Map");
    await assertRejects(createCmsDraft({ tenant: resolved, actorUserId: actorId, kind: CmsDraftKind.MEDIA, operation: CmsDraftOperation.RETIRE, targetId: activeMapId, payload: {} }), "generic CMS media retire rejects Contact Map");
  } finally {
    const audit = await db.auditLog.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { id: { in: audit.map((row) => row.id) } } });
    await db.contactSettings.deleteMany({ where: { tenantId: tenant.id } });
    await db.mediaAsset.deleteMany({ where: { tenantId: tenant.id } });
    await db.staffMembership.deleteMany({ where: { tenantId: tenant.id, userId: actorId } });
    await db.user.deleteMany({ where: { id: actorId } });
    await db.tenant.delete({ where: { id: tenant.id } });
  }
  console.info(JSON.stringify({ script: "check-contact-map-generation", assertions }));
}

async function assertRejects(work: Promise<unknown>, label: string) {
  const result = await Promise.allSettled([work]);
  assert(result[0]?.status === "rejected", label);
}

main().finally(() => db.$disconnect());