# Deploying My Care

This guide takes a fresh Ubuntu 24.04 server to a running My Care: the patient
app, the sub-admin portal, the super-admin console and the API, on one host
over HTTPS.

**Every step here is exercised by CI.** The `deploy-smoke` workflow
(`.github/workflows/deploy-smoke.yml`) sets up a fresh Ubuntu 24.04 machine
with these same commands and the committed files in `deploy/`, deploys with
`deploy.sh`, and runs the full Playwright suite through nginx. The only
differences are the ones CI cannot avoid: it has no public host name, so it
serves plain HTTP on `localhost` (where browsers still allow service workers)
and skips certbot.

---

## What it looks like

One host, split by path. One origin means staff login needs no cross-domain
cookie setup (ADR-0004), and one certificate covers everything.

| Path | What | Built from |
|---|---|---|
| `/` | Patient app (Figures 17–29), offline-capable | `apps/pwa/dist` |
| `/portal/` | Sub-admin portal (Figures 30–35) | `apps/portal/dist` |
| `/console/` | Super-admin console (Figures 36–41) | `apps/console/dist` |
| `/api/`, `/sanctum/`, `/up` | Laravel 13 through PHP-FPM | `apps/api` |

Figures 30 and 36 show the portal and console on DOH-style host names. Those
are illustrations (ADR-0004), and paths on one host serve the same screens.

On the server:

| Component | Version | Why |
|---|---|---|
| Ubuntu | 24.04 LTS | what CI proves |
| nginx | distro | static files, TLS, PHP-FPM |
| PHP | 8.4 (FPM) | the API; `ppa:ondrej/php` |
| MySQL | 8.0 | required by the manuscript (Tables 25, 29). Never SQLite |
| Node.js | 20 | **needed at runtime**, not just to build: the API replays sessions through the real triage engine to compute dashboard tiers (ADR-0007) |

A small VPS (1–2 vCPUs, 2 GB RAM, 20 GB disk) is enough for a pilot across the
15 barangays. The builds are the heaviest thing it does.

---

## Before you start

- **A server** running Ubuntu 24.04, with a user who can `sudo`.
- **A domain name** whose DNS `A` record points at the server. Wait until
  `ping your.host.name` answers from the server's address before step 6.
- **HTTPS is not optional.** Browsers only run service workers over HTTPS. On
  plain HTTP the patient app still loads, but **has no offline mode at all**,
  and offline mode is the point of the system.
