import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { db } from "../src/lib/db";
import { getR2Client } from "../src/lib/r2";
import { getServerEnvironment } from "../src/lib/env";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`QA residue assertion failed: ${message}`);
  assertions += 1;
}

async function main() {
  const qaUsers = await db.user.findMany({ where: { OR: [
    { id: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor", "prompt3b-http-admin"] } },
    { email: { startsWith: "p3a-admin-" } }, { email: { startsWith: "p3a-editor-" } },
    { email: { startsWith: "provisioned-" } }, { email: { startsWith: "admin-two-" } }, { email: { startsWith: "admin-three-" } },
    { email: { startsWith: "prompt3b-qa-admin-" } }, { email: { startsWith: "prompt3b-qa-editor-" } }, { email: { startsWith: "prompt3b-http-admin-" } },
  ] }, select: { id: true } });
  const qaUserIds = qaUsers.map((user) => user.id);
  const tenantResidue = await db.tenant.count({ where: { OR: [
    { slug: { startsWith: "prompt3a-" } }, { slug: { startsWith: "prompt3b-fixture-" } },
    { slug: { startsWith: "prompt3b-http-fixture-" } }, { slug: { startsWith: "prompt2-workflow-" } },
    { slug: { startsWith: "prompt2-other-" } },
  ] } });
  const domainResidue = await db.tenantDomain.count({ where: { hostname: { startsWith: "prompt3b-" } } });
  const pageResidue = await db.pageContent.count({ where: { body: { in: ["QA privacy", "HTTP QA privacy"] } } });
  const contactResidue = await db.contactSubmission.count({ where: { OR: [
    { email: { in: ["http@example.com", "qa@example.com", "callback@example.com"] } },
    { reference: { startsWith: "QA-" } },
  ] } });
  const drafts = await db.cmsDraft.findMany({ where: { OR: [{ createdBy: { in: qaUserIds } }, { assignedTo: { in: qaUserIds } }, { publishedBy: { in: qaUserIds } }] }, select: { id: true, targetId: true } });
  const draftResidue = drafts.length;
  const media = await db.mediaAsset.findMany({ where: { OR: [{ createdBy: { in: qaUserIds } }, { altText: { in: ["QA annual report", "HTTP QA PDF", "HTTP QA image"] } }, { objectKey: { startsWith: "qa/retired-" } }] }, select: { id: true, objectKey: true } });
  const mediaResidue = media.length;
  const formsResidue = await db.formDocument.count({ where: { title: { in: ["QA annual", "HTTP QA Annual"] } } });
  const leadershipResidue = await db.leadershipRecord.count({ where: { name: { in: ["HTTP QA"] } } });
  const rateRows = await db.contactRateLimit.findMany({ where: { OR: [{ key: { startsWith: "prompt3b-" } }, { key: { startsWith: "qa-http-" } }, { ipAddress: { startsWith: "prompt3b-" } }, { ipAddress: { startsWith: "qa-http-" } }] }, select: { id: true, key: true, ipAddress: true } });
  const rateResidue = rateRows.length;
  const loginRows = await db.staffLoginAttempt.findMany({ where: { OR: [
    { key: { startsWith: "qa@example.invalid|" } }, { key: { contains: "missing-" } },
    { key: { contains: "direct-missing-" } }, { key: { contains: "blocked-" } },
    { key: { contains: "direct-blocked-" } }, { key: { contains: "p3a-admin-" } },
    { key: { contains: "p3a-editor-" } }, { key: { contains: "provisioned-" } },
    { key: { contains: "admin-two-" } }, { key: { contains: "admin-three-" } },
  ] }, select: { id: true, key: true } });
  const loginAttemptResidue = loginRows.length;
  const auditResidue = await db.auditLog.count({ where: { OR: [{ actorUserId: { in: qaUserIds } }, { targetId: { in: [...drafts.map((draft) => draft.id), ...drafts.flatMap((draft) => draft.targetId ? [draft.targetId] : []), ...media.map((row) => row.id)] } }] } });
  const environment = getServerEnvironment();
  const client = getR2Client();
  const objects: string[] = [];
  let continuationToken: string | undefined;
  do {
    const listed = await client.send(new ListObjectsV2Command({ Bucket: environment.R2_BUCKET_NAME, ContinuationToken: continuationToken }));
    objects.push(...(listed.Contents ?? []).flatMap((item) => item.Key ? [item.Key] : []));
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
  const qaObjectKeys = objects.filter((key) => /(^|\/)(qa\/retired-|prompt2-workflow-[^/]+\/|prompt3b-fixture-[^/]+\/|prompt3b-http-[^/]+\/|http-qa(?:\/|-|$))/i.test(key));
  const objectResidue = qaObjectKeys.length;
  assert(qaUsers.length === 0, "QA users remain");
  assert(tenantResidue === 0, "QA tenants remain");
  assert(pageResidue === 0, "QA PageContent remains");
  assert(contactResidue === 0, "QA contacts remain");
  assert(draftResidue === 0, "QA drafts remain");
  assert(mediaResidue === 0, "QA media rows remain");
  assert(formsResidue === 0, "QA reports/forms remain");
  assert(leadershipResidue === 0, "QA leadership remains");
  assert(rateResidue === 0, `QA rate-limit fixtures remain (count=${rateResidue}, rows=${JSON.stringify(rateRows)})`);
  assert(loginAttemptResidue === 0, `QA staff login attempts remain (count=${loginAttemptResidue}, rows=${JSON.stringify(loginRows)})`);
  assert(auditResidue === 0, "QA audit logs remain");
  assert(domainResidue === 0, "QA domains remain");
  assert(objectResidue === 0, `QA R2 objects remain (count=${objectResidue}, keys=${JSON.stringify(qaObjectKeys)})`);
  console.info(JSON.stringify({ script: "check-qa-residue", assertions }));
}

main().finally(() => db.$disconnect());