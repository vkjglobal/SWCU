import { z } from "zod";
import {
  checkR2ClientConnectivity,
  createR2Client,
} from "../src/lib/r2-core";

const configuration = z
  .object({
    R2_ENDPOINT: z.url(),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
  })
  .parse(process.env);

const client = createR2Client({
  endpoint: configuration.R2_ENDPOINT,
  accessKeyId: configuration.R2_ACCESS_KEY_ID,
  secretAccessKey: configuration.R2_SECRET_ACCESS_KEY,
  bucketName: configuration.R2_BUCKET_NAME,
});

checkR2ClientConnectivity(client, {
  bucketName: configuration.R2_BUCKET_NAME,
})
  .then(() => {
    console.info("R2 connectivity check passed.");
  })
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`R2 connectivity check failed: ${name}`);
    process.exitCode = 1;
  });