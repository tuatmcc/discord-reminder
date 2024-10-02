import { Event } from '../types/event';
import { Contest } from '../types/contest';
import { formatDateToString } from './date';

export const buildMentionHeader = (roleIds: string[], userIds: string[]) => {
    let ret = roleIds
        .map((id) => `<@&${id}>`)
        .concat(userIds.map((id) => `<@${id}>`))
        .join(' ');
    if (ret) {
        ret += '\n';
    }
    return ret;
};

export const buildDisplayEventsMessage = (events: Event[]) => {
    let message = '';
    for (const event of events) {
        message += `${formatDateToString(event.date)}: ${event.title}\n`;
    }
    return message;
};

export const buildDisplayEventsMessageWithMentionables = (
    events: Event[],
    mentionUsers: { event_id: string; user_id: string }[],
    mentionRoles: { event_id: string; role_id: string }[],
) => {
    const eventIdToMentionUsers = new Map<string, string[]>();
    const eventIdToMentionRoles = new Map<string, string[]>();
    for (const mentionUser of mentionUsers) {
        if (!eventIdToMentionUsers.has(mentionUser.event_id)) {
            eventIdToMentionUsers.set(mentionUser.event_id, []);
        }
        eventIdToMentionUsers.get(mentionUser.event_id)?.push(mentionUser.user_id);
    }
    for (const mentionRole of mentionRoles) {
        if (!eventIdToMentionRoles.has(mentionRole.event_id)) {
            eventIdToMentionRoles.set(mentionRole.event_id, []);
        }
        eventIdToMentionRoles.get(mentionRole.event_id)?.push(mentionRole.role_id);
    }
    let message = '';
    for (const event of events) {
        const mentionRoleIds = eventIdToMentionRoles.get(event.id) ?? [];
        const mentionUserIds = eventIdToMentionUsers.get(event.id) ?? [];
        message +=
            mentionRoleIds
                .map((roleId) => `<@&${roleId}>`)
                .concat(mentionUserIds.map((userId) => `<@${userId}>`))
                .join(' ') + '\n';
        message += `${formatDateToString(event.date)}: ${event.title}\n`;
    }
    return message;
};

export const buildContestEventMessage = (contest: Contest) => {
    return `[${contest.name}](${contest.url})`;
};