- **Access to the repository.** If `PHILIPORACOMA/My-Care` is private, create a
  read-only [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
  for the server and clone over SSH.

Throughout, replace `mycare.example.org` with your host name.

---

## 1. Packages

```bash
sudo add-apt-repository -y ppa:ondrej/php
sudo apt-get update
sudo apt-get install -y nginx mysql-server git rsync \
  php8.4-fpm php8.4-cli php8.4-mysql php8.4-mbstring php8.4-xml \
  php8.4-bcmath php8.4-intl php8.4-curl php8.4-zip php8.4-gd \
  certbot

# Composer
curl -fsSL https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer

# Node.js 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

php --version       # 8.4.x
node --version      # v20.x
```

## 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'     # 80 and 443
sudo ufw enable
```

MySQL listens on `127.0.0.1` only (Ubuntu's default). Never open 3306.

## 3. Database

```bash
sudo mysql_secure_installation
sudo mysql
```

```sql
CREATE DATABASE mycare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mycare'@'localhost' IDENTIFIED BY 'a-long-random-password';
GRANT ALL PRIVILEGES ON mycare.* TO 'mycare'@'localhost';
```

A dedicated user with rights on `mycare` only, never `root`. On Ubuntu, MySQL's
own `root` authenticates by socket, so the backup job (step 10), which runs as
the system root, needs no stored password.

## 4. Code

```bash
sudo git clone https://github.com/PHILIPORACOMA/My-Care.git /var/www/mycare
```

The path `/var/www/mycare` is fixed in the nginx, PHP-FPM and cron files. To
use another, change it in every file under `deploy/`.

## 5. Environment

```bash
sudo cp /var/www/mycare/deploy/env.production.example /var/www/mycare/apps/api/.env
sudo nano /var/www/mycare/apps/api/.env
```

Replace every `CHANGE-ME`: the host name (four places) and the database
password from step 3. Leave the rest alone. Every line that differs from
development is marked `(!)` in the template, and the important ones are:

| Setting | Value | Why |
|---|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` | debug mode leaks stack traces and configuration |
| `APP_TIMEZONE` | `UTC` | **never** `Asia/Manila`: storage is UTC, display converts (CLAUDE.md rule 6) |
| `SESSION_SECURE_COOKIE` | `true` | the staff session cookie only travels over HTTPS |
| `SANCTUM_STATEFUL_DOMAINS` | your host, no scheme | staff login answers 400 from any origin not listed |

`APP_KEY` is generated on the first deploy. The file holds secrets: never
commit it, never copy it off the server.

## 6. Web server, PHP-FPM, HTTPS

Get the certificate first. The production site config points at certbot's
files, and nginx will not start without them.

```bash
# Port 80 must be free for the standalone challenge.
sudo systemctl stop nginx
sudo certbot certonly --standalone -d mycare.example.org \
  --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
```

The hooks are saved, so automatic renewal stops nginx for the few seconds the
challenge takes, every 60 days or so. `sudo certbot renew --dry-run` checks it.

Then install the committed configuration:

```bash
cd /var/www/mycare/deploy

sudo cp nginx/mycare-app.conf nginx/mycare-headers.conf /etc/nginx/snippets/
sudo cp nginx/mycare.conf /etc/nginx/sites-available/mycare
sudo sed -i 's/mycare.example.org/YOUR.HOST.NAME/g' /etc/nginx/sites-available/mycare
sudo ln -sf /etc/nginx/sites-available/mycare /etc/nginx/sites-enabled/mycare
sudo rm -f /etc/nginx/sites-enabled/default

sudo cp php-fpm/mycare.conf /etc/php/8.4/fpm/pool.d/mycare.conf
sudo cp cron/mycare /etc/cron.d/mycare

sudo nginx -t && sudo php-fpm8.4 -t
sudo systemctl restart php8.4-fpm
sudo systemctl start nginx
```

What these files do, briefly (each file explains itself in comments):

- **`nginx/mycare-app.conf`**: the path layout above. Only Laravel's
  `index.php` ever executes. The service worker and `index.html` are never
  HTTP-cached, so a phone cannot get stuck on old triage code. Hashed assets
  are cached for a year.
- **`nginx/mycare-headers.conf`**: `nosniff`, `DENY` framing, HSTS, and a
  `Permissions-Policy` that refuses geolocation, camera and microphone
  outright. The patient app uses none of them (RA 10173; no microphone by
  design).
- **`php-fpm/mycare.conf`**: its own pool and socket. It **keeps `PATH`** so
  PHP can find `node` for engine replay. PHP-FPM empties the environment by
  default, and without this line the dashboards never refresh.
- **`cron/mycare`**: Laravel's scheduler every minute (which runs
  `mycare:aggregate` every 10 minutes), and the nightly backup.

## 7. Deploy

```bash
sudo /var/www/mycare/deploy/deploy.sh
```

It pulls `main`, installs PHP dependencies (production only), builds engine
replay and the three apps, migrates the database, generates `APP_KEY` if the
file has none, caches configuration, and reloads PHP-FPM. During the release
the API answers 503. Phones keep working offline and retry their upload later.
It takes a few minutes, mostly the builds, and it is safe to re-run.

## 8. First run: the things only a person should do

The deploy leaves an empty system: 15 barangays, no staff, no published rules.
Each step below is a person's decision, so none of it is automated.

```bash
cd /var/www/mycare/apps/api

# 1. The first super-admin. It prompts for the password, so it never lands in
#    shell history. At least 12 characters, letters and numbers.
sudo -u www-data php artisan mycare:staff:create-super-admin you@example.org

# 2. Import the appraised v1 ruleset. It lands as a DRAFT: devices see nothing yet.
sudo -u www-data php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json

# 3. Emergency facilities for "Call for help" (Figure 27), from the City Health
#    Office's CSV. Until this runs, the button falls back to 911.
sudo -u www-data php artisan mycare:facilities:import /path/to/facilities.csv
```

Then, in a browser at `https://mycare.example.org/console/`:

4. **Publish v1:** Rules & lexicon → v1 → **Submit for review** →
   **Publish**, ticking the clinical-review confirmation. That tick is an
   attestation recorded in the audit log under your name. Give it only on the
   basis of the signed appraisal. Until something is published, the patient
   app tells people the health office has not published rules yet.
5. **Enter the reviewed lexicon terms**, when you have them, as a new draft
   version, then publish that. Without them, patients pick from chips and free
   text matches nothing.
6. **Create the sub-admin accounts** (User management), one per RHU/LGU
   staff member, each scoped to its barangay.

## 9. Check it

| Check | How | Expect |
|---|---|---|
| Health | `curl -s https://mycare.example.org/up` | HTTP 200 |
| Engine replay | Console → System dashboard → Service health | all four **ok**, "Node v20…" |
| Scheduler | the same panel, 10 minutes later | Aggregation job "Last run" a few minutes ago |
| Patient, online | open `https://mycare.example.org/` on a phone, onboard | Home offers **Check symptoms** |
| **Patient, offline** | aeroplane mode, close and reopen the app, run a check | a result, and Settings shows it waiting to send |
| Sync | aeroplane mode off, open the app | Settings: "Everything has been sent"; the portal's Sync & status shows the device |
| Portal | sign in as a sub-admin at `/portal/` | only that barangay; counts under 5 show `<5` |

