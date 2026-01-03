CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avatars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text,
	"prompt" jsonb NOT NULL,
	"user_id" text,
	"generation_id" uuid,
	"remixed_from_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trigger_job_id" text,
	"prompt" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"source_url" text,
	"title" text,
	"description" text,
	"price" numeric,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parsed" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"title" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_url" text,
	"prompt" text NOT NULL,
	"avatar_id" uuid NOT NULL,
	"user_id" text,
	"generation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_remixed_from_id_avatars_id_fk" FOREIGN KEY ("remixed_from_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demos" ADD CONSTRAINT "demos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animations" ADD CONSTRAINT "animations_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animations" ADD CONSTRAINT "animations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animations" ADD CONSTRAINT "animations_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "avatars_userId_idx" ON "avatars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "avatars_generationId_idx" ON "avatars" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "generations_userId_idx" ON "generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generations_triggerJobId_idx" ON "generations" USING btree ("trigger_job_id");--> statement-breakpoint
CREATE INDEX "generations_status_idx" ON "generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_userId_idx" ON "products" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("type");--> statement-breakpoint
CREATE INDEX "products_parsed_idx" ON "products" USING btree ("parsed");--> statement-breakpoint
CREATE INDEX "demos_user_id_idx" ON "demos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "animations_userId_idx" ON "animations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "animations_avatarId_idx" ON "animations" USING btree ("avatar_id");--> statement-breakpoint
CREATE INDEX "animations_generationId_idx" ON "animations" USING btree ("generation_id");