import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Layer-owned tables.
 *
 * The CMS package owns the `users` table (admin authentication).
 * Consumer projects must override this file in their own
 * `server/db/schema.ts` and re-export `users` alongside their own tables:
 *
 *   export { users } from "framecore-cms/server/db/schema";
 *   export const myTable = sqliteTable(...);
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  resetId: text("reset_id"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
