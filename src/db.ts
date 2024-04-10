import { Context } from 'hono';
import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { events } from "./schema";

export type Event = {
    name: string,
    date: string
}

export class dbUtil{
    c: Context;
    db: DrizzleD1Database;
    constructor(c: Context){
        this.c = c;
        this.db = drizzle(c.env.DB);
    }
    async createEvent(event: Event){
        return this.db.insert(events).values(event).run();
    }
    async readEvents(){
        return this.db.select().from(events).all();
    }
};