import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Re-export the layer-owned `users` table so that the CMS routes can
// resolve it through `~~/server/db/schema`.
export { users } from "../../../server/db/schema";

// Demo table to exercise the CMS in the playground.
export const demo_items = sqliteTable("demo_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
