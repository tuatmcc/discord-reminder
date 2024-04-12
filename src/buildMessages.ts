import { Event } from './db';

export const buildDisplayEventsMessage = (events: Event[]) => {
    let message = '';
    for (const event of events) {
        message += `${event.date}: ${event.name}\n`;
    }
    return message;
};
