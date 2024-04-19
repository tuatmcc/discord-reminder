import { Context } from 'hono';
import { verifyKey } from 'discord-interactions';
import { APIInteraction, APIInteractionResponse, InteractionResponseType } from 'discord-api-types/v10';

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
