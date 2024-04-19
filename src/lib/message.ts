import { Event } from '../types/event';
import { Contest } from '../types/contest';

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
