# Migrations

Plain SQL, golang-migrate naming: `NNNN_slug.up.sql` and `NNNN_slug.down.sql`, applied in numeric order. Add one pair per change; never edit an applied file.

```
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/migrations/0001_init.up.sql
```

`migrate -path api/migrations -database "$DATABASE_URL" up` also works. Verify up, down in reverse, then up again:

```
bash scripts/check-migrations.sh
```

`transaction.fingerprint` is generated from account, posted date and time, kind, debit, credit, balance after, and raw description. It is a unique index, not a constraint, so it can be rebuilt without a table rewrite when those inputs change.
