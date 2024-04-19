import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    date: text('date').notNull(),
    notify_type: text('notify_type').notNull(),
    channel_id: text('channel_id')
        .notNull()
        .references(() => channels.id),
});

export const mention_users = sqliteTable('mention_users', {
    event_id: integer('event_id')
        .primaryKey()
        .references(() => events.id),
    user_id: text('user_id')
        .notNull()
        .references(() => users.id),
});

export const mention_roles = sqliteTable('mention_roles', {
    event_id: integer('event_id')
        .primaryKey()
        .references(() => events.id),
    role_id: text('role_id')
        .notNull()
        .references(() => roles.id),
});

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});

export const roles = sqliteTable('roles', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});

export const channels = sqliteTable('channels', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});
