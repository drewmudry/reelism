import { relations } from "drizzle-orm";
import { pgTable, uuid, text, jsonb, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "../users/schema";
import { generations } from "../generations/schema";

export const avatars = pgTable(
  "avatars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageUrl: text("image_url"),
    prompt: jsonb("prompt").notNull(), 
    userId: text("user_id").references(() => user.id, { onDelete: 'set null' }),
    generationId: uuid("generation_id").references(() => generations.id, { onDelete: 'set null' }),
    remixedFromId: uuid("remixed_from_id").references((): AnyPgColumn => avatars.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("avatars_userId_idx").on(table.userId),
    index("avatars_generationId_idx").on(table.generationId),
  ]
);


export const avatarsRelations = relations(avatars, ({ one, many }) => ({
  // Relation to the owner
  user: one(user, {
    fields: [avatars.userId],
    references: [user.id],
  }),

  // Relation to the generation that created this avatar
  generation: one(generations, {
    fields: [avatars.generationId],
    references: [generations.id],
  }),

  // Relation to the "parent" avatar this was remixed from
  remixedFrom: one(avatars, {
    fields: [avatars.remixedFromId],
    references: [avatars.id],
    relationName: "remix_source"
  }),

  // Relation to "children" avatars created from this one
  remixes: many(avatars, {
    relationName: "remix_source"
  }),
}));

