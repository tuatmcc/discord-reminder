import { jsx } from 'hono/jsx';

export const Top = (props: { events: { name: string; date: string; id: number }[] }) => {
    return (
        <div>
            <h1>Events</h1>
            <form action="add_event" method="post">
                <input name="name" type="text" />
                <input name="date" type="date" />
                <input name="time" type="time" />
                <input type="submit" value="登録" />
            </form>
            <ul>
                {props.events.map((event) => (
                    <li>
                        {event.date}: {event.name}{' '}
                        <form action="delete_event" method="post">
                            {' '}
                            <input type="submit" value="削除" /> <input type="hidden" name="id" value={event.id} />{' '}
                        </form>{' '}
                    </li>
                ))}
            </ul>
        </div>
    );
};
