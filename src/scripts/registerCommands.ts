import { getApplicationId } from '../lib/discord';
import { COMMANDS } from '../commands';
import fetch from 'node-fetch';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is undefined.');
}

const registerCommands = async (url: string) => {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${token}`,
        },
        method: 'PUT',
        body: JSON.stringify(COMMANDS),
    });
    if (response.ok) {
        console.log('Registered all commands');
    } else {
        console.error('Error registering commands');
        const text = await response.text();
        console.error(text);
    }
    return response;
};

const registerGlobalCommands = async () => {
    const url = `https://discord.com/api/v10/applications/${getApplicationId(token)}/commands`;
    await registerCommands(url);
};

registerGlobalCommands();
