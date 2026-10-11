"""Verifica o filtro real do downloader sem executar rede, parser CLI ou runtime."""
import ast
import pathlib
import re
import unittest


class ReferencesSecurity(unittest.TestCase):
    def setUp(self):
        script = pathlib.Path(__file__).with_name('baixar-fontes-oms.py')
        patterns = [node.value for node in ast.walk(ast.parse(script.read_text()))
                    if isinstance(node, ast.Constant) and isinstance(node.value, str)
                    and 'githubusercontent' in node.value and node.value.startswith(r'\|')]
        self.assertEqual(len(patterns), 1)
        self.pattern = patterns[0]

    def linha(self, host):
        return f'| bfawho2007.txt | [fonte](https://{host}/org/repo/commit/file.txt) | `{"a"*64}` |'

    def test_accepts_exact_primary_host(self):
        self.assertEqual(len(re.findall(self.pattern, self.linha('raw.githubusercontent.com'))), 1)

    def test_rejects_similar_hosts(self):
        for host in ['rawXgithubusercontent.com', 'raw.githubusercontentXcom',
                     'raw.githubusercontent.com.evil.example', 'raw.githubusercontent.com@evil.example']:
            with self.subTest(host=host):
                self.assertEqual(re.findall(self.pattern, self.linha(host)), [])

    def test_rejects_non_https(self):
        self.assertEqual(re.findall(self.pattern, self.linha('raw.githubusercontent.com').replace('https:', 'http:')), [])


if __name__ == '__main__':
    unittest.main()
