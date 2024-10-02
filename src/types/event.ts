import { NotifyFrequency } from './notifyFrequency';

export type Event = {
    id: string;
    title: string;
    content: string;
    date: Date;
    notifyFrequency: NotifyFrequency;
    channelId: string;
};
