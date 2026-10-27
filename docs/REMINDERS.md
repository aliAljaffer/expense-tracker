# Reminders

The API emails the owner on the first of every month to ask for the latest bank
statements. Delivery is optional. With no SMTP server configured the feature
stays off, and the rest of the app is unaffected.

The code is in `internal/reminder/`. The settings routes are in
`internal/httpapi/settings.go`.

## What the reminder does

- The API checks once an hour, and once at startup.
- It sends at or after 08:00 on the first of the month, in `REMINDER_TZ`.
- It sends to the address stored in Settings.
- It records the send in `reminder_last_sent`, so a month produces one email.
- The email is plain text. The subject is
  `grooszy: upload your latest statements`.

The body is fixed in `internal/reminder/reminder.go`. It names Alinma and Al
Rajhi and carries no account data, amounts, or balances.

### Once per month

`reminder_last_sent` in the `app_setting` table holds `YYYY-MM`
(`api/migrations/0004_settings.up.sql`). The API writes it only after the SMTP
server accepts the message. The next hourly check in the same month reads the
value and returns.

A failed send is logged and retried on the next hourly check. If the email is
sent but the write fails, the API logs `record reminder sent failed`, and the
next check sends again.

The check has no lock. Run one API replica. The dev deployment runs one.

## Settings screen

`/settings` has one field and two buttons
(`web/src/app/(app)/settings/page.tsx`,
`web/src/components/features/settings/SettingsForm.tsx`).

| Control | Effect |
|---|---|
| Reminder email | The only recipient. The server validates it with `net/mail.ParseAddress` |
| Save | `PUT /api/settings` |
| Send test email | `POST /api/settings/reminder/test`. Disabled until an address is saved |

The screen calls the API through the Next.js BFF at `/api/bff/settings` and
`/api/bff/settings/reminder/test` (`web/src/lib/api/settings.ts`). The browser
never calls the Go API directly.

## Endpoints

All three routes require the owner's bearer token. A missing or invalid token
returns 401. A valid token for another subject returns 403. A database that is
not reachable returns 503 `{"error":"database unavailable"}`.

### GET /api/settings

```json
{"reminder_email": "owner@example.com"}
```

`reminder_email` is an empty string when no address is stored.

```bash
curl -sS "$API/api/settings" -H "Authorization: Bearer $TOKEN"
```

### PUT /api/settings

```json
{"reminder_email": "owner@example.com"}
```

The address is trimmed and validated. A stored address is returned in the same
shape as `GET /api/settings`.

| Status | Meaning |
|---|---|
| 200 | Stored |
| 400 | Body is not JSON or not an object |
| 422 | Address is empty or invalid. `{"error":"reminder email is required"}` or `{"error":"reminder email is not valid"}` |
| 500 | The write failed |

### POST /api/settings/reminder/test

Sends the reminder now to the saved address. Use it to check delivery without
waiting for the first of the month.

```bash
curl -sS -X POST "$API/api/settings/reminder/test" \
  -H "Authorization: Bearer $TOKEN"
```

| Status | Body | Meaning |
|---|---|---|
| 200 | `{"sent":true}` | The SMTP server accepted the message |
| 422 | `{"error":"no reminder email set"}` | No address is stored |
| 502 | `{"error":"email is disabled"}` | `SMTP_ADDR` is empty |
| 502 | `{"error":"email could not be sent"}` | The send failed |

The test uses the saved address. It does not use text that has not been saved.

## Configuration

| Variable | Required | Meaning | Example |
|---|---|---|---|
| `SMTP_ADDR` | no | SMTP `host:port`. Empty disables reminders | `smtp.example.com:587` |
| `SMTP_USER` | no | SMTP username. Empty sends without authentication | `owner@example.com` |
| `SMTP_PASS` | no | SMTP password. Never returned by the API and never logged | `synthetic-app-password` |
| `SMTP_FROM` | yes when `SMTP_ADDR` is set | Envelope sender, a bare address | `grooszy@example.com` |
| `REMINDER_TZ` | no | IANA zone that sets the send hour. Default `UTC` | `Asia/Riyadh` |

Example:

```bash
export SMTP_ADDR=smtp.example.com:587
export SMTP_USER=owner@example.com
export SMTP_PASS='synthetic-app-password'
export SMTP_FROM=grooszy@example.com
export REMINDER_TZ=Asia/Riyadh
```

Notes:

- An invalid `REMINDER_TZ` stops the API at startup. The API never sends at the
  wrong hour.
- `SMTP_ADDR` must be `host:port`. A value without a port makes every send fail.
- Set `SMTP_FROM`. The API does not check it at startup. A send without it
  fails with `SMTP_FROM is not set`, and the test endpoint returns 502.
- The mailer uses STARTTLS through `net/smtp`. A server that requires implicit
  TLS on connect, commonly port 465, fails.
- `SMTP_PASS` is never returned by the API and never logged.

## Verify with Send test email

1. Set the SMTP variables and restart the API.
2. Confirm the startup log line `monthly reminder enabled`.
3. Open `/settings`.
4. Enter the address and select Save. Wait for `Reminder email saved.`
5. Select Send test email.
6. Confirm the banner reports the send, then confirm the message arrives.

Run the test before the first of the month. A failed send on the first is
retried on the next hourly check, but a misconfigured server fails every time.

A 502 means the SMTP server refused the message. Read the API log line
`send test reminder failed`, then check `SMTP_ADDR`, `SMTP_FROM`, and the
credentials. The log does not repeat the password.

## When SMTP is unset

- The API logs one line at startup:
  `monthly reminder disabled, SMTP_ADDR is not set`. It does not repeat the
  line on later checks.
- The hourly loop returns before any database read. No send is attempted.
- Settings still loads and saves the address.
- `POST /api/settings/reminder/test` returns 422 when no address is stored, and
  502 `{"error":"email is disabled"}` when one is stored.
- `REMINDER_TZ` is still parsed. An invalid value stops the API even when email
  is off.

## Known limits

- Only a fake SMTP server in `internal/reminder/reminder_test.go` has proven
  delivery. No real provider has been tested end to end.
- No lock covers the once-per-month check. Use one API replica.
- Implicit TLS on connect is not supported.
- The address is read at send time. A change applies at the next hourly check.
