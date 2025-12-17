"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getUploadPresignedUrl, createUploadRecord } from "@/actions/uploads";
import { Loader2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/kokonutui/file-upload";

export function DemoModal() {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const router = useRouter();

  // Get accepted file types for demos (videos only)
  const getAcceptedFileTypes = (): string[] => {
    return [
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
      // Demos are always videos
      const type = "video";

      // 1. Get Presigned URL
      const { uploadUrl, publicUrl } = await getUploadPresignedUrl(
        uploadedFile.name,
        uploadedFile.type,
        type
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
        type: type,
        title: title || uploadedFile.name,
        demo: true, // This is a demo
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
          <Video className="h-4 w-4" /> Add Demo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Demo</DialogTitle>
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
            <label className="text-sm font-medium">Video File</label>
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
              <span>Uploading ...</span>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