The offline check is the one that matters most, and the one plain HTTP would
silently fail.

## 10. Backups

`deploy/backup.sh` runs nightly at 02:30 (server time) from `/etc/cron.d/mycare`
and writes `/var/backups/mycare/mycare-<UTC timestamp>.sql.gz`, keeping 14 days.
It is a consistent snapshot (`--single-transaction`), so it does not block
phones syncing.

```bash
sudo /var/www/mycare/deploy/backup.sh          # run one now
sudo ls -lh /var/backups/mycare/
```

Restore (this **replaces** the database. Put the site in maintenance mode first):

```bash
cd /var/www/mycare/apps/api
sudo -u www-data php artisan down
gunzip -c /var/backups/mycare/mycare-YYYYMMDDTHHMMSSZ.sql.gz | sudo mysql mycare
sudo -u www-data php artisan up
```

The dumps hold de-identified session records, aggregates, the audit log and
staff accounts (password digests only). There are no names, no free text and no
location finer than a barangay. It is still health surveillance data under
RA 10173: keep the directory root-only, and **encrypt anything copied off the
server**. A backup that exists only on the server it protects is not a backup.
Copy them somewhere else on a schedule.

## 11. Updating and rolling back

**Update:**

```bash
sudo /var/www/mycare/deploy/deploy.sh
```

**Roll back the code** to an earlier commit:

```bash
cd /var/www/mycare
sudo git log --oneline -10                   # find the commit
sudo git checkout <commit>
sudo SKIP_PULL=1 /var/www/mycare/deploy/deploy.sh
# later, back to normal updates:
sudo git checkout main
```

Migrations only run forward. If a release changed the schema and you must go
back past it, restore the backup taken before the release (step 10).

**Roll back the rules** is a different thing, and needs no deploy: Console →
Rules & lexicon → a retired version → **Roll back to** it. It publishes a copy of the
earlier version, and devices pick it up on their next check (ADR-0006).

## 12. Security checklist

- [ ] `APP_DEBUG=false`, `APP_ENV=production` in `apps/api/.env`
- [ ] `.env` is `root:www-data`, mode `640` (`deploy.sh` sets this)
- [ ] HTTPS works and HTTP redirects to it; `certbot renew --dry-run` passes
- [ ] `ufw status` shows only OpenSSH and Nginx Full
- [ ] MySQL bound to `127.0.0.1`; the app uses the `mycare` user, not root
- [ ] SSH by key only (`PasswordAuthentication no`)
- [ ] `sudo apt-get install unattended-upgrades` for security patches
- [ ] Backups copied off the server, encrypted
- [ ] Staff passwords are the staff's own; nobody else types them

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| System Health: **engine replay down**; dashboards never change | PHP-FPM cannot find `node` | the pool file's `env[PATH]` line; `which node` must be in it; `npm run build -w @mycare/engine-replay` must have run (`deploy.sh` does) |
| Dashboards stale, "Aggregation job" last run long ago | cron not running the scheduler | `/etc/cron.d/mycare` present, owned by root, **no CRLF line endings**; `grep CRON /var/log/syslog` |
| Staff login fails (400 or 419) | origin not first-party, or cookie not sent | `SANCTUM_STATEFUL_DOMAINS` = the host exactly; `APP_URL` is `https://`; you are on HTTPS |
| Patient app works online but not offline | no service worker | the site must be HTTPS; check DevTools → Application → Service workers |
| Patient app still shows an old version | old service worker | it updates on the next launch with signal; `sw.js` must not be cached (the nginx config ensures it) |
| 502 Bad Gateway | PHP-FPM down, or the socket name differs | `systemctl status php8.4-fpm`; the socket in `mycare-app.conf` and the pool must match |
| 500 on every API call | `.env` unreadable, or storage not writable | re-run `deploy.sh`, which resets permissions; see `apps/api/storage/logs/` |

## For the defence demo

- **Use the deployed HTTPS host from a phone.** A laptop serving over plain
  HTTP on the local Wi-Fi gives the phone no service worker, so the offline
  demo fails.
- If there is no server yet, the laptop itself can demo offline mode: on
  `localhost`, browsers allow service workers without HTTPS. Run
  `npm run build -w @mycare/pwa && npm run preview -w @mycare/pwa` and use
  DevTools → Network → Offline (docs/STATUS.md, Commands).
- `npm run e2e -w @mycare/e2e` then `npm run e2e:report -w @mycare/e2e` gives a
  full run with screenshots named for the manuscript figures.
