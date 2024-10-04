export type User = {
    id: string;
    name: string;
};

export type Role = {
    id: string;
    name: string;
};

export type Channel = {
    id: string;
    name: string;
};

export type Contest = {
    id: string;
    name: string;
    url: string;
    time: Date;
};

export type NotifyFrequency = 'normal' | 'once';

export type Event =
    | {
          id: string;
          title: string;
          content: string;
          date: Date;
          notifyFrequency: 'normal';
          timing?: number[];
          channelId: string;
      }
    | {
          id: string;
          title: string;
          content: string;
          date: Date;
          notifyFrequency: 'once';
          channelId: string;
      };
