# n8n setup: Google Calendar + Meet, Google Sheets, Telegram

This guide connects the self-hosted n8n to Google and Telegram and imports the three workflows in `n8n/workflows/`. The contracts between the app and n8n are in `docs/BOOKING-N8N.md`.

| Workflow | Trigger | Does |
|---|---|---|
| `booking-created.json` | `POST /webhook/booking-created` (from the worker) | Calendar event + Meet + visitor invite → app callback → Sheets row → Telegram to you |
| `booking-cancelled.json` | `POST /webhook/booking-cancelled` (from the worker) | Deletes the event (the visitor gets a cancellation email) → Sheets status `CANCELLED` → Telegram |
| `weekly-summary.json` | Sunday 20:00, Asia/Tashkent | `GET /api/n8n/stats` → Telegram summary |

Secrets are never stored in the workflow JSON. They live in n8n **credentials**, which n8n encrypts with `N8N_ENCRYPTION_KEY`.

> n8n only **sends** Telegram messages. Never add a *Telegram Trigger* node for this bot. The worker long-polls the same bot (phase 06), and two consumers break each other.

---

## 1. Start n8n

**Local (dev):**

```bash
docker compose -f docker-compose.dev.yml up -d n8n
```

Open http://localhost:5678 and create the n8n owner account (local only).

**Production:** `docker compose up -d` starts n8n on `127.0.0.1:5678`. Nginx publishes it at `https://n8n.<domain>`. In `.env`, set:
- `N8N_HOST=n8n.<domain>`
- `N8N_ENCRYPTION_KEY=` a long random string. Keep it: if it is lost, every saved credential is lost too.

## 2. Generate the two shared secrets

Run this twice, once for each secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the values in the app's `.env`. The worker reads the same file.

```
N8N_WEBHOOK_SECRET=<value 1>    # worker → n8n, header X-Webhook-Secret
N8N_CALLBACK_SECRET=<value 2>   # n8n → app, header X-Callback-Secret
N8N_BASE_URL=http://127.0.0.1:5678   # dev. In production compose sets http://n8n:5678
```

Restart `pnpm dev` and `pnpm worker` after changing `.env`.

## 3. Google Cloud: OAuth client

1. Go to https://console.cloud.google.com and create a project (e.g. `portfolio-n8n`).
2. Open **APIs & Services → Library**. Enable **Google Calendar API** and **Google Sheets API**.
3. Open **APIs & Services → OAuth consent screen**:
   - User type **External**, with your own email as the support and developer contact.
   - Scopes can stay empty, because n8n requests them.
   - Then press **Publish app → In production**. In *Testing* mode, Google expires refresh tokens after **7 days**, and the n8n Google credentials stop working silently. You don't need verification for your own account. When you connect, Google shows "unverified app": click *Advanced → Go to … (unsafe)*.
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**.
   - **Authorized redirect URI**:
     - dev: `http://localhost:5678/rest/oauth2-credential/callback`
     - production: `https://n8n.<domain>/rest/oauth2-credential/callback`

     The credential dialog in n8n shows its exact *OAuth Redirect URL*. Copy that value character for character.
5. Copy the **Client ID** and **Client secret**.

## 4. Google Sheet

1. Create a spreadsheet and rename its first tab to **`Bookings`**.
2. Paste this header row into row 1. Each name goes in its own column, in this order:

   ```
   bookingId	createdAt	status	startsAt (Tashkent)	name	email	telegram	phone	company	purpose	service	note	meetUrl	visitorTimezone	locale
   ```

   The line is tab-separated, so pasting it into A1 fills A1:O1.
3. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

## 5. Telegram

1. In phase 06 the worker uses `TELEGRAM_BOT_TOKEN` (from @BotFather). n8n uses the same token to send messages.
2. Get your numeric user ID from @userinfobot and set it as `OWNER_TELEGRAM_ID` in `.env`.
3. Open your bot and press **Start** once. A bot cannot message a user who never started it.

## 6. Create the n8n credentials

In n8n, open **Credentials → Add credential**. The names must match exactly, because the imported nodes look for them by name.

| Credential type | Name | Fields |
|---|---|---|
| Google Calendar OAuth2 API | `Google Calendar account` | Client ID + Client secret from step 3 → **Sign in with Google** |
| Google Sheets OAuth2 API | `Google Sheets account` | same Client ID/secret → **Sign in with Google** |
| Telegram API | `Telegram bot` | Access Token = `TELEGRAM_BOT_TOKEN` |
| Header Auth | `Portfolio webhook secret` | Name `X-Webhook-Secret`, Value = `N8N_WEBHOOK_SECRET` |
| Header Auth | `Portfolio callback secret` | Name `X-Callback-Secret`, Value = `N8N_CALLBACK_SECRET` |

Sign in with the Google account whose calendar should hold the meetings. The workflows use its `primary` calendar.

## 7. Import and configure the workflows

For each file in `n8n/workflows/`:

1. Go to **Workflows → Create → ⋯ → Import from File** and choose the JSON file.
2. Open every node that shows a red ⚠ and select the credential with the matching name from step 6.
3. Open the **Config** node and set:
   - `appUrl`: how n8n reaches the app, not the public URL.
     - dev (app on your machine, n8n in Docker): `http://host.docker.internal:3000`
     - production (same compose network): `http://app:3000`. Keep this internal address even when the API has its own `api.` host: the internal host is not restricted, and no public hop is needed.
   - `sheetId`: from step 4.
   - `ownerTelegramId`: your numeric ID from step 5.
