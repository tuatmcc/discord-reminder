import { NotifyType } from './notifyType';

export type Event = {
    id: number;
    title: string;
    content: string;
    date: Date;
};

export type FullEvent = Event & {
    notify_type: NotifyType;
    channel_id: string;
};
