import { File as NodeFile } from "node:buffer";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { db } from "../src/lib/db";
import {
  replaceMedia,
  uploadDocument,
  uploadMedia,
} from "../src/lib/media-service";
import { getR2Client, readMediaObject } from "../src/lib/r2";
import { getServerEnvironment } from "../src/lib/env";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";
import { buildMediaDownloadHeaders, safeDownloadFilename } from "../src/lib/media-download";

const testEmail = `prompt2-media-qa-${Date.now()}@example.invalid`;
const mediaIds: string[] = [];
const objectKeys: string[] = [];
const heroSlideIds: string[] = [];
const formDocumentIds: string[] = [];
const tenantIds: string[] = [];
const tenantDomainIds: string[] = [];
let userId: string | undefined;
const routeHost = process.env.REPLIT_DEV_DOMAIN;
const routeBase = process.env.MEDIA_QA_BASE_URL ?? (routeHost ? `https://${routeHost}` : undefined);

async function requestMediaRoute(mediaId: string, host?: string) {
  const forwardedHost = host ?? routeHost;
  if (!routeBase || !routeHost || !forwardedHost) throw new Error("REPLIT_DEV_DOMAIN is required for live media route QA.");
  const url = new URL(`/api/media/${mediaId}`, routeBase);
  return fetch(url, { headers: { host: routeHost, "x-forwarded-host": forwardedHost } });
}

async function assertApplicationNotFound(response: Response | null, label: string) {
  if (!response || response.status !== 404 || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`${label} did not return an application-origin JSON 404 (status=${response?.status ?? "none"}, content-type=${response?.headers.get("content-type") ?? "none"}).`);
  }
  const body = await response.json() as { error?: unknown };
  if (body.error !== "Media not found") throw new Error(`${label} returned an unexpected 404 response.`);
}

