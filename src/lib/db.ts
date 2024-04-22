import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';

import { formatDateToString, parseStringToDate } from './date';
import { events, users, roles, channels, mention_roles, mention_users } from './schema';

import { Role } from '../types/role';
import { User } from '../types/user';
import { Channel } from '../types/channel';
import { Event } from '../types/event';
import { NotifyFrequency } from '../types/notifyFrequency';

export type DBEvent = {
    id: string;
    title: string;
    content: string;
    date: string;
    notify_type: string;
    channel_id: string;
};

const castDBEventToEvent = (dbEvents: DBEvent): Event => {
    const parsedDate = parseStringToDate(dbEvents.date);
    const date = parsedDate.success ? parsedDate.date : new Date();
    const notifyFrequency = dbEvents.notify_type == 'once' ? ('once' as NotifyFrequency) : ('normal' as NotifyFrequency);
    return {
        id: dbEvents.id,
        title: dbEvents.title,
        content: dbEvents.content,
        date: date,
        notifyFrequency: notifyFrequency,
        channelId: dbEvents.channel_id,
    };
};

const castEventtoDBEvent = (event: Event): DBEvent => {
    return {
        id: event.id,
        title: event.title,
        content: event.content,
        date: formatDateToString(event.date),
        notify_type: event.notifyFrequency as NotifyFrequency,
        channel_id: event.channelId,
    };
};

export class DBWrapper {
    private step = 20;
    db: DrizzleD1Database;
    constructor(db: D1Database) {
        this.db = drizzle(db);
    }
    async createEvent(event: Event, mentionUserIds: string[] = [], mentionRoleIds: string[] = []) {
        const result = await this.db.insert(events).values(castEventtoDBEvent(event)).run();
        if (result.success) {
            if (mentionUserIds.length > 0)
                await this.db
                    .insert(mention_users)
                    .values(mentionUserIds.map((userId) => ({ event_id: event.id, user_id: userId })))
                    .run();
            if (mentionRoleIds.length > 0)
                await this.db
                    .insert(mention_roles)
                    .values(mentionRoleIds.map((roleId) => ({ event_id: event.id, role_id: roleId })))
                    .run();
        }
    }
    async createRoles(newRoles: Role[]) {
        const promises: Promise<D1Result<unknown>>[] = [];
        for (let i = 0; i < newRoles.length; i += this.step) {
            promises.push(
                this.db
                    .insert(roles)
                    .values(newRoles.slice(i, i + this.step))
                    .onConflictDoNothing()
                    .run(),
            );
        }
        await Promise.all(promises);
    }
    async createUsers(newUsers: User[]) {
        const promises: Promise<D1Result<unknown>>[] = [];
        for (let i = 0; i < newUsers.length; i += this.step) {
            promises.push(
                this.db
                    .insert(users)
                    .values(newUsers.slice(i, i + this.step))
                    .onConflictDoNothing()
                    .run(),
            );
        }
        await Promise.all(promises);
    }
    async createChannels(newChannels: Channel[]) {
        const promises: Promise<D1Result<unknown>>[] = [];
        for (let i = 0; i < newChannels.length; i += this.step) {
            promises.push(
                this.db
                    .insert(channels)
                    .values(newChannels.slice(i, i + this.step))
                    .onConflictDoNothing()
                    .run(),
            );
        }
        await Promise.all(promises);
    }
    async readEvents() {
        const ret = (await this.db.select().from(events).all()).map((event) => castDBEventToEvent(event));
        ret.sort((a, b) => a.date.getTime() - b.date.getTime());
        return ret;
    }
    async readUsers(): Promise<User[]> {
        return await this.db.select().from(users).all();
    }
    async readRoles(): Promise<Role[]> {
        return await this.db.select().from(roles).all();
    }
    async readMentionUsers() {
        return await this.db.select().from(mention_users).all();
    }
    async readMentionRoles() {
        return await this.db.select().from(mention_roles).all();
    }
    async readUsersMentionedInEvent(eventId: string): Promise<string[]> {
        return (await this.db.select().from(mention_users).where(eq(mention_users.event_id, eventId)).all()).map(
            (mentionUser) => mentionUser.user_id,
        );
    }
    async readRolesMentionedInEvent(eventId: string): Promise<string[]> {
        return (await this.db.select().from(mention_roles).where(eq(mention_roles.event_id, eventId)).all()).map(
            (mentionUser) => mentionUser.role_id,
        );
    }
    async deleteEvent(id: string) {
        const [, , deletedEvent] = await Promise.all([
            this.db.delete(mention_users).where(eq(mention_users.event_id, id)).run(),
            this.db.delete(mention_roles).where(eq(mention_roles.event_id, id)).run(),
            this.db.delete(events).where(eq(events.id, id)).returning(),
        ]);
        return deletedEvent[0];
    }
    async checkUserExists(id: string): Promise<boolean> {
        return (await this.db.select().from(users).where(eq(users.id, id)).all()).length > 0;
    }
    async checkRoleExists(id: string): Promise<boolean> {
        return (await this.db.select().from(roles).where(eq(roles.id, id)).all()).length > 0;
    }
    async checkChannelExists(id: string): Promise<boolean> {
        return (await this.db.select().from(channels).where(eq(channels.id, id)).all()).length > 0;
    }
    async checkEventExists(id: string): Promise<boolean> {
        return (await this.db.select().from(events).where(eq(events.id, id)).all()).length > 0;
    }
    async checkEventExistsByTitle(title: string): Promise<boolean> {
        return (await this.db.select().from(events).where(eq(events.title, title)).all()).length > 0;
    }
}
