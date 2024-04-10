import { Hono } from 'hono';
import { APIInteraction, APIInteractionResponse, InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import { verifyKey } from 'discord-interactions';
import { Bindings } from './bindings';
import { TEST_COMMAND, EVENTS_COMMAND } from './commands';
import { createEventsResponseMessage } from './events';

const BITFIELD_EPHEMERAL = 1 << 6; // EPHEMERAL (see: https://discord.com/developers/docs/resources/channel#message-object-message-flags)

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

    if (interaction.type == InteractionType.ApplicationCommand) {
        switch (interaction.data.name) {
            case TEST_COMMAND.name:
                return c.json<APIInteractionResponse>({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        content: 'test',
                        flags: BITFIELD_EPHEMERAL,
                    },
                });
            case EVENTS_COMMAND.name:
                return c.json<APIInteractionResponse>({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        content: await createEventsResponseMessage(c),
                        flags: BITFIELD_EPHEMERAL,
                    },
                });
        }
    }
});

export default app;
