import { Context } from 'hono';
import { Button, ButtonStyleTypes, MessageComponentTypes, verifyKey } from 'discord-interactions';
import { APIGuildMember, APIInteraction, APIInteractionResponse, InteractionResponseType, Routes } from 'discord-api-types/v10';
import { REST, makeURLSearchParams } from '@discordjs/rest';

import { Role } from '../types/role';
import { User } from '../types/user';
import { Channel } from '../types/channel';

const BITFIELD_EPHEMERAL = 1 << 6; // EPHEMERAL (see: https://discord.com/developers/docs/resources/channel#message-object-message-flags)

type AuthenticateRequestResult =
    | {
          isSuccess: false;
          response: Response;
      }
    | {
          isSuccess: true;
          interaction: APIInteraction;
      };

export function getApplicationId(token: string) {
    const [base64Id] = token.split('.');
    return atob(base64Id);
}

export const authenticateRequest = async (c: Context): Promise<AuthenticateRequestResult> => {
    const signature = c.req.header('x-signature-ed25519');
    const timestamp = c.req.header('x-signature-timestamp');
    const body = await c.req.text();
    const isValidRequest = signature && timestamp && verifyKey(body, signature, timestamp, c.env.DISCORD_PUBLIC_KEY);
    if (!isValidRequest) {
        return {
            isSuccess: false,
            response: c.text('Bad request signature.', 401),
        };
    }
    const interaction: APIInteraction = JSON.parse(body);
    if (!interaction) {
        return {
            isSuccess: false,
            response: c.text('Bad request signature.', 401),
        };
    }
    return {
        isSuccess: true,
        interaction: interaction,
    };
};

export const buildNormalInteractionResponse = (c: Context, content: string) => {
    return c.json<APIInteractionResponse>({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: content,
            flags: BITFIELD_EPHEMERAL,
        },
    });
};

function buildDeleteButton(custom_id: string): Button {
    return {
        type: MessageComponentTypes.BUTTON,
        style: ButtonStyleTypes.DANGER,
        label: '削除する',
        custom_id: custom_id,
        emoji: {
            name: '🗑',
        },
    } as Button;
}

export class RESTAPIWrapper {
    private rest: REST = new REST({ version: '10' });
    constructor(discordBotToken: string) {
        this.rest.setToken(discordBotToken);
    }
    async getGuildMembers(guildId: string): Promise<User[]> {
        const apiResponse = (await this.rest.get(Routes.guildMembers(guildId), {
            query: makeURLSearchParams({ limit: 1000 }),
        })) as APIGuildMember[];
        const ret: User[] = [];
        for (const member of apiResponse) {
            if (member.user) {
                ret.push({
                    id: member.user.id,
                    name: member.user.username,
                });
            }
        }
        return ret;
    }
    async getGuildRoles(guildId: string): Promise<Role[]> {
        return (await this.rest.get(Routes.guildRoles(guildId))) as Role[];
    }
    async getGuildChannels(guildId: string): Promise<Channel[]> {
        return (await this.rest.get(Routes.guildChannels(guildId))) as Channel[];
    }
    async postMessageWithDeleteButton(channelId: string, content: string, custom_id: string) {
        await this.rest.post(Routes.channelMessages(channelId), {
            body: {
                content: content,
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [buildDeleteButton(custom_id)],
                    },
                ],
            },
        });
    }
}
