import {
  ApplicationCommandOptionType,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

export const TEST_COMMAND: RESTPostAPIChatInputApplicationCommandsJSONBody = {
  name: 'test',
  description: 'test',
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'content',
      description: 'test',
      required: true,
    },
  ],
};