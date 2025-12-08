import { relations } from "drizzle-orm";
import { pgTable, uuid, text, jsonb, timestamp, boolean, numeric, index } from "drizzle-orm/pg-core";
import { user } from "../users/schema";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<"external" | "custom">()
      .notNull(),
    sourceUrl: text("source_url"),
    title: text("title"),
    description: text("description"),
    price: numeric("price"),
    images: jsonb("images").$type<string[]>().default([]).notNull(),
    parsed: boolean("parsed").default(false).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("products_userId_idx").on(table.userId),
    index("products_type_idx").on(table.type),
    index("products_parsed_idx").on(table.parsed),
  ]
);

export const productsRelations = relations(products, ({ one }) => ({
  user: one(user, {
    fields: [products.userId],
    references: [user.id],
  }),
}));
