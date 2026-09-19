import "server-only";

import type { S3Client } from "@aws-sdk/client-s3";
import { getServerEnvironment } from "@/lib/env";
import {
  checkR2ClientConnectivity,
  createR2Client,
  getR2Object,
  putR2Object,
} from "@/lib/r2-core";

let client: S3Client | undefined;

export function getR2Client(): S3Client {
  const environment = getServerEnvironment();

  client ??= createR2Client({
    endpoint: environment.R2_ENDPOINT,
    accessKeyId: environment.R2_ACCESS_KEY_ID,
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    bucketName: environment.R2_BUCKET_NAME,
  });

  return client;
}

export async function checkR2Connectivity(): Promise<void> {
  const environment = getServerEnvironment();
  await checkR2ClientConnectivity(getR2Client(), {
    bucketName: environment.R2_BUCKET_NAME,
  });
}

export async function uploadMediaObject(objectKey: string, body: Uint8Array, contentType: string) {
  const environment = getServerEnvironment();
  return putR2Object(getR2Client(), { bucketName: environment.R2_BUCKET_NAME }, objectKey, body, contentType);
}

export async function readMediaObject(objectKey: string) {
  const environment = getServerEnvironment();
  return getR2Object(getR2Client(), { bucketName: environment.R2_BUCKET_NAME }, objectKey);
}