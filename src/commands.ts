import {
    ApplicationCommandOptionType,
    RESTPostAPIApplicationCommandsJSONBody,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

export const EVENTS_COMMAND: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'events',
    description: 'displays all scheduled events',
};

export const ADD_COMMAND: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'add',
    description: 'add an event',
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: 'name',
            description: 'name of the event',
            required: true,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: 'date',
            description: 'date of the event',
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Mentionable,
            name: 'mention',
            description: 'role or user to mention',
            required: false,
        },
    ],
};

export const COMMANDS = [EVENTS_COMMAND, ADD_COMMAND];
