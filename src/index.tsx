import { Hono } from 'hono';
import { jsx } from 'hono/jsx';
import {
    APIInteractionResponse,
    ApplicationCommandType,
    InteractionResponseType,
    InteractionType,
    APIApplicationCommandInteractionDataStringOption,
    Routes,
    APIApplicationCommandInteractionDataMentionableOption,
} from 'discord-api-types/v10';
import { Button, ButtonStyleTypes, MessageComponentTypes } from 'discord-interactions';
import { Bindings } from './bindings';
import { EVENTS_COMMAND, ADD_COMMAND } from './commands';
import { differenceInMinutes, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { dbUtil } from './lib/db';
import { parseStringToDate, formatDateToString } from './lib/date';
import { buildContestEventMessage, buildDisplayEventsMessage } from './lib/message';
import { authenticateRequest, buildNormalInteractionResponse } from './lib/discord';
import { REST, makeURLSearchParams } from '@discordjs/rest';
import { Reminder, ReminderAdmin } from './components';
import { getFutureContests } from './lib/crawler';
import { basicAuth } from 'hono/basic-auth';
import { marked } from 'marked';
import { Event } from './types/event';

// 何分前に通知するか
const ALART_TIMINGS = new Set([5, 10, 15, 30, 60]);
const DISCORD_API_VERSION = '10';

const app = new Hono<{ Bindings: Bindings }>();

app.all('/auth/*', async (c, next) => {
    const auth = basicAuth({
        username: c.env.BASIC_AUTH_USERNAME,
        password: c.env.BASIC_AUTH_PASSWORD,
    });
    return auth(c, next);
});

app.get('/', async (c) => {
    const db = new dbUtil(c.env.DB);
    const events = await db.readEvents();
    for (const event of events) {
        event.title = await marked(event.title);
        event.content = await marked(event.content);
    }
    return c.html(<Reminder events={events} />);
});

app.get('/update', async (c) => {
    const db = new dbUtil(c.env.DB);
    await updateUserTable(c.env);
    await updateRoleTable(c.env);
    return c.redirect('/');
});

app.get('/auth', async (c) => {
    const db = new dbUtil(c.env.DB);
    const events = await db.readEvents();
    for (const event of events) {
        event.title = await marked(event.title);
        event.content = await marked(event.content);
    }
    return c.html(<ReminderAdmin events={events} />);
});

app.post('/auth/add_event', async (c) => {
    const db = new dbUtil(c.env.DB);
    const body = await c.req.parseBody();
    const { title, content, time, date } = body;
    if (typeof title === 'string' && typeof content === 'string' && typeof time === 'string' && typeof date === 'string') {
        const dateString = date + ' ' + time;
        const parsedResult = parseStringToDate(dateString);
        if (parsedResult.success) {
            await db.createEvent(
                {
                    title: title,
                    content: content,
                    date: parsedResult.date,
                } as Event,
                c.env.DISCORD_BOT_CHANNEL_ID,
            );
        }
    }
    return c.redirect('/auth');
});

app.post('/auth/delete_event', async (c) => {
    const db = new dbUtil(c.env.DB);
    const id = (await c.req.parseBody())['id'];
    if (typeof id === 'string' && (await db.checkEventExists(parseInt(id)))) await db.deleteEvent(parseInt(id));
    return c.redirect('/auth');
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
            case 'delete':
                const id = parseInt(interaction.data.custom_id.substring(7));
                const db = new dbUtil(c.env.DB);
                if (!(await db.checkEventExists(id))) {
                    return buildNormalInteractionResponse(c, 'Event not found');
                }
                const deletedEvent = await db.deleteEvent(id);
                return buildNormalInteractionResponse(c, `イベントが削除されました: ${deletedEvent.title}, ${deletedEvent.date}`);
            default:
                return buildNormalInteractionResponse(c, 'Invalid interaction');
        }
    }

    if (interaction.type == InteractionType.ApplicationCommand && interaction.data.type === ApplicationCommandType.ChatInput) {
        switch (interaction.data.name) {
            case EVENTS_COMMAND.name:
                const events = await new dbUtil(c.env.DB).readEvents();
                return buildNormalInteractionResponse(c, buildDisplayEventsMessage(events));

            case ADD_COMMAND.name:
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
                let content = '';
                const users = [],
                    roles = [];
                const db = new dbUtil(c.env.DB);
                for (const option of interaction.data.options) {
                    if (option.name === 'content') {
                        content = (option as APIApplicationCommandInteractionDataStringOption).value;
                    }
                    if (option.type === 3) continue;
                    const mentionId = (option as APIApplicationCommandInteractionDataMentionableOption).value;
                    if (await db.checkUserExists(mentionId)) {
                        users.push(mentionId);
                    } else {
                        roles.push(mentionId);
                    }
                }
                await new dbUtil(c.env.DB).createEvent(
                    {
                        title: title,
                        content: content,
                        date: parsedDateResult.date,
                    } as Event,
                    c.env.DISCORD_BOT_CHANNEL_ID,
                    users,
                    roles,
                    'normal',
                );
                return buildNormalInteractionResponse(c, 'イベントが追加されました');

            default:
                return buildNormalInteractionResponse(c, 'Invalid command');
        }
    }
});

// 定期実行する処理
// https://zenn.dev/toraco/articles/55f359cbf94862

const notifyNearEvents = async (env: Bindings) => {
    const db = new dbUtil(env.DB);
    const events = await db.readEvents();
    const rest = new REST({ version: DISCORD_API_VERSION }).setToken(env.DISCORD_BOT_TOKEN);
    for (const event of events) {
        const untilEventMinutes = differenceInMinutes(event.date, toZonedTime(new Date(), 'Asia/Tokyo'));
        if (ALART_TIMINGS.has(untilEventMinutes + 1)) {
            const button = {
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.DANGER,
                label: '削除する',
                custom_id: `delete-${event.id}`,
                emoji: {
                    name: '🗑',
                },
            } as Button;
            await rest.post(Routes.channelMessages(env.DISCORD_BOT_CHANNEL_ID), {
                body: {
                    content: `${event.title} まであと ${untilEventMinutes + 1} 分です`,
                    components: [
                        {
                            type: 1,
                            components: [button],
                        },
                    ],
                },
            });
        }
    }
};

const updateUserTable = async (env: Bindings) => {
    const rest = new REST({ version: DISCORD_API_VERSION }).setToken(env.DISCORD_BOT_TOKEN);
    const guildUsers = (await rest.get(Routes.guildMembers(env.DISCORD_BOT_GUILD_ID), { query: makeURLSearchParams({ limit: 1000 }) })) as {
        user: { id: string; global_name: string };
    }[];
    const db = new dbUtil(env.DB);
    for (const user of guildUsers) {
        if (!(await db.checkUserExists(user.user.id))) {
            await db.createUser(user.user.id, user.user.global_name);
        }
    }
};

const updateRoleTable = async (env: Bindings) => {
    const rest = new REST({ version: DISCORD_API_VERSION }).setToken(env.DISCORD_BOT_TOKEN);
    const guildRoles = (await rest.get(Routes.guildRoles(env.DISCORD_BOT_GUILD_ID))) as { id: string; name: string }[];
    const db = new dbUtil(env.DB);
    for (const role of guildRoles) {
        if (!(await db.checkRoleExists(role.id))) {
            await db.createRole(role.id, role.name);
        }
    }
};

const addFutureContests = async (env: Bindings) => {
    const db = new dbUtil(env.DB);
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
                [],
                'once',
            );
        }
    }
};

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
