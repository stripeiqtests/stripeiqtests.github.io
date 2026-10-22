# Free idle protection

`healthcheck.py` runs on the existing VPS using Python's standard library.
No new subscription, service-role key, administrator credential, or GitHub
scheduled workflow is required.

Every six hours (00:23, 06:23, 12:23, 18:23 UTC, with up to five minutes jitter):

1. Read one active test ID through the production Data API. This generates a
   small real database read even when the website has no visitors.
2. Verify that the homepage returns the application HTML.
3. Fetch an existing public question GIF from the static website. This is a
   check of displayed illustrations, not an administrator upload or a Storage
   write-permission test. Use `supabase/tests/storage_readiness.sql` after a
   database recovery to check the Storage bucket and policies too.

The service retries a failed check once. Its exit code and last result are
recorded by systemd. `status.json` retains the last successful check time.
It does not send messages or modify test data. Failed checks do not attempt
to resume a paused project or alter permissions.

## Install on the existing Ubuntu VPS

Copy these files, then run as root:

```sh
install -d -m 755 /opt/inner-code-health
install -m 644 healthcheck.py /opt/inner-code-health/healthcheck.py
install -m 644 inner-code-health.service inner-code-health.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/inner-code-health.service /etc/systemd/system/inner-code-health.timer
systemctl daemon-reload
systemctl start inner-code-health.service
systemctl enable --now inner-code-health.timer
```

The service runs with a dynamic unprivileged user, restricted filesystem access,
a 64 MiB memory limit and a 10% CPU quota. The timer survives reboots and catches
up a missed calendar run after the server starts.

## Check operation

```sh
systemctl is-enabled inner-code-health.timer
systemctl list-timers inner-code-health.timer --no-pager
systemctl show inner-code-health.service -p Result -p ExecMainStatus
journalctl -u inner-code-health.service -n 20 --no-pager
cat /var/lib/private/inner-code-health/status.json
python3 -m unittest discover -s ops/health -p 'test_*.py' -v
```

To stop this monitor only: `systemctl disable --now inner-code-health.timer`.

This lowers inactivity risk on Free; it is not a guarantee. The VPS must remain
online, and a failure notification destination can be configured separately.
It avoids depending on public-repository GitHub schedules, which can be disabled
after 60 days without repository activity. No artificial commits are created.

References:
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
- https://www.freedesktop.org/software/systemd/man/systemd.timer.html