async function main() {
  assertQaExecutionSafe();
  if (!routeBase || !routeHost) throw new Error("REPLIT_DEV_DOMAIN is required for live media route QA.");
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "swcu" },
    select: { id: true, slug: true, displayName: true },
  });
  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Prompt 2 Media QA",
      email: testEmail,
      emailVerified: false,
    },
  });
  userId = user.id;
  const crossTenant = await db.tenant.create({
    data: {
      slug: `prompt2-media-cross-tenant-${Date.now()}`,
      displayName: "Prompt 2 Media Cross Tenant QA",
    },
  });
  tenantIds.push(crossTenant.id);
  const crossTenantHost = `prompt2-media-cross-${Date.now()}.invalid`;
  const crossTenantDomain = await db.tenantDomain.create({
    data: { tenantId: crossTenant.id, hostname: crossTenantHost, isPrimary: true },
  });
  tenantDomainIds.push(crossTenantDomain.id);

  const firstBuffer = await sharp({
    create: {
      width: 2400,
      height: 1400,
      channels: 3,
      background: "#176DB3",
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const first = await uploadMedia({
    tenant,
    actorUserId: user.id,
    purpose: "general",
    altText: "Prompt 2 media validation image",
    file: new NodeFile([firstBuffer], "prompt2-media-qa.jpg", {
      type: "image/jpeg",
    }) as unknown as File,
  });
  mediaIds.push(first.id);
  objectKeys.push(first.objectKey);
  const heroSlide = await db.homeHeroSlide.create({
    data: {
      tenantId: tenant.id,
      mediaAssetId: first.id,
      altText: first.altText ?? "Prompt 2 media validation image",
      sortOrder: 99,
      isEnabled: false,
    },
  });
  heroSlideIds.push(heroSlide.id);

  const replacementBuffer = await sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 4,
      background: { r: 22, g: 136, b: 135, alpha: 0.7 },
    },
  })
    .png()
    .toBuffer();
  const replacement = await replaceMedia({
    tenant,
    actorUserId: user.id,
    mediaId: first.id,
    altText: "Prompt 2 replacement validation image",
    file: new NodeFile([replacementBuffer], "prompt2-media-replacement.png", {
      type: "image/png",
    }) as unknown as File,
  });
  mediaIds.push(replacement.id);
  objectKeys.push(replacement.objectKey);

  const pdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
    "ascii",
  );
  const document = await uploadDocument({
    tenant,
    actorUserId: user.id,
    altText: "Prompt 2 PDF validation document",
    file: new NodeFile([pdfBuffer], "prompt2-media-document.pdf", {
      type: "application/pdf",
    }) as unknown as File,
  });
  mediaIds.push(document.id);
  objectKeys.push(document.objectKey);
  const formDocument = await db.formDocument.create({
    data: {
      tenantId: tenant.id,
      mediaAssetId: document.id,
      title: "Prompt 2 media QA form",
      isEnabled: true,
      sortOrder: 99,
    },
  });
  formDocumentIds.push(formDocument.id);
  const replacementPdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
    "ascii",
  );
  const pdfReplacement = await replaceMedia({
    tenant,
    actorUserId: user.id,
    mediaId: document.id,
    altText: "Prompt 2 replacement PDF validation document",
    file: new NodeFile([replacementPdfBuffer], "prompt2-media-document-replacement.pdf", {
      type: "application/pdf",
    }) as unknown as File,
  });
  mediaIds.push(pdfReplacement.id);
  objectKeys.push(pdfReplacement.objectKey);

  const downloadHeaders = buildMediaDownloadHeaders({
    mimeType: document.mimeType,
    filename: document.originalFilename,
    isPdf: true,
    cacheControl: "no-store",
  });
  if (
    document.mimeType !== "application/pdf" ||
    safeDownloadFilename(document.originalFilename, document.mimeType) !== "prompt2-media-document.pdf" ||
    downloadHeaders.get("content-type") !== "application/pdf" ||
    downloadHeaders.get("content-disposition") !== 'attachment; filename="prompt2-media-document.pdf"'
  ) throw new Error("PDF download headers did not pass the safe filename/content-type regression.");
  await db.formDocument.update({ where: { id: formDocument.id }, data: { isEnabled: false } });
  const disabledDocument = await db.formDocument.findUniqueOrThrow({ where: { id: formDocument.id } });
  if (disabledDocument.isEnabled) throw new Error("Disabled form document regression fixture was not disabled.");
  await db.formDocument.update({ where: { id: formDocument.id }, data: { isEnabled: true } });

  const [
    oldRecord,
    newRecord,
    updatedHero,
    oldObject,
    newObject,
    pdfObject,
    auditCount,
  ] =
    await Promise.all([
      db.mediaAsset.findUniqueOrThrow({ where: { id: first.id } }),
      db.mediaAsset.findUniqueOrThrow({ where: { id: replacement.id } }),
      db.homeHeroSlide.findUniqueOrThrow({ where: { id: heroSlide.id } }),
      readMediaObject(first.objectKey),
      readMediaObject(replacement.objectKey),
      readMediaObject(document.objectKey),
      db.auditLog.count({
        where: {
          tenantId: tenant.id,
          targetType: "MediaAsset",
          targetId: { in: [first.id, replacement.id, document.id] },
        },
      }),
    ]);

  if (!oldRecord.retiredAt || oldRecord.replacedById !== replacement.id) {
    throw new Error("Replacement did not retire and link the original media.");
  }
  if (newRecord.retiredAt) {
    throw new Error("Replacement media should remain active.");
  }
  if (updatedHero.mediaAssetId !== replacement.id) {
    throw new Error("Replacement did not update the linked Hero slide.");
  }
  if (!oldObject.Body || !newObject.Body || !pdfObject.Body) {
    throw new Error("Original, replacement, and PDF objects must remain readable.");
  }
  if (
    first.width > 2000 ||
    first.height > 2000 ||
    first.mimeType !== "image/webp"
  ) {
    throw new Error("JPEG processing did not produce the expected web image.");
  }
  if (replacement.mimeType !== "image/png") {
    throw new Error("Transparent PNG processing did not preserve transparency.");
  }
  if (
    document.mimeType !== "application/pdf" ||
    !document.objectKey.includes("/documents/forms/")
  ) {
    throw new Error("PDF processing did not use the expected document path.");
  }
  if (auditCount < 3) {
    throw new Error("Expected upload and replacement audit records were not created.");
  }

  let routeMatrix = "pending";
  if (routeBase) {
    const publishedResponse = await requestMediaRoute(pdfReplacement.id);
    if (!publishedResponse || publishedResponse.status !== 200) throw new Error("Published media route request failed.");
    const publishedBytes = Buffer.from(await publishedResponse.arrayBuffer());
    if (
      !publishedBytes.equals(replacementPdfBuffer) ||
      publishedResponse.headers.get("content-type") !== "application/pdf" ||
      publishedResponse.headers.get("content-disposition") !== 'attachment; filename="prompt2-media-document-replacement.pdf"'
    ) throw new Error("Published media route did not return exact PDF bytes and safe headers.");

    await db.formDocument.update({ where: { id: formDocument.id }, data: { isEnabled: false } });
    const disabledResponse = await requestMediaRoute(pdfReplacement.id);
    await assertApplicationNotFound(disabledResponse, "Disabled media");
    await db.formDocument.update({ where: { id: formDocument.id }, data: { isEnabled: true } });

    const retiredResponse = await requestMediaRoute(first.id);
    await assertApplicationNotFound(retiredResponse, "Retired media");
    const missingResponse = await requestMediaRoute("missing-media-qa-id");
    await assertApplicationNotFound(missingResponse, "Missing media");

    const replacementResponse = await requestMediaRoute(pdfReplacement.id);
    if (!replacementResponse || replacementResponse.status !== 200) throw new Error("Replacement media route request failed.");
    const replacementBytes = Buffer.from(await replacementResponse.arrayBuffer());
    if (
      !replacementBytes.equals(replacementPdfBuffer) ||
      replacementResponse.headers.get("content-type") !== "application/pdf" ||
      replacementResponse.headers.get("content-disposition") !== 'attachment; filename="prompt2-media-document-replacement.pdf"'
    ) throw new Error("Replacement PDF route did not return exact bytes and safe headers.");

    const wrongTenantResponse = await requestMediaRoute(pdfReplacement.id, crossTenantHost);
    await assertApplicationNotFound(wrongTenantResponse, "Wrong-tenant media");

    await getR2Client().send(new DeleteObjectCommand({
      Bucket: getServerEnvironment().R2_BUCKET_NAME,
      Key: pdfReplacement.objectKey,
    }));
    const missingObjectResponse = await requestMediaRoute(pdfReplacement.id);
    if (!missingObjectResponse || missingObjectResponse.status !== 404 || !missingObjectResponse.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Missing R2 object did not return an application-origin JSON 404.");
    }
    const missingObjectBody = await missingObjectResponse.text();
    if (missingObjectBody.includes(pdfReplacement.objectKey)) throw new Error("Missing-object response leaked the private object key.");

    routeMatrix = "passed (published, disabled, retired, wrong-tenant, missing-media, missing-object, replacement)";
  }

  console.info(
    JSON.stringify({
      sharp: "passed",
      r2Upload: "passed",
      databaseMetadata: "passed",
      nonDestructiveReplacement: "passed",
      originalRetired: true,
      originalObjectPreserved: true,
      replacementActive: true,
      referencedContentUpdated: true,
      pdfUpload: "passed",
      routeMatrix,
    }),
  );
}

