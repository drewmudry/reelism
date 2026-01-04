import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, bigint, index, jsonb, integer } from "drizzle-orm/pg-core";
import { user } from "../users/schema";
import { products } from "../products/schema";

export type TalkingHeadRegion = {
  x: number; // X position as percentage (0-100)
  y: number; // Y position as percentage (0-100)
  width: number; // Width as percentage (0-100)
  height: number; // Height as percentage (0-100)
  startTime?: number; // Optional: start time in seconds
  endTime?: number; // Optional: end time in seconds
};

export const demos = pgTable(
  "demos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(), // File size in bytes
    title: text("title"),
    description: text("description"),
    width: integer("width"), // Video width in pixels
    height: integer("height"), // Video height in pixels
    talkingHeadRegions: jsonb("talking_head_regions").$type<TalkingHeadRegion[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("demos_user_id_idx").on(table.userId),
    index("demos_product_id_idx").on(table.productId),
  ]
);

export const demosRelations = relations(demos, ({ one }) => ({
  user: one(user, {
    fields: [demos.userId],
    references: [user.id],
  }),
  product: one(products, {
    fields: [demos.productId],
    references: [products.id],
  }),
}));

