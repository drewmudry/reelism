import { relations } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, jsonb, integer, real, index } from "drizzle-orm/pg-core";
import { user } from "../users/schema";
import { products } from "../products/schema";
import { avatars } from "../avatars/schema";
import { compositeImages } from "../composite-images/schema";

export const indexedClips = pgTable(
  "indexed_clips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    avatarId: uuid("avatar_id").references(() => avatars.id, { onDelete: "set null" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    compositeImageId: uuid("composite_image_id").references(() => compositeImages.id, { onDelete: "set null" }),

    // Clip metadata
    type: text("type").notNull(), // 'virtual_broll' | 'product_broll' | 'talking_head'
    duration: real("duration").notNull(), // in seconds

    // Searchable content
    description: text("description").notNull(),
    script: text("script"), // if talking head
    veoPrompt: text("veo_prompt").notNull(), // original prompt used

    // Audio characteristics
    audioMood: text("audio_mood"), // "upbeat", "calm", "aesthetic", etc.

    // Storage
    fileUrl: text("file_url").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),

    // Usage tracking
    usageCount: integer("usage_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("indexed_clips_product_id_idx").on(table.productId),
    index("indexed_clips_type_idx").on(table.type),
    index("indexed_clips_usage_count_idx").on(table.usageCount),
  ]
);

export const indexedClipsRelations = relations(indexedClips, ({ one }) => ({
  user: one(user, {
    fields: [indexedClips.userId],
    references: [user.id],
  }),
  avatar: one(avatars, {
    fields: [indexedClips.avatarId],
    references: [avatars.id],
  }),
  product: one(products, {
    fields: [indexedClips.productId],
    references: [products.id],
  }),
  compositeImage: one(compositeImages, {
    fields: [indexedClips.compositeImageId],
    references: [compositeImages.id],
  }),
}));

export type IndexedClip = typeof indexedClips.$inferSelect;
export type NewIndexedClip = typeof indexedClips.$inferInsert;

