import { Hono } from 'hono';
import { jsx } from 'hono/jsx';
import {
    APIInteraction,
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
import { dbUtil } from './db';
import { checkValidStringAsDate } from './util';
import { buildDisplayEventsMessage } from './buildMessages';
import { authenticateRequest, buildNormalInteractionResponse } from './discord';
import { REST } from '@discordjs/rest';
import { Top } from './components';

// 何分前に通知するか
const ALART_TIMINGS = new Set([5, 10, 15, 30, 60]);
const DISCORD_API_VERSION = '10';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
    const db = new dbUtil(c.env.DB);
    const events = await db.readEvents();
    return c.html(<Top events={events} />);
});

app.post('/add_event', async (c) => {
    const db = new dbUtil(c.env.DB);
    const body = await c.req.parseBody();
    const name = body['name'];
    const time = body['time'];
    const date = body['date'];
    if (typeof name === 'string' && typeof time === 'string' && typeof date === 'string') {
        const dateString = date + 'T' + time;
        if (checkValidStringAsDate(dateString)) {
            await db.createEvent(name, dateString);
        }
    }
    return c.redirect('/');
});

app.post('/delete_event', async (c) => {
    const db = new dbUtil(c.env.DB);
    const id = (await c.req.parseBody())['id'];
    if (typeof id === 'string' && (await db.checkEventExists(parseInt(id)))) await db.deleteEvent(parseInt(id));
    return c.redirect('/');
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
                let date = (interaction.data.options[1] as APIApplicationCommandInteractionDataStringOption).value;
                console.log(interaction.data.options.length);
                if (interaction.data.options.length === 3) {
                    // メンション先の指定がある場合、対象がユーザーかロールかを判定する
                    const mention = interaction.data.options[2] as APIApplicationCommandInteractionDataMentionableOption;
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
                if (!checkValidStringAsDate(date)) {
                    return buildNormalInteractionResponse(c, 'Invalid date format');
                }
                await new dbUtil(c.env.DB).createEvent(name, date);
                return buildNormalInteractionResponse(c, 'イベントが追加されました');

            default:
                return buildNormalInteractionResponse(c, 'Invalid command');
        }
    }
});

// 定期実行する処理
// https://zenn.dev/toraco/articles/55f359cbf94862

const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (event, env, ctx) => {
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

export default {
    fetch: app.fetch,
    scheduled,
};
