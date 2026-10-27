# Backups

A backup is one PostgreSQL database. The app stores no statement files, so there
are no files to back up.

## What a backup must contain

- A consistent dump of the `grooszy` database, including `schema_migrations`.
  It holds every table in `api/migrations/`, including accounts, imports,
  transactions, and the reminder settings.
- The API image digest, so the schema version and the code that wrote it stay
  together. The digests are pinned in `deploy/dev/*-deployment.yaml`.
- The secrets and configuration needed to start the app: `DATABASE_URL`, the
  OIDC values, `SESSION_SECRET`, and the SMTP values. They are not in the
  database. The dev values in `deploy/dev/` are test values; production values
  are not in this repository.

Nothing else is data. An uploaded statement is parsed from memory and never
written to disk (`docs/API.md`). Re-export the file from the bank if you need it
again.

## Restore

Restore testing is not automated. There is no restore script and no restore test
in this repository. Until a restore has been run against a real backup, restore
is unproven.

Warning: stop the API before a restore. The API applies migrations at startup
and the reminder loop reads and writes `app_setting`, so both can write to the
database while it is being restored.

1. Stop the API.
2. Restore the dump into an empty database.
3. Point `DATABASE_URL` at the restored database.
4. Start the API with the image digest recorded with the backup. It applies any
   missing migrations at startup (`cmd/api/main.go`).

The app applies up migrations only. It never rolls back. Restore with the API
version that matches the backup.

## Kubernetes today

The dev cluster uses CloudNativePG. `deploy/dev/02-cnpg-cluster.yaml` sets a
backup target and online volume snapshots:

```yaml
backup:
  target: prefer-standby
  volumeSnapshot:
    online: true
```

That block configures how a backup runs. It does not schedule one. No
`ScheduledBackup` object is in this repository, so nothing here takes a
scheduled backup.

Production manifests are not in this repository. A draft `ScheduledBackup` for
production lives on the unmerged homelab branch, together with the rest of the
production manifests. Check the namespace for a `ScheduledBackup` before you
rely on one.
