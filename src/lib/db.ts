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
    async createEvent(event: Event, channelId: string, notifyType: NotifyType = 'normal' as NotifyType) {
        return this.db
            .insert(events)
            .values({
                title: event.title,
                content: event.content,
                date: formatDateToString(event.date),
                notify_type: notifyType,
                channel_id: channelId,
            })
            .run();
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
    async checkEventExistsByTitle(name: string) {
        return (await this.db.select().from(events).where(eq(events.title, name)).all()).length > 0;
    }
}
