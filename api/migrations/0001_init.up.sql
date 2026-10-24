create table category (
    id bigint generated always as identity primary key,
    name text not null unique,
    parent_id bigint references category (id),
    is_uncategorised boolean not null default false,
    created_at timestamptz not null default now()
);

create unique index category_single_uncategorised on category (is_uncategorised)
    where is_uncategorised;

create table merchant (
    id bigint generated always as identity primary key,
    canonical_name text not null unique,
    default_category_id bigint references category (id),
    biller_code text,
    biller_account text,
    is_bnpl boolean not null default false,
    created_at timestamptz not null default now()
);

create unique index merchant_biller on merchant (biller_code, biller_account)
    where biller_code is not null and biller_account is not null;

create table merchant_alias (
    id bigint generated always as identity primary key,
    merchant_id bigint not null references merchant (id) on delete cascade,
    raw text not null unique
);

create index merchant_alias_merchant on merchant_alias (merchant_id);

create table account (
    id bigint generated always as identity primary key,
    bank text not null,
    number text,
    iban text,
    currency char(3) not null default 'SAR',
    kind text not null check (kind in ('current', 'savings', 'credit_card')),
    owner_is_user boolean not null default true,
    created_at timestamptz not null default now(),
    unique (bank, number)
);

create table statement_import (
    id bigint generated always as identity primary key,
    account_id bigint not null references account (id) on delete cascade,
    file_sha256 text not null unique check (file_sha256 ~ '^[0-9a-f]{64}$'),
    parser text not null,
    parser_version text not null,
    period_start date,
    period_end date,
    opening_balance bigint,
    closing_balance bigint,
    stated_debit_total bigint,
    stated_credit_total bigint,
    stated_debit_count integer,
    stated_credit_count integer,
    parsed_debit_total bigint not null default 0,
    parsed_credit_total bigint not null default 0,
    parsed_debit_count integer not null default 0,
    parsed_credit_count integer not null default 0,
    reconciled boolean not null default false,
    reconciliation jsonb not null default '{}'::jsonb,
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'rejected')),
    created_at timestamptz not null default now(),
    constraint import_requires_reconciliation check (status <> 'accepted' or reconciled),
    constraint import_period_order check (
        period_start is null or period_end is null or period_start <= period_end
    )
);

create index statement_import_account on statement_import (account_id, period_end desc);

create table transaction (
    id bigint generated always as identity primary key,
    account_id bigint not null references account (id) on delete cascade,
    import_id bigint not null references statement_import (id) on delete cascade,
    posted_date date not null,
    posted_time time not null default '00:00',
    value_date date,
    description_raw text not null,
    debit bigint not null default 0 check (debit >= 0),
    credit bigint not null default 0 check (credit >= 0),
    balance_after bigint,
    kind text not null check (kind in (
        'card_purchase', 'online_purchase', 'intl_purchase', 'refund',
        'roundup_sweep', 'internal_transfer', 'external_transfer_in',
        'external_transfer_out', 'salary', 'cash_deposit', 'cash_withdrawal',
        'bill_payment', 'card_payment', 'fee', 'unknown'
    )),
    -- Derived from kind so the flag cannot drift from the parser's
    -- CountsAsSpending rule.
    counts_as_spending boolean generated always as (kind in (
        'card_purchase', 'online_purchase', 'intl_purchase', 'bill_payment',
        'cash_withdrawal', 'fee'
    )) stored,
    merchant_raw text,
    merchant_id bigint references merchant (id),
    category_id bigint references category (id),
    biller_code text,
    biller_account text,
    card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
    fx_currency char(3),
    fx_amount bigint,
    fx_rate numeric(20, 10) check (fx_rate > 0),
    fx_rate_date date,
    fx_fee bigint,
    transfer_pair_id bigint references transaction (id) deferrable initially deferred,
    shared_expense_id bigint,
    -- Every field that must match for two rows to be the same statement row.
    -- Dates are hashed as days since 2000 because date_out is not immutable.
    fingerprint text generated always as (
        md5(
            account_id::text || '|' || (posted_date - date '2000-01-01')::text
            || '|' || posted_time::text || '|' || kind || '|' || debit::text
            || '|' || credit::text || '|' || coalesce(balance_after::text, '')
            || '|' || description_raw
        )
    ) stored,
    created_at timestamptz not null default now(),
    constraint transaction_single_side check (debit = 0 or credit = 0),
    constraint transaction_no_self_pair check (transfer_pair_id is null or transfer_pair_id <> id)
);

create unique index transaction_fingerprint on transaction (fingerprint);
create index transaction_account_date on transaction (account_id, posted_date desc);
create index transaction_date on transaction (posted_date desc);
create index transaction_merchant on transaction (merchant_id, posted_date desc);
create index transaction_category on transaction (category_id, posted_date desc);
create index transaction_import on transaction (import_id);
create index transaction_transfer_pair on transaction (transfer_pair_id)
    where transfer_pair_id is not null;

create table shared_expense (
    id bigint generated always as identity primary key,
    transaction_id bigint not null unique references transaction (id) on delete cascade,
    user_share_ratio numeric(5, 4) not null
        check (user_share_ratio > 0 and user_share_ratio <= 1),
    reimbursement_transaction_id bigint unique references transaction (id),
    expected_reimbursement bigint not null check (expected_reimbursement >= 0),
    status text not null default 'pending'
        check (status in ('pending', 'received', 'overdue'))
);

alter table transaction
    add constraint transaction_shared_expense_fk
    foreign key (shared_expense_id) references shared_expense (id) on delete set null;

create index transaction_shared_expense on transaction (shared_expense_id)
    where shared_expense_id is not null;

create table recurring_series (
    id bigint generated always as identity primary key,
    merchant_id bigint not null references merchant (id) on delete cascade,
    kind text not null check (kind in ('contractual', 'subscription', 'habit')),
    occurrence_count integer not null default 0 check (occurrence_count >= 0),
    distinct_months integer not null default 0 check (distinct_months >= 0),
    median_amount bigint not null default 0,
    total_amount bigint not null default 0,
    first_seen date,
    last_seen date,
    cadence_days integer check (cadence_days > 0),
    is_active boolean not null default true,
    unique (merchant_id, kind)
);

create table debt (
    id bigint generated always as identity primary key,
    kind text not null check (kind in ('credit_card', 'bnpl', 'loan')),
    account_id bigint references account (id) on delete set null,
    balance bigint not null check (balance >= 0),
    credit_limit bigint check (credit_limit > 0),
    apr numeric(7, 4) check (apr >= 0),
    promo_apr numeric(7, 4) check (promo_apr >= 0),
    promo_expires_on date,
    promo_is_deferred_interest boolean not null default false,
    constraint promo_needs_expiry check (promo_apr is null or promo_expires_on is not null)
);

create table user_decision (
    id bigint generated always as identity primary key,
    kind text not null check (kind in (
        'transfer_match', 'merchant_merge', 'category_override', 'shared_expense'
    )),
    payload jsonb not null,
    created_at timestamptz not null default now(),
    unique (kind, payload)
);

create table suggestion (
    id bigint generated always as identity primary key,
    kind text not null,
    body text not null,
    severity text not null default 'info'
        check (severity in ('info', 'warning', 'critical')),
    status text not null default 'new'
        check (status in ('new', 'dismissed', 'actioned')),
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create index suggestion_open on suggestion (status, created_at desc);
