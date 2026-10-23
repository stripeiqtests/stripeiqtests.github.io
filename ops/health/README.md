# Portable health check and historical VPS files

The selected IQ Tests scheduler is the existing Cloudflare Worker; see
[`../scheduler/README.md`](../scheduler/README.md) for checks, schedule, deployment
and cutover evidence. IQ Tests must not depend on the shared Telegraph VPS.

`healthcheck.py` remains a portable, read-only Python diagnostic and an offline
freshness inspector. It reads public test metadata, the homepage, a static GIF,
and a bounded public Storage sample. An empty bucket skips object download.
It never writes data, sends email, resumes projects or changes permissions.

```sh
python3 ops/health/healthcheck.py
python3 ops/health/healthcheck.py --status-file /private/health.json
python3 -m unittest discover -s ops/health -p 'test_*.py' -v
```

The status command is offline; it rejects malformed, failed, future-dated or
more than eight-hour-old reports, including the Cloudflare health report.
It is not an automatic notification service.

The `.service`/`.timer` files are retained only as historical recovery evidence.
Do not install or re-enable them on the shared VPS. After the Cloudflare
replacement passes a real scheduled run, disable `inner-code-health.timer` only,
verify disabled/inactive, and retain its status/logs. Telegraph's own monitoring
services must remain unchanged. See `audit/monitoring-2026-10-23.json` for the
preceding installation evidence, not current deployment status.
