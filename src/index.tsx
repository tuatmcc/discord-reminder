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
import { parseStringToDate, formatDateToString } from './lib/util';
import { buildContestEventMessage, buildDisplayEventsMessage } from './lib/date';
import { authenticateRequest, buildNormalInteractionResponse } from './lib/discord';
import { REST } from '@discordjs/rest';
import { Reminder, ReminderAdmin } from './components';
import { getFutureContests } from './lib/crawler';
import { basicAuth } from 'hono/basic-auth';

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
    return c.html(<Reminder events={events} />);
});

app.get('/auth', async (c) => {
    const db = new dbUtil(c.env.DB);
    const events = await db.readEvents();
    return c.html(<ReminderAdmin events={events} />);
});

app.post('/auth/add_event', async (c) => {
    const db = new dbUtil(c.env.DB);
    const body = await c.req.parseBody();
    const { name, time, date } = body;
    if (typeof name === 'string' && typeof time === 'string' && typeof date === 'string') {
        const dateString = date + 'T' + time;
        const parsedResult = parseStringToDate(dateString);
        if (parsedResult.success) {
            await db.createEvent(name, formatDateToString(parsedResult.date));
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
                return buildNormalInteractionResponse(c, `イベントが削除されました: ${deletedEvent.name}, ${deletedEvent.date}`);
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
                let name = (interaction.data.options[0] as APIApplicationCommandInteractionDataStringOption).value;
                const date = (interaction.data.options[1] as APIApplicationCommandInteractionDataStringOption).value;
                const time = (interaction.data.options[2] as APIApplicationCommandInteractionDataStringOption).value;
                for (let i = interaction.data.options.length - 1; i >= 3; i--) {
                    const mention = interaction.data.options[i] as APIApplicationCommandInteractionDataMentionableOption;
                    const rest = new REST({ version: DISCORD_API_VERSION }).setToken(c.env.DISCORD_BOT_TOKEN);
                    try {
                        const response = await rest.get(Routes.user(mention.value));
                        if (typeof response === 'object' && response !== null && 'id' in response) {
                            name = `<@${response.id}> ` + name;
                        }
                    } catch (e) {
                        name = `<@&${mention.value}> ` + name;
                    }
                }
                const parsedResult = parseStringToDate(date + 'T' + time);
                if (!parsedResult.success) {
                    return buildNormalInteractionResponse(c, 'Invalid date format');
                }
                await new dbUtil(c.env.DB).createEvent(name, formatDateToString(parsedResult.date));
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
        const untilEventMinutes = differenceInMinutes(parseISO(event.date), toZonedTime(new Date(), 'Asia/Tokyo'));
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
                    content: `${event.name} まであと ${untilEventMinutes + 1} 分です`,
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

const addFutureContests = async (env: Bindings) => {
    const db = new dbUtil(env.DB);
    const contests = await getFutureContests();
    for (const contest of contests) {
        const message = buildContestEventMessage(contest);
        if (!(await db.checkEventExistsByName(message))) {
            await db.createEvent(message, formatDateToString(contest.time));
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
