import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable('events', {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    date: text("date").notNull(),
});