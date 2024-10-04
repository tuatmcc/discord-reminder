import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { jsx } from 'hono/jsx'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { DBWrapper } from './lib/db';
import { parseStringToDate } from './lib/date';

import { Bindings } from './bindings';
import { marked } from 'marked';
import { ReminderAdmin } from './components';
import { v4 as uuid } from 'uuid';

import { RESTAPIWrapper } from './lib/discord';
import { buildContestEventMessage } from './lib/message';
import { getFutureContests } from './lib/crawler';

const admin = new Hono<{ Bindings: Bindings }>();

admin.use('/*', async (c, next) => {
    return basicAuth({
        username: c.env.BASIC_AUTH_USERNAME,
        password: c.env.BASIC_AUTH_PASSWORD,
    })(c, next);
});

admin.get('/', async (c) => {
    const db = new DBWrapper(c.env.DB);
    const events = await db.readEvents();
    for (const event of events) {
        event.title = await marked(event.title);
        event.content = await marked(event.content);
    }
    return c.html(<ReminderAdmin events={events} />);
});

admin.post('/', async (c) => {
    const db = new DBWrapper(c.env.DB);
    const body = await c.req.parseBody();
    const { title, time, date } = body;
    console.log(body);
    if (typeof title === 'string' && typeof time === 'string' && typeof date === 'string') {
        const dateString = date + ' ' + time;
        const parsedResult = parseStringToDate(dateString);
        if (parsedResult.success) {
            await db.createEvent({
                id: uuid(),
                title: title,
                content: '',
                date: parsedResult.date,
                notifyFrequency: 'normal',
                channelId: c.env.DISCORD_BOT_CHANNEL_ID,
            });
        }
    }
    return c.redirect('/admin');
});

admin.post('/delete', async (c) => {
    const db = new DBWrapper(c.env.DB);
    const id = (await c.req.parseBody())['id'];
    if (typeof id === 'string' && (await db.checkEventExists(id))) await db.deleteEvent(id);
    return c.redirect('/admin');
});

admin.get('/update', async (c) => {
    const client = new RESTAPIWrapper(c.env.DISCORD_BOT_TOKEN);
    const db = new DBWrapper(c.env.DB);
    Promise.all([
        db.createUsers(await client.getGuildMembers(c.env.DISCORD_BOT_GUILD_ID)),
        db.createChannels(await client.getGuildChannels(c.env.DISCORD_BOT_GUILD_ID)),
        db.createRoles(await client.getGuildRoles(c.env.DISCORD_BOT_GUILD_ID)),
    ]);
    return c.redirect('/admin');
});

admin.get('/update/contests', async (c) => {
    await addFutureContests(c.env);
    return c.redirect('/admin');
});

const addFutureContests = async (env: Bindings) => {
    const db = new DBWrapper(env.DB);
    const contests = await getFutureContests();
    for (const contest of contests) {
        const message = buildContestEventMessage(contest);
        if (!(await db.checkEventExistsByTitle(message))) {
            await db.createEvent(
                {
                    id: uuid(),
                    title: message,
                    content: '',
                    date: contest.time,
                    channelId: env.DISCORD_BOT_CHANNEL_ID,
                    notifyFrequency: 'once',
                },
                [],
                [env.DISCORD_KYOPRO_ROLE_ID],
            );
        }
    }
};

export default admin;
