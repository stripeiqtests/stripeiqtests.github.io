"""Read-only production smoke check, scheduled outside GitHub and the laptop."""
import datetime
import json
import os
from pathlib import Path
import sys
import time
import urllib.request

SITE = 'https://inner-code.me'
SUPABASE = 'https://afsoyuczexiztsjntkvi.supabase.co'
PUBLIC_KEY = 'sb_publishable_ARjsX-L4PvbkuPSEttyQnQ_Wtq-Aibs'


def read_url(url, *, database=False, as_json=False):
    headers = {'User-Agent': 'inner-code-health/1.0'}
    if database:
        headers['apikey'] = PUBLIC_KEY
        headers['Cache-Control'] = 'no-cache'
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise RuntimeError(f'Unexpected HTTP status {response.status}')
        content = response.read(262144)
        content_type = response.headers.get('Content-Type', '')
    return json.loads(content) if as_json else (content, content_type)


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
    return ['active_test_database_read', 'homepage', 'question_illustration']


def main():
    report = {'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    state_root = os.environ.get('STATE_DIRECTORY')
    state_path = Path(state_root) / 'status.json' if state_root else None
    if state_path and state_path.exists():
        try:
            report['last_success_at'] = json.loads(state_path.read_text()).get('last_success_at')
        except (ValueError, OSError):
            pass
    result = 1
    for attempt in range(1, 3):
        try:
            report.update(status='ok', checks=check(), attempts=attempt)
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
        temporary.write_text(serialized + '\n')
        temporary.replace(state_path)
    print(serialized, flush=True)
    return result


if __name__ == '__main__':
    sys.exit(main())
