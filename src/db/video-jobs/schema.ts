import { relations } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { user } from "../users/schema";
import { products } from "../products/schema";
import { avatars } from "../avatars/schema";

export const videoJobs = pgTable(
  "video_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    avatarId: uuid("avatar_id")
      .notNull()
      .references(() => avatars.id, { onDelete: "cascade" }),

    // User inputs
    demoIds: jsonb("demo_ids").$type<string[]>().default([]).notNull(),
    tone: text("tone").notNull(), // "energetic and playful", "calm and authentic", etc.
    targetDuration: integer("target_duration").notNull(), // 16, 20, or 24

    // Pipeline state
    status: text("status").notNull().default("pending"),
    // pending → planning → generating_composites → generating_video → assembling → completed | failed

    triggerJobId: text("trigger_job_id"), // trigger.dev job ID for tracking

    // Director output (the full plan)
    directorPlan: jsonb("director_plan").$type<Record<string, unknown>>(),

    // Generated assets (URLs)
    compositeImageIds: jsonb("composite_image_ids").$type<string[]>().default([]),
    veoClipUrls: jsonb("veo_clip_urls").$type<string[]>().default([]),
    
    // Step tracking for resumable pipeline
    completedCompositeIds: jsonb("completed_composite_ids").$type<string[]>().default([]),
    completedVeoCallIds: jsonb("completed_veo_call_ids").$type<string[]>().default([]),

    // Final output
    finalVideoUrl: text("final_video_url"),
    finalDuration: integer("final_duration"), // actual duration in seconds

    // Error tracking
    error: text("error"),
    errorStep: text("error_step"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("video_jobs_user_id_idx").on(table.userId),
    index("video_jobs_product_id_idx").on(table.productId),
    index("video_jobs_status_idx").on(table.status),
    index("video_jobs_trigger_job_id_idx").on(table.triggerJobId),
  ]
);

export const videoJobsRelations = relations(videoJobs, ({ one }) => ({
  user: one(user, {
    fields: [videoJobs.userId],
    references: [user.id],
  }),
  product: one(products, {
    fields: [videoJobs.productId],
    references: [products.id],
  }),
  avatar: one(avatars, {
    fields: [videoJobs.avatarId],
    references: [avatars.id],
  }),
}));

export type VideoJob = typeof videoJobs.$inferSelect;
export type NewVideoJob = typeof videoJobs.$inferInsert;

