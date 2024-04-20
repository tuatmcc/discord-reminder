import { Event } from '../types/event';
import { Contest } from '../types/contest';
import { formatDateToString } from './date';

export const buildDisplayEventsMessage = (events: Event[]) => {
    let message = '';
    for (const event of events) {
        message += `${formatDateToString(event.date)}: ${event.title}\n`;
    }
    return message;
};

export const buildDisplayEventsMessageWithMentionables = (
    events: Event[],
    mentionUsers: { event_id: number; user_id: string }[],
    mentionRoles: { event_id: number; role_id: string }[],
) => {
    let message = '';
    for (const event of events) {
        message += `${formatDateToString(event.date)}: ${event.title}\n`;
    }
    return message;
};

export const buildContestEventMessage = (contest: Contest) => {
    return `[${contest.name}](${contest.url})`;
};
