#!/bin/sh
# My Care - nightly MySQL backup (run by /etc/cron.d/mycare as root).
#
# Dumps the `mycare` schema to /var/backups/mycare, compressed, and keeps the
# last 14 days. Credentials come from /root/.my.cnf (DEPLOYMENT.md step 3),
# never from this file or the command line.
#
# What is in the dump: de-identified session records, aggregates, the audit
# log and staff accounts (bcrypt digests). No patient names, no free text, no
# location beyond barangay - but it is still health surveillance data under
# RA 10173. Keep the backup directory root-only, and if you copy backups off
# the server, encrypt them first.

set -eu

DIR=/var/backups/mycare
KEEP_DAYS=14
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

umask 077
mkdir -p "$DIR"

# --single-transaction: a consistent snapshot without locking the tables the
# sync endpoint is writing to.
mysqldump --single-transaction --routines --triggers mycare | gzip > "$DIR/mycare-$STAMP.sql.gz"

find "$DIR" -name 'mycare-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) backup ok: $DIR/mycare-$STAMP.sql.gz"
