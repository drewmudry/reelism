ALTER TABLE "video_jobs" ADD COLUMN "completed_composite_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "completed_veo_call_ids" jsonb DEFAULT '[]'::jsonb;