async function cleanup() {
  const environment = getServerEnvironment();
  const errors: string[] = [];
  const attempt = async (label: string, action: () => Promise<unknown>) => {
    try { await action(); } catch (error) { errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
  };
  const client = getR2Client();
  await attempt("R2 objects", async () => {
    for (const Key of objectKeys) {
      await client.send(new DeleteObjectCommand({ Bucket: environment.R2_BUCKET_NAME, Key }));
    }
  });
  await attempt("Hero slides", async () => { if (heroSlideIds.length) await db.homeHeroSlide.deleteMany({ where: { id: { in: heroSlideIds } } }); });
  await attempt("Form documents", async () => { if (formDocumentIds.length) await db.formDocument.deleteMany({ where: { id: { in: formDocumentIds } } }); });
  await attempt("Media audits", async () => { if (mediaIds.length) await db.auditLog.deleteMany({ where: { targetType: "MediaAsset", targetId: { in: mediaIds } } }); });
  await attempt("Media rows", async () => { if (mediaIds.length) await db.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } }); });
  await attempt("QA tenant domains", async () => { if (tenantDomainIds.length) await db.tenantDomain.deleteMany({ where: { id: { in: tenantDomainIds } } }); });
  await attempt("QA tenants", async () => { if (tenantIds.length) await db.tenant.deleteMany({ where: { id: { in: tenantIds } } }); });
  await attempt("QA user", async () => { if (userId) await db.user.delete({ where: { id: userId } }); });
  client.destroy();
  await db.$disconnect();
  if (errors.length) throw new Error(`Media QA cleanup failures: ${errors.join("; ")}`);
}

main()
  .finally(cleanup)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });