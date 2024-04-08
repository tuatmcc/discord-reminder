import { Hono } from 'hono'
import { APIInteraction, APIInteractionResponse, InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import { verifyKey } from 'discord-interactions';

const app = new Hono();

app.post('/', async (c) => {
  // verify
  const signature = c.req.header('x-signature-ed25519');
  const timestamp = c.req.header('x-signature-timestamp');
  const body = await c.req.text();
  const isValidRequest =
    signature && timestamp && verifyKey(body, signature, timestamp, "DISCORD_PUBLICK_KEY");
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

  
})

export default app
