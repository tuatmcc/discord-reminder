import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { events, users, roles, channels, mention_roles, mention_users } from './schema';
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

// https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

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
        let id = 0;
        while (true) {
            id = getRandomInt(1, 1000000);
            if (!(await this.checkEventExists(id))) break;
        }
        const result = await this.db
            .insert(events)
            .values({
                id: id,
                title: event.title,
                content: event.content,
                date: formatDateToString(event.date),
                notify_type: notifyType,
                channel_id: channelId,
            })
            .run();
        if (result.success) {
            for (const mentionUser of mentionUsers) {
                await this.db.insert(mention_users).values({ event_id: id, user_id: mentionUser }).run();
            }
            for (const mentionRole of mentionRoles) {
                await this.db.insert(mention_roles).values({ event_id: id, role_id: mentionRole }).run();
            }
        }
    }
    async createRole(id: string, name: string) {
        return this.db.insert(roles).values({ id: id, name: name }).run();
    }
    async createUser(id: string, name: string) {
        return this.db.insert(users).values({ id: id, name: name }).run();
    }
    async createChannel(id: string, name: string) {
        return this.db.insert(channels).values({ id: id, name: name }).run();
    }
    async readEvents() {
        return (await this.db.select().from(events).all()).map((event) => castEventFromDBToFullEvent(event));
    }
    async deleteEvent(id: number) {
        await this.db.delete(mention_users).where(eq(mention_users.event_id, id)).run();
        await this.db.delete(mention_roles).where(eq(mention_roles.event_id, id)).run();
        const deletedEvent = (await this.db.delete(events).where(eq(events.id, id)).returning())[0];
        return deletedEvent;
    }
    async checkUserExists(id: string) {
        return (await this.db.select().from(users).where(eq(users.id, id)).all()).length > 0;
    }
    async checkRoleExists(id: string) {
        return (await this.db.select().from(roles).where(eq(roles.id, id)).all()).length > 0;
    }
    async checkChannelExists(id: string) {
        return (await this.db.select().from(channels).where(eq(channels.id, id)).all()).length > 0;
    }
    async checkEventExists(id: number) {
        return (await this.db.select().from(events).where(eq(events.id, id)).all()).length > 0;
    }
    async checkEventExistsByTitle(title: string) {
        return (await this.db.select().from(events).where(eq(events.title, title)).all()).length > 0;
    }
}
