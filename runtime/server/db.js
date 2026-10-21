import { drizzle } from "drizzle-orm/d1";
import { schema } from "#framecore-cms/config";

export function useDrizzle(db) {
  return drizzle(db, { schema });
}
