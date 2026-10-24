import importlib.util
import contextlib
import datetime
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('healthcheck', __file__.replace('test_healthcheck.py', 'healthcheck.py'))
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class HealthcheckTests(unittest.TestCase):
    def base_responses(self):
        return [[{'id': 'test-id'}], (b'<div id="root"></div>', 'text/html'), (b'GIF89a', 'image/gif')]

    def test_reads_database_and_checks_real_image(self):
        responses = [*self.base_responses(), []]
        with patch.object(health, 'read_url', side_effect=responses) as request:
            report = health.check()
        self.assertEqual(len(report['checks']), 4)
        self.assertEqual(report['skipped_checks'], [{'check': 'storage_object_download', 'reason': 'bucket_empty'}])
        self.assertIn('/rest/v1/tests?', request.call_args_list[0].args[0])
        self.assertTrue(request.call_args_list[0].kwargs['database'])
        self.assertIn('/storage/v1/object/list/images', request.call_args_list[3].args[0])

    def test_storage_outage_is_a_failure(self):
        responses = [*self.base_responses(), RuntimeError('Storage unavailable')]
        with patch.object(health, 'read_url', side_effect=responses):
            with self.assertRaisesRegex(RuntimeError, 'Storage unavailable'):
                health.check()

    def test_nested_storage_image_is_downloaded_with_escaped_name(self):
        responses = [*self.base_responses(), [{'name': 'nested', 'id': None}],
                     [{'name': 'фото #1.gif', 'id': 'object-id'}], (b'GIF89a', 'image/gif')]
        with patch.object(health, 'read_url', side_effect=responses) as request:
            report = health.check()
        self.assertIn('storage_object_download', report['checks'])
        self.assertEqual(report['skipped_checks'], [])
        self.assertEqual(request.call_args_list[4].kwargs['body']['prefix'], 'nested/')
        self.assertIn('/nested/%D1%84%D0%BE%D1%82%D0%BE%20%231.gif', request.call_args_list[5].args[0])

    def test_bounded_storage_sample_never_claims_a_download(self):
        with patch.object(health, 'read_url', return_value=[{'name': 'folder', 'id': None}]) as request:
            report = health.check_storage()
        self.assertEqual(request.call_count, 3)
        self.assertNotIn('storage_object_download', report['checks'])
        self.assertEqual(report['skipped_checks'][0]['reason'], 'no_object_in_bounded_sample')

    def test_invalid_storage_object_and_html_response_are_failures(self):
        for page, content in [([{'name': '../unsafe', 'id': 'object'}], None),
                              ([{'name': 'file.gif', 'id': 'object'}], (b'<html>', 'text/html'))]:
            with patch.object(health, 'read_url', side_effect=[page, content]):
                with self.assertRaises(RuntimeError):
                    health.check_storage()

    def test_no_active_test_fails_instead_of_false_success(self):
        with patch.object(health, 'read_url', return_value=[]):
            with self.assertRaisesRegex(RuntimeError, 'no active test'):
                health.check()

    def test_html_instead_of_image_is_failure(self):
        responses = [[{'id': 'test-id'}], (b'<div id="root"></div>', 'text/html'), (b'not found', 'text/html')]
        with patch.object(health, 'read_url', side_effect=responses):
            with self.assertRaisesRegex(RuntimeError, 'illustration'):
                health.check()

    def test_status_detects_stopped_timer_failed_run_and_invalid_time(self):
        now = datetime.datetime(2026, 10, 23, 12, tzinfo=datetime.timezone.utc)
        state = {'status': 'ok', 'checked_at': (now-datetime.timedelta(hours=1)).isoformat(),
                 'last_success_at': (now-datetime.timedelta(hours=1)).isoformat(), 'checks': ['database']}
        self.assertEqual(health.inspect_status(state, now=now)['status'], 'ok')
        for update, reason in [
            ({'checked_at': (now-datetime.timedelta(hours=9)).isoformat(),
              'last_success_at': (now-datetime.timedelta(hours=9)).isoformat()}, 'check_stale'),
            ({'status': 'error'}, 'last_check_failed'),
            ({'checked_at': (now+datetime.timedelta(hours=1)).isoformat()}, 'missing_or_invalid_success_record'),
            ({'last_success_at': '2026-10-23T10:00:00'}, 'missing_or_invalid_success_record'),
            ({'last_success_at': None}, 'missing_or_invalid_success_record'),
        ]:
            self.assertEqual(health.inspect_status({**state, **update}, now=now)['reason'], reason)

    def test_failure_keeps_last_success_but_exits_unsuccessfully(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'status.json'
            previous = (datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=1)).isoformat()
            path.write_text(json.dumps({'last_success_at': previous}))
            with patch.dict(os.environ, {'STATE_DIRECTORY': directory}), \
                    patch.object(health, 'check', side_effect=RuntimeError('fixture failure')), \
                    patch.object(health.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(health.main([]), 1)
            state = json.loads(path.read_text())
            self.assertEqual(state['last_success_at'], previous)
            self.assertEqual(state['status'], 'error')
            self.assertEqual(state['attempts'], 2)
            self.assertEqual(health.inspect_status(state)['reason'], 'last_check_failed')

    def test_missing_or_corrupt_status_file_fails_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'status.json'
            with patch.object(health, 'read_url') as network:
                for content in [None, 'not json', '[]', ' ' * 65537]:
                    if content is not None:
                        path.write_text(content)
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        self.assertEqual(health.main(['--status-file', str(path)]), 1)
                    self.assertEqual(json.loads(output.getvalue())['reason'], 'status_file_unavailable_or_invalid')
                network.assert_not_called()

    def test_successful_retry_removes_error_and_replaces_corrupt_previous_record(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'status.json'
            path.write_text('[]')
            with patch.dict(os.environ, {'STATE_DIRECTORY': directory}), \
                    patch.object(health, 'check', side_effect=[RuntimeError('temporary failure'),
                        {'checks': ['database', 'storage_listing'], 'skipped_checks': []}]), \
                    patch.object(health.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(health.main([]), 0)
            state = json.loads(path.read_text())
            self.assertEqual(state['attempts'], 2)
            self.assertNotIn('error', state)
            self.assertEqual(health.inspect_status(state)['status'], 'ok')

    def test_persist_failure_is_not_reported_as_a_healthy_monitor(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'STATE_DIRECTORY': directory}), \
                    patch.object(health, 'check', return_value={'checks': ['database'], 'skipped_checks': []}), \
                    patch.object(health.Path, 'replace', side_effect=OSError('fixture disk failure')):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    self.assertEqual(health.main([]), 1)
                report = json.loads(output.getvalue())
                self.assertEqual(report['status'], 'error')
                self.assertEqual(report['error'], 'Could not persist health status')


if __name__ == '__main__':
    unittest.main()
