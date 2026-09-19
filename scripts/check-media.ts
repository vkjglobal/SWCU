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

const testEmail = `prompt2-media-qa-${Date.now()}@example.invalid`;
const mediaIds: string[] = [];
const objectKeys: string[] = [];
const heroSlideIds: string[] = [];
const formDocumentIds: string[] = [];
let userId: string | undefined;

async function main() {
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
      isEnabled: false,
      sortOrder: 99,
    },
  });
  formDocumentIds.push(formDocument.id);

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
    }),
  );
}

async function cleanup() {
  const environment = getServerEnvironment();
  if (heroSlideIds.length) {
    await db.homeHeroSlide.deleteMany({ where: { id: { in: heroSlideIds } } });
  }
  if (formDocumentIds.length) {
    await db.formDocument.deleteMany({
      where: { id: { in: formDocumentIds } },
    });
  }
  if (mediaIds.length) {
    await db.auditLog.deleteMany({
      where: { targetType: "MediaAsset", targetId: { in: mediaIds } },
    });
    await db.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
  }
  if (userId) {
    await db.user.deleteMany({ where: { id: userId } });
  }
  await Promise.all(
    objectKeys.map((Key) =>
      getR2Client().send(
        new DeleteObjectCommand({
          Bucket: environment.R2_BUCKET_NAME,
          Key,
        }),
      ),
    ),
  );
  getR2Client().destroy();
  await db.$disconnect();
}

main()
  .finally(cleanup)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });