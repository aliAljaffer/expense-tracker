alter table statement_import
    add column parsed_row_count integer not null default 0;

create table import_preview (
    import_id bigint primary key references statement_import (id) on delete cascade,
    payload jsonb not null,
    expires_at timestamptz not null
);

create index import_preview_expires on import_preview (expires_at);
