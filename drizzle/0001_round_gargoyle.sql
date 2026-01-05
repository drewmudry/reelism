CREATE TABLE "video_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"avatar_id" uuid NOT NULL,
	"demo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone" text NOT NULL,
	"target_duration" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_job_id" text,
	"director_plan" jsonb,
	"composite_image_ids" jsonb DEFAULT '[]'::jsonb,
	"veo_clip_urls" jsonb DEFAULT '[]'::jsonb,
	"tts_audio_url" text,
	"final_video_url" text,
	"final_duration" integer,
	"error" text,
	"error_step" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "composite_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"avatar_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_image_indices" jsonb NOT NULL,
	"prompt" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexed_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"avatar_id" uuid,
	"product_id" uuid NOT NULL,
	"composite_image_id" uuid,
	"type" text NOT NULL,
	"duration" real NOT NULL,
	"description" text NOT NULL,
	"script" text,
	"veo_prompt" text NOT NULL,
	"audio_mood" text,
	"file_url" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hooks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_images" ADD CONSTRAINT "composite_images_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_images" ADD CONSTRAINT "composite_images_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_images" ADD CONSTRAINT "composite_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_clips" ADD CONSTRAINT "indexed_clips_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_clips" ADD CONSTRAINT "indexed_clips_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_clips" ADD CONSTRAINT "indexed_clips_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexed_clips" ADD CONSTRAINT "indexed_clips_composite_image_id_composite_images_id_fk" FOREIGN KEY ("composite_image_id") REFERENCES "public"."composite_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_jobs_user_id_idx" ON "video_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_jobs_product_id_idx" ON "video_jobs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "video_jobs_status_idx" ON "video_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "video_jobs_trigger_job_id_idx" ON "video_jobs" USING btree ("trigger_job_id");--> statement-breakpoint
CREATE INDEX "composite_images_avatar_id_idx" ON "composite_images" USING btree ("avatar_id");--> statement-breakpoint
CREATE INDEX "composite_images_product_id_idx" ON "composite_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "indexed_clips_product_id_idx" ON "indexed_clips" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "indexed_clips_type_idx" ON "indexed_clips" USING btree ("type");--> statement-breakpoint
CREATE INDEX "indexed_clips_usage_count_idx" ON "indexed_clips" USING btree ("usage_count");