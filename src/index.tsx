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
import { DBWrapper } from './lib/db';
import { parseStringToDate } from './lib/date';
import { buildDisplayEventsMessageWithMentionables } from './lib/message';
import { authenticateRequest, buildNormalInteractionResponse } from './lib/discord';
import { Reminder } from './components';
import { marked } from 'marked';
import { v4 as uuid } from 'uuid';

import { scheduledHandler } from './scheduledEvents';

import admin from './admin';

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
                const id = interaction.data.custom_id.substring(7);
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
                        id: uuid(),
                        title: title,
                        content: content,
                        date: parsedDateResult.date,
                        channelId: c.env.DISCORD_BOT_CHANNEL_ID,
                        notifyFrequency: notifyType,
                    },
                    users,
                    roles,
                );
                return buildNormalInteractionResponse(c, 'イベントが追加されました');
            }
            default:
                return buildNormalInteractionResponse(c, 'Invalid command');
        }
    }
});

export default {
    fetch: app.fetch,
    scheduledHandler,
};
