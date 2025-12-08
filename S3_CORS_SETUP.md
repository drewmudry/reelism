# S3 CORS Configuration for Direct Uploads

To enable direct browser uploads to S3, you need to configure CORS on your S3 bucket.

## AWS S3 Console Method

1. Go to AWS S3 Console → Your Bucket → **Permissions** tab
2. Scroll to **Cross-origin resource sharing (CORS)**
3. Click **Edit** and add this configuration:

```json
[
  {
    "AllowedHeaders": [
      "Content-Type",
      "x-amz-date",
      "Authorization",
      "x-amz-content-sha256",
      "x-amz-user-agent"
    ],
    "AllowedMethods": [
      "PUT",
      "POST",
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://affili8.ai"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

**Important:** Replace `"https://yourdomain.com"` with your actual production domain.

## For Development

If you're using `localhost:3000` for development, make sure it's in the `AllowedOrigins` array.

## For Production

Add your production domain(s) to `AllowedOrigins`. You can add multiple origins:

```json
"AllowedOrigins": [
  "http://localhost:3000",
  "https://yourdomain.com",
  "https://www.yourdomain.com"
]
```

## Alternative: AWS CLI

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://cors.json
```

Where `cors.json` contains the JSON configuration above.

## Testing

After configuring CORS, try uploading an image again. The error should be resolved.

## Troubleshooting

- **Still getting CORS errors?** Check the browser console Network tab to see the exact CORS error
- **403 Forbidden?** Check your bucket policy allows PUT operations
- **Presigned URL expired?** URLs expire after 5 minutes by default
