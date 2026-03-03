import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "../../config/r2.js";

export const generateSignedUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(r2Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return url;
};