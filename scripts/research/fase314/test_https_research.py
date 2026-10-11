"""Fixtures locais: nenhuma chamada de rede ou entrada clínica real."""
import ast
import hashlib
import importlib
import pathlib
import sys
import ssl
import unittest
import tempfile
from unittest.mock import Mock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))


class ResearchHTTPS(unittest.TestCase):
    def setUp(self):
        self.transport = importlib.import_module('https_research')
        self.hosts = frozenset({'cdn.who.int', 'raw.githubusercontent.com'})

    def test_rejects_invalid_urls_before_network(self):
        urls = [
            'file:///etc/passwd', 'http://cdn.who.int/file',
            'https://127.0.0.1/file', 'https://cdn.who.int.evil.example/file',
            'https://rawXgithubusercontent.com/file',
            'https://raw.githubusercontentXcom/file',
            'https://cdn.who.int@evil.example/file',
            'https://user:pass@cdn.who.int/file',
            'https://cdn.who.int:8443/file', 'https://cdn.who.int/file#fragment',
            'https://cdn.who.int/\nfile', 'https://cdn.who.int\\@evil.example/file',
        ]
        with patch('http.client.HTTPConnection') as connection:
            for url in urls:
                with self.subTest(url=url), self.assertRaises(ValueError):
                    self.transport.fetch_https(url, allowed_hosts=self.hosts)
            connection.assert_not_called()

    def test_get_allowed_host(self):
        response = Mock(status=200)
        response.read.return_value = b'synthetic reference'
        events = []
        plain_socket, tls_socket = object(), object()
        with patch('http.client.HTTPConnection') as factory, patch('ssl.create_default_context') as create_context:
            connection = factory.return_value
            connection.connect.side_effect = lambda: (events.append('connect'), setattr(connection, 'sock', plain_socket))
            context = create_context.return_value
            context.verify_mode = ssl.CERT_REQUIRED
            context.check_hostname = True
            context.wrap_socket.side_effect = lambda sock, server_hostname: (
                events.append('tls'), tls_socket if sock is plain_socket and server_hostname == 'cdn.who.int' else None)[1]
            connection.request.side_effect = lambda *args, **kwargs: events.append('http')
            connection.getresponse.return_value = response
            raw, status = self.transport.fetch_https(
                'https://cdn.who.int:443/path?version=1', allowed_hosts=self.hosts,
                headers={'User-Agent': 'synthetic test'}, timeout=30)
            self.assertEqual((raw, status), (b'synthetic reference', 200))
            factory.assert_called_once_with('cdn.who.int', port=443, timeout=30)
            context.wrap_socket.assert_called_once_with(plain_socket, server_hostname='cdn.who.int')
            self.assertIs(connection.sock, tls_socket)
            self.assertEqual(events, ['connect', 'tls', 'http'])
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
            self.assertTrue(context.check_hostname)
            connection.request.assert_called_once_with('GET', '/path?version=1',
                body=None, headers={'User-Agent': 'synthetic test'})
            connection.close.assert_called_once()

    def test_post_synthetic_payload(self):
        response = Mock(status=200)
        response.read.return_value = b'synthetic result'
        with patch('http.client.HTTPConnection') as factory, patch('ssl.create_default_context') as create_context:
            connection = factory.return_value
            connection.sock = object()
            create_context.return_value.wrap_socket.return_value = object()
            connection.getresponse.return_value = response
            self.transport.fetch_https('https://intergrowth21.ndog.ox.ac.uk/preterm/en/ManualEntry/Compute',
                allowed_hosts=frozenset({'intergrowth21.ndog.ox.ac.uk'}), data=b'Sex=Male')
            args = connection.request.call_args
            self.assertEqual(args.args, ('POST', '/preterm/en/ManualEntry/Compute'))
            self.assertEqual(args.kwargs['body'], b'Sex=Male')
            self.assertEqual(args.kwargs['headers']['Content-Type'], 'application/x-www-form-urlencoded')
            self.assertEqual(create_context.return_value.wrap_socket.call_args.kwargs,
                {'server_hostname': 'intergrowth21.ndog.ox.ac.uk'})

    def test_redirects_and_errors_are_not_followed(self):
        with patch('http.client.HTTPConnection') as factory, patch('ssl.create_default_context') as create_context:
            connection = factory.return_value
            connection.sock = object()
            create_context.return_value.wrap_socket.return_value = object()
            for status in (301, 302, 307, 308, 404, 500):
                factory.reset_mock()
                connection.getresponse.return_value = Mock(status=status)
                with self.subTest(status=status), self.assertRaises(ValueError):
                    self.transport.fetch_https('https://cdn.who.int/file', allowed_hosts=self.hosts)
                factory.assert_called_once()
                connection.close.assert_called_once()
                connection.getresponse.return_value.read.assert_not_called()
                factory.reset_mock()

    def test_tls_failure_sends_no_http_request(self):
        with patch('http.client.HTTPConnection') as factory, patch('ssl.create_default_context') as create_context:
            connection = factory.return_value
            connection.sock = object()
            create_context.return_value.wrap_socket.side_effect = ssl.SSLError('synthetic TLS failure')
            with self.assertRaises(ssl.SSLError):
                self.transport.fetch_https('https://cdn.who.int/file', allowed_hosts=self.hosts)
            connection.request.assert_not_called()
            connection.close.assert_called_once()

    def test_closes_connection_on_transport_error(self):
        with patch('http.client.HTTPConnection') as factory, patch('ssl.create_default_context'):
            connection = factory.return_value
            connection.connect.side_effect = OSError('synthetic failure')
            with self.assertRaises(OSError):
                self.transport.fetch_https('https://cdn.who.int/file', allowed_hosts=self.hosts)
            connection.request.assert_not_called()
            connection.close.assert_called_once()





