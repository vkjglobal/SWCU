import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

export type R2Configuration = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export function createR2Client(configuration: R2Configuration): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: configuration.endpoint,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}

export async function checkR2ClientConnectivity(
  client: S3Client,
  configuration: Pick<R2Configuration, "bucketName">,
): Promise<void> {
  await client.send(
    new ListObjectsV2Command({
      Bucket: configuration.bucketName,
      Prefix: "swcu/",
      MaxKeys: 1,
    }),
  );
}