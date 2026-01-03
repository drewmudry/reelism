"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { getDemoUploadPresignedUrl, createDemoRecord } from "@/actions/demos";
import FileUpload from "@/components/kokonutui/file-upload";

export function DemoModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUploadSuccess = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsUploading(true);

    try {
      // 1. Get presigned URL
      const { uploadUrl, publicUrl } = await getDemoUploadPresignedUrl(
        uploadedFile.name,
        uploadedFile.type
      );

      // 2. Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: uploadedFile,
        headers: { "Content-Type": uploadedFile.type },
      });

      // 3. Save to DB
      await createDemoRecord({
        url: publicUrl,
        filename: uploadedFile.name,
        mimeType: uploadedFile.type,
        size: uploadedFile.size,
        title: title || uploadedFile.name,
      });

      setOpen(false);
      setFile(null);
      setTitle("");
      window.location.reload();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. Check console.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUploadError = (error: { message: string; code: string }) => {
    console.error("File upload error:", error);
    alert(`Upload error: ${error.message}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload Demo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Demo</DialogTitle>
          <DialogDescription>
            Upload a video demo to showcase your work.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="text-sm font-medium mb-2 block">
              Title (optional)
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Demo title"
              disabled={isUploading}
            />
          </div>
          <FileUpload
            onUploadSuccess={handleFileUploadSuccess}
            onUploadError={handleFileUploadError}
            accept="video/*"
            maxSize={100 * 1024 * 1024} // 100MB
            uploadDelay={0} // Disable simulation, we'll handle real upload
          />
          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading ...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

