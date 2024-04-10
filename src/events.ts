import { Context } from "hono";

export const createEventsResponseMessage = async (c : Context) => {
    const sql = `select * from events`;
    let results: any = (await c.env.DB.prepare(sql).all()).results;
    let message = '';
    for (const event of results) {
        message += `${event.date}: ${event.name}\n`;
    }
    return message;
};