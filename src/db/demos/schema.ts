import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, bigint, index } from "drizzle-orm/pg-core";
import { user } from "../users/schema";

export const demos = pgTable(
  "demos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(), // File size in bytes
    title: text("title"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("demos_user_id_idx").on(table.userId),
  ]
);

export const demosRelations = relations(demos, ({ one }) => ({
  user: one(user, {
    fields: [demos.userId],
    references: [user.id],
  }),
}));

