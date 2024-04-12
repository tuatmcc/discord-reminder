import { Hono } from 'hono';
import { APIInteraction, APIInteractionResponse, ApplicationCommandType, InteractionResponseType, InteractionType, APIApplicationCommandInteractionDataStringOption, Routes } from 'discord-api-types/v10';
import { verifyKey, Button } from 'discord-interactions';
import { Bindings } from './bindings';
import { EVENTS_COMMAND, ADD_COMMAND } from './commands';
import { differenceInMinutes, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz'

import { dbUtil } from './db';
import { checkValidStringAsDate} from './util';
import { buildDisplayEventsMessage } from './buildMessages';

import { REST } from '@discordjs/rest';

const BITFIELD_EPHEMERAL = 1 << 6; // EPHEMERAL (see: https://discord.com/developers/docs/resources/channel#message-object-message-flags)
const ALART_TIMINGS = new Set([5, 10, 15, 30, 60]);

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
    return c.text('Hello, world!');
});

app.post('/', async (c) => {
    // verify
    const signature = c.req.header('x-signature-ed25519');
    const timestamp = c.req.header('x-signature-timestamp');
    const body = await c.req.text();
    const isValidRequest = signature && timestamp && verifyKey(body, signature, timestamp, c.env.DISCORD_PUBLIC_KEY);
    if (!isValidRequest) {
        return c.text('Bad request signature.', 401);
    }

    const interaction: APIInteraction = JSON.parse(body);
    if (!interaction) {
        return c.text('Bad request signature.', 401);
    }

    // interact
    if (interaction.type === InteractionType.Ping) {
        return c.json<APIInteractionResponse>({
            type: InteractionResponseType.Pong,
        });
    }

    if (interaction.type == InteractionType.ApplicationCommand && interaction.data.type === ApplicationCommandType.ChatInput) {
        switch (interaction.data.name) {
            case EVENTS_COMMAND.name:
                const events = await new dbUtil(c.env.DB).readEvents();
                return c.json<APIInteractionResponse>({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        content: buildDisplayEventsMessage(events),
                        flags: BITFIELD_EPHEMERAL,
                    },
                });
            case ADD_COMMAND.name:
                if(interaction.data.options === undefined){
                    return c.json<APIInteractionResponse>({
                        type: InteractionResponseType.ChannelMessageWithSource,
                        data: {
                            content: 'Invalid arguments',
                            flags: BITFIELD_EPHEMERAL,
                        },
                    });
                }
                let name = (interaction.data.options[0] as APIApplicationCommandInteractionDataStringOption).value;
                let date = (interaction.data.options[1] as APIApplicationCommandInteractionDataStringOption).value;
                if(!checkValidStringAsDate(date)){
                    return c.json<APIInteractionResponse>({
                        type: InteractionResponseType.ChannelMessageWithSource,
                        data: {
                            content: 'Invalid date format',
                            flags: BITFIELD_EPHEMERAL,
                        },
                    });
                }
                await new dbUtil(c.env.DB).createEvent({name: name, date: date});
                return c.json<APIInteractionResponse>({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        content: `Event added: ${name} on ${date}`,
                        flags: BITFIELD_EPHEMERAL,
                    },
                });
            default:
                return c.json<APIInteractionResponse>({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        content: 'Invalid command',
                        flags: BITFIELD_EPHEMERAL,
                    },
                });
        }
    }
});

// 定期実行する処理
// https://zenn.dev/toraco/articles/55f359cbf94862

const scheduled: ExportedHandlerScheduledHandler<Bindings> = async(event, env, ctx) => {
    const db = new dbUtil(env.DB);
    const events = await db.readEvents();
    const rest = new REST({version: '10'}).setToken(env.DISCORD_BOT_TOKEN);
    for(const event of events){
        const untilEventMinutes = differenceInMinutes(parseISO(event.date), toZonedTime(new Date(), 'Asia/Tokyo'));
        if(ALART_TIMINGS.has(untilEventMinutes + 1)){
            await rest.post(Routes.channelMessages(env.DISCORD_BOT_CHANNEL_ID), {
                body: {
                    content: `${event.name} まであと ${untilEventMinutes + 1} 分です`,
                }
            });
        }
    }
}

export default {
    fetch: app.fetch,
    scheduled
};
