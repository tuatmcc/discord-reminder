import { jsx } from 'hono/jsx'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { Bindings } from './bindings';
import { differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { DBWrapper } from './lib/db';
import { buildContestEventMessage, buildMentionHeader } from './lib/message';
import { RESTAPIWrapper } from './lib/discord';
import { getFutureContests } from './lib/crawler';
import { v4 as uuid } from 'uuid';
// 何分前に通知するか
const ALART_TIMINGS = new Set([5, 10, 15, 30, 60]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const scheduledHandler: ExportedHandlerScheduledHandler<Bindings> = async (event, env, ctx) => {
    switch (event.cron) {
        case '* * * * *':
            await notifyNearEvents(env);
            break;
        case '0 * * * *':
            await addFutureContests(env);
            break;
    }
};

const notifyNearEvents = async (env: Bindings) => {
    const db = new DBWrapper(env.DB);
    const rest = new RESTAPIWrapper(env.DISCORD_BOT_TOKEN);
    const events = await db.readEvents();
    for (const event of events) {
        const untilEventMinutes = differenceInMinutes(event.date, toZonedTime(new Date(), 'Asia/Tokyo'));
        if (untilEventMinutes <= 0) {
            await db.deleteEvent(event.id);
            continue;
        }
        switch (event.notifyFrequency) {
            case 'once':
                if (untilEventMinutes + 1 <= 60) {
                    const [roles, users] = await Promise.all([
                        db.readRolesMentionedInEvent(event.id),
                        db.readUsersMentionedInEvent(event.id),
                    ]);
                    await rest.postMessageWithDeleteButton(
                        env.DISCORD_BOT_CHANNEL_ID,
                        buildMentionHeader(roles, users) + `${event.title} まであと ${untilEventMinutes + 1} 分です`,
                        `delete-${event.id}`,
                    );
                    await db.deleteEvent(event.id);
                }
                break;
            case 'normal':
                if (ALART_TIMINGS.has(untilEventMinutes + 1)) {
                    const [roles, users] = await Promise.all([
                        db.readRolesMentionedInEvent(event.id),
                        db.readUsersMentionedInEvent(event.id),
                    ]);
                    await rest.postMessageWithDeleteButton(
                        env.DISCORD_BOT_CHANNEL_ID,
                        buildMentionHeader(roles, users) + `${event.title} まであと ${untilEventMinutes + 1} 分です`,
                        `delete-${event.id}`,
                    );
                }
                break;
        }
    }
};

const addFutureContests = async (env: Bindings) => {
    const db = new DBWrapper(env.DB);
    const contests = await getFutureContests();
    for (const contest of contests) {
        const message = buildContestEventMessage(contest);
        if (!(await db.checkEventExistsByTitle(message))) {
            await db.createEvent(
                {
                    id: uuid(),
                    title: message,
                    content: '',
                    date: contest.time,
                    channelId: env.DISCORD_BOT_CHANNEL_ID,
                    notifyFrequency: 'once',
                },
                [],
                [env.DISCORD_KYOPRO_ROLE_ID],
            );
        }
    }
};
