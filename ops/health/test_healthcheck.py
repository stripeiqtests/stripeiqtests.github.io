import importlib.util
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('healthcheck', __file__.replace('test_healthcheck.py', 'healthcheck.py'))
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class HealthcheckTests(unittest.TestCase):
    def test_reads_database_and_checks_real_image(self):
        responses = [[{'id': 'test-id'}], (b'<div id="root"></div>', 'text/html'), (b'GIF89a', 'image/gif')]
        with patch.object(health, 'read_url', side_effect=responses) as request:
            self.assertEqual(len(health.check()), 3)
        self.assertIn('/rest/v1/tests?', request.call_args_list[0].args[0])
        self.assertTrue(request.call_args_list[0].kwargs['database'])

    def test_no_active_test_fails_instead_of_false_success(self):
        with patch.object(health, 'read_url', return_value=[]):
            with self.assertRaisesRegex(RuntimeError, 'no active test'):
                health.check()

    def test_html_instead_of_image_is_failure(self):
        responses = [[{'id': 'test-id'}], (b'<div id="root"></div>', 'text/html'), (b'not found', 'text/html')]
        with patch.object(health, 'read_url', side_effect=responses):
            with self.assertRaisesRegex(RuntimeError, 'illustration'):
                health.check()


if __name__ == '__main__':
    unittest.main()
