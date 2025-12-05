import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "auto",
//   endpoint: process.env.AWS_ENDPOINT, // Leave empty for real AWS, fill for R2/Supabase
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadImage(
  base64Data: string,
  filename: string,
  contentType: string = "image/jpeg"
) {
  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, "base64");

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: contentType,
    // ACL: "public-read", // Uncomment if your bucket requires this for public access
  });

  try {
    await s3Client.send(command);
    
    // Construct the public URL
    let publicUrl: string;
    
    if (process.env.AWS_PUBLIC_URL) {
      // Use custom public URL if provided (for CloudFront, custom domains, etc.)
      publicUrl = `${process.env.AWS_PUBLIC_URL}/${filename}`;
    } else {
      // Default AWS S3 public URL format
      const region = process.env.AWS_REGION || "us-east-1";
      const bucket = process.env.AWS_BUCKET_NAME;
      publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${filename}`;
    }
    
    return publicUrl;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}