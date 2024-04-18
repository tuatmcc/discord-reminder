import { Contest } from './crawler';
import { Event } from './db';
import { formatDateToDisplayString } from './util';

export const buildDisplayEventsMessage = (events: Event[]) => {
    let message = '';
    for (const event of events) {
        message += `${event.date}: ${event.name}\n`;
    }
    return message;
};

export const buildContestEventMessage = (contest: Contest) => {
    return `[${contest.name}](${contest.url})`;
};
