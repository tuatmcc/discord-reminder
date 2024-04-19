import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { events, users, roles, mention_roles, mention_users } from './schema';
import { eq } from 'drizzle-orm';
import { Event, FullEvent } from '../types/event';
import { NotifyType } from '../types/notifyType';
import { formatDateToString, parseStringToDate } from './date';

type DBEvent = {
    id: number;
    title: string;
    content: string;
    date: string;
    notify_type: string;
    channel_id: string;
};

const castEventFromDBToFullEvent = (dbEvents: DBEvent): FullEvent => {
    const parsedDate = parseStringToDate(dbEvents.date);
    const date = parsedDate.success ? parsedDate.date : new Date();
    const notifyType = dbEvents.notify_type == 'once' ? ('once' as NotifyType) : ('normal' as NotifyType);
    return {
        id: dbEvents.id,
        title: dbEvents.title,
        content: dbEvents.content,
        date: date,
        notify_type: notifyType,
        channel_id: dbEvents.channel_id,
    };
};

export class dbUtil {
    db: DrizzleD1Database;
    constructor(db: D1Database) {
        this.db = drizzle(db);
    }
    async createEvent(
        event: Event,
        channelId: string,
        mentionUsers: string[] = [],
        mentionRoles: string[] = [],
        notifyType: NotifyType = 'normal' as NotifyType,
    ) {
        const result = await this.db
            .insert(events)
            .values({
                title: event.title,
                content: event.content,
                date: formatDateToString(event.date),
                notify_type: notifyType,
                channel_id: channelId,
            })
            .run();
        if (result.success && typeof result.results[0] !== null) {
            const insertedEvent = result.results[0] as Record<keyof DBEvent, unknown>;
            if (typeof insertedEvent.id === 'number') {
                for (const mentionUser of mentionUsers) {
                    await this.db.insert(mention_users).values({ event_id: insertedEvent.id, user_id: mentionUser }).run();
                }
                for (const mentionRole of mentionRoles) {
                    await this.db.insert(mention_roles).values({ event_id: insertedEvent.id, role_id: mentionRole }).run();
                }
            }
        }
    }
    async createRole(id: string, name: string) {
        return this.db.insert(roles).values({ id: id, name: name }).run();
    }
    async createUser(id: string, name: string) {
        return this.db.insert(users).values({ id: id, name: name }).run();
    }
    async readEvents() {
        return (await this.db.select().from(events).all()).map((event) => castEventFromDBToFullEvent(event));
    }
    async deleteEvent(id: number) {
        const deletedEvent = (await this.db.delete(events).where(eq(events.id, id)).returning())[0];
        return deletedEvent;
    }
    async checkUserExists(id: string) {
        return (await this.db.select().from(users).where(eq(users.id, id)).all()).length > 0;
    }
    async checkRoleExists(id: string) {
        return (await this.db.select().from(roles).where(eq(roles.id, id)).all()).length > 0;
    }
    async checkEventExists(id: number) {
        return (await this.db.select().from(events).where(eq(events.id, id)).all()).length > 0;
    }
    async checkEventExistsByTitle(title: string) {
        return (await this.db.select().from(events).where(eq(events.title, title)).all()).length > 0;
    }
}
