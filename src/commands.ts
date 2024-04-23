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
            name: 'title',
            description: 'title of the event',
            required: true,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: 'date',
            description: 'date of the event. Format: (YYYY-)MM-DD',
            required: true,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: 'time',
            description: 'time of the event. Format: HH:MM',
            required: true,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: 'content',
            description: 'description of the event',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Mentionable,
            name: 'mention1',
            description: 'role or user to mention',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Mentionable,
            name: 'mention2',
            description: 'role or user to mention',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Mentionable,
            name: 'mention3',
            description: 'role or user to mention',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Mentionable,
            name: 'mention4',
            description: 'role or user to mention',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Mentionable,
            name: 'mention5',
            description: 'role or user to mention',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: 'notifytype',
            description: 'type of notification (once, normal)',
            required: false,
        },
        {
            type: ApplicationCommandOptionType.Channel,
            name: 'channel',
            description: 'channel to post the event',
            required: false,
        },
    ],
};

export const COMMANDS = [EVENTS_COMMAND, ADD_COMMAND];
