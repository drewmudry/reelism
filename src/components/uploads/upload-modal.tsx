"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getUploadPresignedUrl, createUploadRecord } from "@/actions/uploads";
import { Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/kokonutui/file-upload";

export function UploadModal() {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const router = useRouter();

  // Auto-detect file type from MIME type (only images and videos allowed)
  const detectFileType = (mimeType: string): "video" | "image" => {
    if (mimeType.startsWith("image/")) {
      return "image";
    }
    if (mimeType.startsWith("video/")) {
      return "video";
    }
    // Default to image if unknown (shouldn't happen with acceptedFileTypes)
    return "image";
  };

  // Get accepted file types for upload
  const getAcceptedFileTypes = (): string[] => {
    return [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
    ];
  };

  const handleFileUploadSuccess = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsUploading(true);
    try {
      // Auto-detect type from file MIME type
      const detectedType = detectFileType(uploadedFile.type);

      // 1. Get Presigned URL
      const { uploadUrl, publicUrl } = await getUploadPresignedUrl(
        uploadedFile.name,
        uploadedFile.type,
        detectedType
      );

      // 2. Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: uploadedFile,
        headers: { "Content-Type": uploadedFile.type },
      });

      // 3. Save to DB
      await createUploadRecord({
        url: publicUrl,
        filename: uploadedFile.name,
        mimeType: uploadedFile.type,
        size: uploadedFile.size,
        type: detectedType,
        title: title || uploadedFile.name,
        demo: false, // Regular uploads are not demos
      });

      setOpen(false);
      setFile(null);
      setTitle("");
      router.refresh();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. Check console.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUploadError = (error: { message: string; code: string }) => {
    console.error("File validation error:", error);
    alert(error.message);
  };

  const handleFileRemove = () => {
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UploadCloud className="h-4 w-4" /> Upload Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Content</DialogTitle>
        </DialogHeader>
        <form className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Enter title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">File</label>
            <FileUpload
              onUploadSuccess={handleFileUploadSuccess}
              onUploadError={handleFileUploadError}
              acceptedFileTypes={getAcceptedFileTypes()}
              currentFile={file}
              onFileRemove={handleFileRemove}
              uploadDelay={0} // Disable simulation, we'll handle real upload
              maxFileSize={100 * 1024 * 1024} // 100MB max
            />
          </div>

          {isUploading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading...</span>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
