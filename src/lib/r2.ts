import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFile } from "fs/promises";

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

function required(name: string, value?: string): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${required("R2_ACCOUNT_ID", accountId)}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID", accessKeyId),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY", secretAccessKey),
    },
  });
}

export function getR2Bucket(): string {
  return required("R2_BUCKET", bucket);
}

export async function uploadFileToR2(params: {
  key: string;
  filePath: string;
  contentType?: string;
}) {
  const client = getClient();
  const body = await readFile(params.filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: params.key,
      Body: body,
      ContentType: params.contentType || "video/mp4",
      ContentDisposition: `inline; filename="${encodeURIComponent(params.key.split("/").pop() || "video.mp4")}"`,
    })
  );
}

export async function getSignedR2Url(params: {
  key: string;
  download?: boolean;
  filename?: string;
  expiresInSeconds?: number;
}) {
  const client = getClient();
  const filename = params.filename || params.key.split("/").pop() || "video.mp4";

  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: params.key,
    ResponseContentDisposition: params.download
      ? `attachment; filename="${encodeURIComponent(filename)}"`
      : `inline; filename="${encodeURIComponent(filename)}"`,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 60 * 30,
  });
}
