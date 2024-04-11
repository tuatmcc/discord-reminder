import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { events } from "./schema";

export type Event = {
    name: string,
    date: string
}

export class dbUtil{
    db: DrizzleD1Database;
    constructor(db: D1Database){
        this.db = drizzle(db);
    }
    async createEvent(event: Event){
        return this.db.insert(events).values(event).run();
    }
    async readEvents(){
        return this.db.select().from(events).all();
    }
};