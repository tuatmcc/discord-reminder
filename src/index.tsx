import { Hono } from 'hono';
import { jsx } from 'hono/jsx'; // eslint-disable-line @typescript-eslint/no-unused-vars
import {
    APIInteractionResponse,
    ApplicationCommandType,
    InteractionResponseType,
    InteractionType,
    APIApplicationCommandInteractionDataStringOption,
    APIApplicationCommandInteractionDataMentionableOption,
    ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { Bindings } from './bindings';
import { EVENTS_COMMAND, ADD_COMMAND } from './commands';
import { differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { DBWrapper } from './lib/db';
import { parseStringToDate } from './lib/date';
import { buildContestEventMessage, buildDisplayEventsMessageWithMentionables, buildMentionHeader } from './lib/message';
import { RESTAPIWrapper, authenticateRequest, buildNormalInteractionResponse } from './lib/discord';
import { Reminder, ReminderAdmin } from './components';
import { getFutureContests } from './lib/crawler';
import { basicAuth } from 'hono/basic-auth';
import { marked } from 'marked';
import { Event } from './types/event';

// 何分前に通知するか
const ALART_TIMINGS = new Set([5, 10, 15, 30, 60]);

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
            await db.createEvent(
                {
                    title: title,
                    content: '',
                    date: parsedResult.date,
                } as Event,
                c.env.DISCORD_BOT_CHANNEL_ID,
            );
        }
    }
    return c.redirect('/admin');
});

admin.post('/delete', async (c) => {
    const db = new DBWrapper(c.env.DB);
    const id = (await c.req.parseBody())['id'];
    if (typeof id === 'string' && (await db.checkEventExists(parseInt(id)))) await db.deleteEvent(parseInt(id));
    return c.redirect('/admin');
});

admin.get('/update', async (c) => {
    await Promise.all([updateUserTable(c.env), updateRoleTable(c.env), updateChannelTable(c.env)]);
    return c.redirect('/admin');
});

admin.get('/update/contests', async (c) => {
    await addFutureContests(c.env);
    return c.redirect('/admin');
});

const app = new Hono<{ Bindings: Bindings }>();
app.route('/admin', admin);

app.get('/', async (c) => {
    const db = new DBWrapper(c.env.DB);
    const events = await db.readEvents();
    for (const event of events) {
        event.title = await marked(event.title);
        event.content = await marked(event.content);
    }
    return c.html(<Reminder events={events} />);
});

app.post('/', async (c) => {
    const authResult = await authenticateRequest(c);
    if (!authResult.isSuccess) {
        return authResult.response;
    }

    const interaction = authResult.interaction;
    if (interaction.type === InteractionType.Ping) {
        return c.json<APIInteractionResponse>({
            type: InteractionResponseType.Pong,
        });
    }

    if (interaction.type === InteractionType.MessageComponent) {
        // button が押されたときの処理
        switch (interaction.data.custom_id.substring(0, 6)) {
            case 'delete': {
                const id = parseInt(interaction.data.custom_id.substring(7));
                const db = new DBWrapper(c.env.DB);
                if (!(await db.checkEventExists(id))) {
                    return buildNormalInteractionResponse(c, 'Event not found');
                }
                const deletedEvent = await db.deleteEvent(id);
                return buildNormalInteractionResponse(c, `イベントが削除されました: ${deletedEvent.title}, ${deletedEvent.date}`);
            }
            default:
                return buildNormalInteractionResponse(c, 'Invalid interaction');
        }
    }

    if (interaction.type == InteractionType.ApplicationCommand && interaction.data.type === ApplicationCommandType.ChatInput) {
        const db = new DBWrapper(c.env.DB);
        switch (interaction.data.name) {
            case EVENTS_COMMAND.name: {
                const [events, mention_roles, mention_users] = await Promise.all([
                    db.readEvents(),
                    db.readMentionRoles(),
                    db.readMentionUsers(),
                ]);
                return buildNormalInteractionResponse(c, buildDisplayEventsMessageWithMentionables(events, mention_users, mention_roles));
            }
            case ADD_COMMAND.name: {
                if (interaction.data.options === undefined) {
                    return buildNormalInteractionResponse(c, 'Invalid command');
                }
                const title = (interaction.data.options[0] as APIApplicationCommandInteractionDataStringOption).value;
                const date = (interaction.data.options[1] as APIApplicationCommandInteractionDataStringOption).value;
                const time = (interaction.data.options[2] as APIApplicationCommandInteractionDataStringOption).value;
                const parsedDateResult = parseStringToDate(date + ' ' + time);
                if (!parsedDateResult.success) {
                    return buildNormalInteractionResponse(c, 'Invalid date format');
                }
                let content = '',
                    notifyType = 'normal';
                const users = [],
                    roles = [];
                const [dbUsers, dbRoles] = await Promise.all([db.readUsers(), db.readRoles()]);
                for (const option of interaction.data.options) {
                    if (option.name === 'content') {
                        content = (option as APIApplicationCommandInteractionDataStringOption).value;
                    }
                    if (option.name === 'notifytype') {
                        notifyType = (option as APIApplicationCommandInteractionDataStringOption).value;
                    }
                    if (option.type === ApplicationCommandOptionType.String) continue;
                    const mentionId = (option as APIApplicationCommandInteractionDataMentionableOption).value;
                    if (dbUsers.find((user) => user.id === mentionId)) {
                        users.push(mentionId);
                    } else if (dbRoles.find((role) => role.id === mentionId)) {
                        roles.push(mentionId);
                    }
                }
                if (notifyType !== 'once' && notifyType !== 'normal') {
                    return buildNormalInteractionResponse(c, 'Invalid notifyType');
                }
                await new DBWrapper(c.env.DB).createEvent(
                    {
                        title: title,
                        content: content,
                        date: parsedDateResult.date,
                    } as Event,
                    c.env.DISCORD_BOT_CHANNEL_ID,
                    users,
                    roles,
                    notifyType,
                );
                return buildNormalInteractionResponse(c, 'イベントが追加されました');
            }
            default:
                return buildNormalInteractionResponse(c, 'Invalid command');
        }
    }
});


