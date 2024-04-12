import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { events } from "./schema";
import { eq } from "drizzle-orm";

export type Event = {
    name: string,
    date: string,
    id: number
}

export class dbUtil{
    db: DrizzleD1Database;
    constructor(db: D1Database){
        this.db = drizzle(db);
    }
    async createEvent(name: string, date: string){
        return this.db.insert(events).values({name: name, date: date}).run();
    }
    async readEvents(){
        return this.db.select().from(events).all();
    }
    async deleteEvent(id: number){
        const deletedEvent = (await this.db.delete(events).where(eq(events.id, id)).returning())[0];
        return deletedEvent;
    }
    async checkEventExists(id: number){
        return (await this.db.select().from(events).where(eq(events.id, id)).all()).length > 0;
    }
};