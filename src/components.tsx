import { jsx } from 'hono/jsx';

export const Reminder = (props: { events: { name: string; date: string; id: number }[] }) => {
    return (
        <html lang="ja">
            <head>
                <meta charset="UTF-8"></meta>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
                <title>リマインダー管理</title>

                <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css"></link>

                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css"></link>
            </head>
            <body>
                <div class="container my-5">
                    <h1 class="mb-4">リマインダー管理</h1>
                    <div class="card mb-4">
                        <div class="card-body">
                            <h2 class="card-title mb-4">新しいイベントを追加</h2>
                            <form action="add_event" method="post">
                                <div class="form-group">
                                    <label for="date">日付</label>
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <div class="input-group-text">
                                                <i class="fas fa-calendar-alt"></i>
                                            </div>
                                        </div>
                                        <input type="date" class="form-control" id="date" placeholder="MM/DD"></input>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="time">時間</label>
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <div class="input-group-text">
                                                <i class="fas fa-clock"></i>
                                            </div>
                                        </div>
                                        <input type="time" class="form-control" id="time" placeholder="HH:MM"></input>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="event">イベント名</label>
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <div class="input-group-text">
                                                <i class="fas fa-calendar-check"></i>
                                            </div>
                                        </div>
                                        <input type="text" class="form-control" id="event" placeholder="イベント名"></input>
                                    </div>
                                </div>
                                <input type="submit" class="btn btn-primary" value="追加"></input>
                            </form>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h2 class="card-title mb-4">登録されたイベント</h2>

                            <table class="table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th>日時</th>
                                        <th>イベント名</th>
                                        <th>削除</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.events.map((event) => (
                                        <tr>
                                            <td>{event.date}</td>
                                            <td>{event.name}</td>
                                            <td>
                                                <form action="delete_event" method="post">
                                                    <input type="submit" class="btn btn-danger" value="削除" />
                                                    <input type="hidden" name="id" value={event.id} />
                                                </form>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>
                <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
            </body>
        </html>
    );
};