// 定期実行する処理
// https://zenn.dev/toraco/articles/55f359cbf94862

const notifyNearEvents = async (env: Bindings) => {
    const db = new DBWrapper(env.DB);
    const rest = new RESTAPIWrapper(env.DISCORD_BOT_TOKEN);
    const events = await db.readEvents();
    for (const event of events) {
        const untilEventMinutes = differenceInMinutes(event.date, toZonedTime(new Date(), 'Asia/Tokyo'));
        if (untilEventMinutes <= 0) {
            await db.deleteEvent(event.id);
            continue;
        }
        switch (event.notify_type) {
            case 'once':
                if (untilEventMinutes + 1 <= 60) {
                    const [roles, users] = await Promise.all([
                        db.readRolesMentionedInEvent(event.id),
                        db.readUsersMentionedInEvent(event.id),
                    ]);
                    await rest.postMessageWithDeleteButton(
                        env.DISCORD_BOT_CHANNEL_ID,
                        buildMentionHeader(roles, users) + `${event.title} まであと ${untilEventMinutes + 1} 分です`,
                        `delete-${event.id}`,
                    );
                    await db.deleteEvent(event.id);
                }
                break;
            case 'normal':
                if (ALART_TIMINGS.has(untilEventMinutes + 1)) {
                    const [roles, users] = await Promise.all([
                        db.readRolesMentionedInEvent(event.id),
                        db.readUsersMentionedInEvent(event.id),
                    ]);
                    await rest.postMessageWithDeleteButton(
                        env.DISCORD_BOT_CHANNEL_ID,
                        buildMentionHeader(roles, users) + `${event.title} まであと ${untilEventMinutes + 1} 分です`,
                        `delete-${event.id}`,
                    );
                }
                break;
        }
    }
};

const updateUserTable = async (env: Bindings) => {
    const guildUsers = await new RESTAPIWrapper(env.DISCORD_BOT_TOKEN).getGuildMembers(env.DISCORD_BOT_GUILD_ID);
    await new DBWrapper(env.DB).createUsers(guildUsers);
};

const updateRoleTable = async (env: Bindings) => {
    const guildRoles = await new RESTAPIWrapper(env.DISCORD_BOT_TOKEN).getGuildRoles(env.DISCORD_BOT_GUILD_ID);
    await new DBWrapper(env.DB).createRoles(guildRoles);
};

const updateChannelTable = async (env: Bindings) => {
    const guildChannels = await new RESTAPIWrapper(env.DISCORD_BOT_TOKEN).getGuildChannels(env.DISCORD_BOT_GUILD_ID);
    await new DBWrapper(env.DB).createChannels(guildChannels);
};

const addFutureContests = async (env: Bindings) => {
    const db = new DBWrapper(env.DB);
    const contests = await getFutureContests();
    for (const contest of contests) {
        const message = buildContestEventMessage(contest);
        if (!(await db.checkEventExistsByTitle(message))) {
            await db.createEvent(
                {
                    title: message,
                    content: '',
                    date: contest.time,
                } as Event,
                env.DISCORD_BOT_CHANNEL_ID,
                [],
                [env.DISCORD_KYOPRO_ROLE_ID],
                'once',
            );
        }
    }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (event, env, ctx) => {
    switch (event.cron) {
        case '* * * * *':
            await notifyNearEvents(env);
            break;
        case '0 * * * *':
            await addFutureContests(env);
            break;
    }
};

export default {
    fetch: app.fetch,
    scheduled,
};