4. `booking-created` and `booking-cancelled`: open the Sheets node. If n8n says the columns changed, press **Refresh columns**. Check that every column is still mapped, and in `booking-cancelled` that the match column is still `bookingId`.
5. Check **⋯ → Settings → Timezone**. It must be `Asia/Tashkent` (the import sets it).
6. **Save**, then switch the workflow to **Active**.

Production webhook URLs only work while a workflow is active:
- `/webhook/booking-created`
- `/webhook/booking-cancelled`

The worker calls `{N8N_BASE_URL}/webhook/<path>`. It never uses the `/webhook-test/` URL that the editor shows.

## 8. Test

1. **Without n8n.** This prints the exact payload n8n will receive:

   ```bash
   pnpm test:dispatch --mock
   ```

2. **n8n alone.** This sends a sample booking to the real webhook:

   ```bash
   pnpm test:dispatch
   ```

   Expected:
   - A Calendar event with a Meet link, plus a sheet row.
   - A Telegram alert saying "*ilova tasdiqni qabul qilmadi*". That alert is correct: the sample booking is not in the database, so the app answers 404.
   - Delete the test event and the sheet row afterwards. The invite goes to `visitor@example.com`, which bounces harmlessly.

3. **End to end.** Run `pnpm dev`, `pnpm worker` and n8n. Book a slot on the site with an email you can read, then check:
   - an invite arrives at that email
   - the event in your Google Calendar has a Meet link
   - a `Bookings` row appears with `status = CONFIRMED`
   - Telegram shows "🆕 Yangi uchrashuv"
   - the booking page shows the Meet link
   - Admin → Bookings shows `CONFIRMED`

4. **Cancel.** Cancel that booking from its manage page. The event should disappear and the visitor should get a cancellation email. The row's `status` should change to `CANCELLED`, and Telegram should show "❌ Uchrashuv bekor qilindi".

5. **Weekly summary.** Open `weekly-summary` and press **Execute workflow**.

## 9. Troubleshooting

**`Error 400: redirect_uri_mismatch` when signing in with Google**
The redirect URI in Google Cloud must equal the *OAuth Redirect URL* shown in the n8n credential dialog: same scheme, host, port, path, and no trailing slash. n8n builds that URL from `WEBHOOK_URL`/`N8N_HOST`/`N8N_PROTOCOL`. In production it must be `https://n8n.<domain>/…`. If it shows `http://localhost…`, fix those env vars and restart n8n.

**Google credentials stop working after about a week (`invalid_grant`, `Token has been expired or revoked`)**
The consent screen is still in *Testing*. Publish it (step 3.3), then reconnect both Google credentials (**Sign in with Google** again).

**Worker log says `n8n /webhook/booking-created responded 404`**
- The workflow is not **Active**, or `N8N_BASE_URL` points to the wrong host.
- Dev: the worker runs on the host, so use `http://127.0.0.1:5678`.
- Production: compose sets `http://n8n:5678`.
- `WEBHOOK_URL` only changes the URL that n8n displays. The worker does not use it.

**Worker log says `responded 403`**
The `Portfolio webhook secret` value differs from `N8N_WEBHOOK_SECRET`. The worker does not retry a 4xx; it sends you a Telegram alert. Fix the value, then press **Retry** in Admin → Bookings.

**Telegram alert "Calendar tadbiri va Meet yaratildi, lekin ilova tasdiqni qabul qilmadi"**
The app callback failed:
- `appUrl` is wrong. `localhost` inside the n8n container is n8n itself.
- The app is down.
- Or `Portfolio callback secret` differs from `N8N_CALLBACK_SECRET`, which shows up as a 401 in the n8n execution.

After fixing it, go to n8n → **Executions**, open that run, and press **Retry**. It resumes from the failed node. Do **not** press Retry in the admin panel: that dispatches again and creates a second event.

**Telegram alert "Google Calendar/Meet yaratilmadi"**
Open the run in n8n → Executions to see Google's error, usually an expired credential or a disabled API. Fix it, then press **Retry** in Admin → Bookings. The booking waits in `PENDING_MEET`.

**Event created but there is no Meet link (the callback answers 400)**
The Google account must be able to create Meet links. Try adding Meet to an event by hand in Calendar. Workspace admins can disable Meet.

**Times are 5 hours off**
- The workflow's **Settings → Timezone** must be `Asia/Tashkent`, and the container must have `GENERIC_TIMEZONE=Asia/Tashkent` (both compose files set it).
- The payload carries UTC ISO times (`…Z`), so the Calendar event itself is always at the right instant. Only the formatted text and the Sunday schedule depend on the timezone.

**Telegram `Bad Request: chat not found`**
Press **Start** in the bot from your account (step 5.3), and use the numeric ID, not `@username`.

**No sheet row / `Sheet with name Bookings not found`**
- The tab must be named exactly `Bookings`, with the header row from step 4.
- Re-open the Sheets node and press **Refresh columns**.
- A failing Sheets step does not stop the Telegram message.
