alter table merchant
    add column exclude_from_time_spend boolean not null default false;