class ResearchCallSites(unittest.TestCase):
    def test_scripts_use_the_restricted_transport(self):
        root = pathlib.Path(__file__).resolve().parent
        for name in ('baixar-fontes-oms.py', 'coletar-oraculo-oxford.py'):
            with self.subTest(script=name):
                tree = ast.parse((root / name).read_text())
                self.assertFalse(any(isinstance(node, ast.Import) and
                    any(alias.name == 'urllib.request' for alias in node.names)
                    for node in ast.walk(tree)))
                calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                         and isinstance(node.func, ast.Name) and node.func.id == 'fetch_https']
                self.assertEqual(len(calls), 1)
                self.assertIn('allowed_hosts', [kw.arg for kw in calls[0].keywords])

    def test_downloader_rejects_file_url_without_writing(self):
        result, files = self.run_downloader('file:///etc/passwd', b'synthetic')
        self.assertEqual(result['status'], 'BLOCKED_DOWNLOAD')
        self.assertEqual(files, [])

    def test_downloader_preserves_hash_validation(self):
        result, files = self.run_downloader('https://cdn.who.int/reference.xlsx', b'synthetic')
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(files, ['reference.xlsx'])
        result, files = self.run_downloader('https://cdn.who.int/reference.xlsx', b'changed')
        self.assertEqual(result['status'], 'FAIL_HASH')
        self.assertEqual(files, [])

    def run_downloader(self, url, response_bytes):
        source = pathlib.Path(__file__).with_name('baixar-fontes-oms.py')
        spec = importlib.util.spec_from_file_location('research_downloader', source)
        downloader = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(downloader)
        with tempfile.TemporaryDirectory() as directory, \
                patch('http.client.HTTPConnection') as factory, \
                patch('ssl.create_default_context') as create_context:
            connection = factory.return_value
            plain_socket = object()
            connection.connect.side_effect = lambda: setattr(connection, 'sock', plain_socket)
            create_context.return_value.wrap_socket.return_value = object()
            response = Mock(status=200)
            response.read.return_value = response_bytes
            connection.getresponse.return_value = response
            result = downloader.fetch(('reference.xlsx', url,
                hashlib.sha256(b'synthetic').hexdigest()), pathlib.Path(directory))
            files = [path.name for path in pathlib.Path(directory).iterdir()]
            if url.startswith('file:'):
                factory.assert_not_called()
            else:
                create_context.return_value.wrap_socket.assert_called_once_with(
                    plain_socket, server_hostname='cdn.who.int')
            return result, files


if __name__ == '__main__':
    unittest.main()
