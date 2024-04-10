drop table if exists events;
create table events(
    id int,
    name text,
    date text,
    primary key(id)
);
insert into events(id, name, date) values (1, 'test', '2025-01-01'), (2, 'test2', '2025-01-02');