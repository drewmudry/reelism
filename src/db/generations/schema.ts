import { relations } from "drizzle-orm";
import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "../users/schema";
import { avatars } from "../avatars/schema";

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    triggerJobId: text("trigger_job_id"),
    prompt: jsonb("prompt").notNull(),
    status: text("status")
      .$type<"pending" | "processing" | "completed" | "failed">()
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("generations_userId_idx").on(table.userId),
    index("generations_triggerJobId_idx").on(table.triggerJobId),
    index("generations_status_idx").on(table.status),
  ]
);

export const generationsRelations = relations(generations, ({ one, many }) => ({
  // Relation to the user who requested the generation
  user: one(user, {
    fields: [generations.userId],
    references: [user.id],
  }),
  // Relation to avatars created from this generation
  avatars: many(avatars),
}));

