import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

export async function putR2Object(
  client: S3Client,
  configuration: Pick<R2Configuration, "bucketName">,
  objectKey: string,
  body: Uint8Array,
  contentType: string,
) {
  return client.send(new PutObjectCommand({
    Bucket: configuration.bucketName,
    Key: objectKey,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}

export async function getR2Object(
  client: S3Client,
  configuration: Pick<R2Configuration, "bucketName">,
  objectKey: string,
) {
  return client.send(new GetObjectCommand({ Bucket: configuration.bucketName, Key: objectKey }));
}