import { relations } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "../users/schema";
import { products } from "../products/schema";
import { avatars } from "../avatars/schema";

export const compositeImages = pgTable(
  "composite_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    avatarId: uuid("avatar_id")
      .notNull()
      .references(() => avatars.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    productImageIndices: jsonb("product_image_indices").$type<number[]>().notNull(), // which product images were used
    prompt: text("prompt").notNull(), // prompt used to generate
    description: text("description").notNull(), // what the composite shows
    imageUrl: text("image_url").notNull(), // stored image URL

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("composite_images_avatar_id_idx").on(table.avatarId),
    index("composite_images_product_id_idx").on(table.productId),
  ]
);

export const compositeImagesRelations = relations(compositeImages, ({ one }) => ({
  user: one(user, {
    fields: [compositeImages.userId],
    references: [user.id],
  }),
  avatar: one(avatars, {
    fields: [compositeImages.avatarId],
    references: [avatars.id],
  }),
  product: one(products, {
    fields: [compositeImages.productId],
    references: [products.id],
  }),
}));

export type CompositeImage = typeof compositeImages.$inferSelect;
export type NewCompositeImage = typeof compositeImages.$inferInsert;

