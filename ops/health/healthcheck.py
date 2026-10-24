"""Read-only production smoke check, scheduled outside GitHub and the laptop."""
import argparse
import datetime
import json
import os
from pathlib import Path
import sys
import time
import urllib.parse
import urllib.request

SITE = 'https://inner-code.me'
SUPABASE = 'https://afsoyuczexiztsjntkvi.supabase.co'
PUBLIC_KEY = 'sb_publishable_ARjsX-L4PvbkuPSEttyQnQ_Wtq-Aibs'


def read_url(url, *, database=False, as_json=False, body=None):
    headers = {'User-Agent': 'inner-code-health/1.0'}
    if database:
        headers['apikey'] = PUBLIC_KEY
        headers['Cache-Control'] = 'no-cache'
    if body is not None:
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(url, headers=headers,
                                     data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise RuntimeError(f'Unexpected HTTP status {response.status}')
        content = response.read(262145 if as_json else 262144)
        content_type = response.headers.get('Content-Type', '')
    if as_json and len(content) > 262144:
        raise RuntimeError('Healthcheck JSON response exceeds the budget')
    return json.loads(content) if as_json else (content, content_type)


def check_storage():
    # POST /object/list is a read-only Storage API operation. The publishable
    # key uses the bucket's public SELECT policy, never a service/admin key.
    # Bound traversal so a large or deeply nested bucket cannot exhaust a run.
    folders = ['']
    sampled = 0
    while folders and sampled < 3:
        prefix = folders.pop(0)
        page = read_url(SUPABASE + '/storage/v1/object/list/images', database=True, as_json=True,
                        body={'prefix': prefix, 'limit': 10, 'offset': 0,
                              'sortBy': {'column': 'name', 'order': 'asc'}})
        sampled += 1
        if not isinstance(page, list) or len(page) > 10:
            raise RuntimeError('Invalid Storage listing')
        for item in page:
            name = item.get('name')
            if not isinstance(name, str) or not name or '\0' in name or any(part in {'.', '..'} for part in name.split('/')):
                raise RuntimeError('Invalid Storage object name')
            full_name = prefix + name
            if item.get('id'):
                url = SUPABASE + '/storage/v1/object/public/images/' + urllib.parse.quote(full_name, safe='/')
                content, content_type = read_url(url)
                if not content or not content_type.startswith('image/'):
                    raise RuntimeError('The Storage illustration is unavailable')
                return {'checks': ['storage_listing', 'storage_object_download'], 'skipped_checks': []}
            folders.append(full_name + '/')
    reason = 'bucket_empty' if sampled == 1 and not page else 'no_object_in_bounded_sample'
    return {'checks': ['storage_listing'], 'skipped_checks': [
        {'check': 'storage_object_download', 'reason': reason},
    ]}


def check():
    # This is an actual, minimal database read, not a request for a cached homepage.
    tests = read_url(
        SUPABASE + '/rest/v1/tests?select=id&is_active=eq.true&limit=1',
        database=True, as_json=True,
    )
    if not isinstance(tests, list) or not tests or not tests[0].get('id'):
        raise RuntimeError('The database returned no active test')
    page, page_type = read_url(SITE + '/')
    if 'text/html' not in page_type or b'id="root"' not in page:
        raise RuntimeError('The homepage did not return the application HTML')
    image, image_type = read_url(SITE + '/question_images/q11_1.gif')
    if not image or not image_type.startswith('image/'):
        raise RuntimeError('The public question illustration is unavailable')
    storage = check_storage()
    return {'checks': ['active_test_database_read', 'homepage', 'question_illustration', *storage['checks']],
            'skipped_checks': storage['skipped_checks']}


def inspect_status(state, *, now=None, max_age_hours=8):
    """Offline check of the last actual run; a stopped timer cannot stay green."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    report = {'status': 'error', 'observed_at': now.isoformat()}
    try:
        checked = datetime.datetime.fromisoformat(state['checked_at'])
        successful = datetime.datetime.fromisoformat(state['last_success_at'])
        if checked.tzinfo is None or successful.tzinfo is None or state.get('status') not in {'ok', 'error'}:
            raise ValueError('Invalid timestamp/status')
        if max(checked, successful) > now + datetime.timedelta(minutes=5) or successful > checked:
            raise ValueError('Future/inconsistent timestamp')
        check_age = (now - checked).total_seconds()
        success_age = (now - successful).total_seconds()
        report.update(checked_at=checked.isoformat(), last_success_at=successful.isoformat(),
                      last_check_age_seconds=max(0, int(check_age)),
                      last_success_age_seconds=max(0, int(success_age)))
        if state['status'] != 'ok':
            report['reason'] = 'last_check_failed'
        elif max(check_age, success_age) > max_age_hours * 3600:
            report['reason'] = 'check_stale'
        else:
            report.update(status='ok', checks=state.get('checks', []), skipped_checks=state.get('skipped_checks', []))
    except (ValueError, KeyError, TypeError, OverflowError):
        report['reason'] = 'missing_or_invalid_success_record'
    return report


def read_status(path):
    with Path(path).open('rb') as stream:
        content = stream.read(65537)
    if len(content) > 65536:
        raise ValueError('Oversized status')
    state = json.loads(content)
    if not isinstance(state, dict):
        raise ValueError('Invalid status record')
    return state


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--status-file', help='Inspect freshness of an existing JSON report without a network request')
    parser.add_argument('--max-age-hours', type=int, default=8, choices=range(1, 25), metavar='1..24')
    args = parser.parse_args(argv)
    if args.status_file:
        try:
            report = inspect_status(read_status(args.status_file), max_age_hours=args.max_age_hours)
        except (OSError, ValueError, TypeError):
            report = {'status': 'error', 'reason': 'status_file_unavailable_or_invalid'}
        print(json.dumps(report, ensure_ascii=False), flush=True)
        return 0 if report['status'] == 'ok' else 1
    report = {'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    state_root = os.environ.get('STATE_DIRECTORY')
    state_path = Path(state_root) / 'status.json' if state_root else None
    if state_path and state_path.exists():
        try:
            report['last_success_at'] = read_status(state_path).get('last_success_at')
        except (ValueError, OSError):
            pass
    result = 1
    for attempt in range(1, 3):
        try:
            report.update(status='ok', attempts=attempt, **check())
            report.pop('error', None)
            report['last_success_at'] = report['checked_at']
            result = 0
            break
        except Exception as error:
            report.update(status='error', error=f'{type(error).__name__}: {error}', attempts=attempt)
            if attempt == 1:
                time.sleep(2)
    serialized = json.dumps(report, ensure_ascii=False)
    if state_path:
        temporary = state_path.with_suffix('.tmp')
        try:
            temporary.write_text(serialized + '\n', encoding='utf-8')
            temporary.replace(state_path)
        except OSError:
            report.update(status='error', error='Could not persist health status')
            serialized = json.dumps(report, ensure_ascii=False)
            result = 1
    print(serialized, flush=True)
    return result


if __name__ == '__main__':
    sys.exit(main())
