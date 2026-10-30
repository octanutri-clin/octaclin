import json
import unittest
from unittest.mock import patch
from coletar_fontes import ConteudoPrincipal, DATASET, MAX_BYTES, analisar, coletar


def analisar_html(html):
    return analisar('sintetica', 'https://example.invalid', 'https://example.invalid', html.encode())


class ManifestoSinteticoTest(unittest.TestCase):
    def test_script_dinamico_nao_muda_hash_textual_mas_muda_hash_bytes(self):
        a = analisar_html('<main>A &amp; B<script>nonce=1</script></main>')
        b = analisar_html('<main>A &amp; B<script>nonce=2</script></main>')
        self.assertEqual(a['sha256TextoPrincipal'], b['sha256TextoPrincipal'])
        self.assertNotEqual(a['sha256Bytes'], b['sha256Bytes'])

    def test_mudanca_na_tabela_muda_hash_textual(self):
        a = analisar_html('<main><table><tr><td>12</td></tr></table></main>')
        b = analisar_html('<main><table><tr><td>13</td></tr></table></main>')
        self.assertNotEqual(a['sha256TextoPrincipal'], b['sha256TextoPrincipal'])

    def test_nao_aceita_pagina_de_erro_sem_main(self):
        with self.assertRaises(ValueError):
            analisar_html('<title>Blocked</title>')

    def test_conserva_data_sem_trata_la_como_versao_clinica(self):
        r = analisar_html('<meta name="dcterms.modified" content="2000-01-01"><main>teste</main>')
        self.assertEqual(r['paginaModificadaEm'], '2000-01-01')
        self.assertNotIn('versaoClinica', r)

    def test_rejeita_tamanho_excessivo(self):
        with self.assertRaises(ValueError):
            analisar('sintetica', '', '', b'x' * (MAX_BYTES + 1))

    def test_exige_identidade_exata_do_dataset(self):
        dados = json.dumps({'success': True, 'result': {'id': 'outro'}}).encode()
        with self.assertRaises(ValueError):
            analisar('metadados', '', '', dados)

    def test_preserva_licenca_sem_inventar_concessao(self):
        dados = json.dumps({'success': True, 'result': {'id': DATASET, 'license_id': 'desconhecida'}}).encode()
        r = analisar('metadados', '', '', dados)
        self.assertEqual(r['licenseId'], 'desconhecida')
        self.assertNotIn('aprovacaoComercial', r)

    def test_falha_de_rede_interrompe_coleta(self):
        with patch('coletar_fontes.urlopen', side_effect=OSError('falha sintética')):
            with self.assertRaises(OSError):
                coletar()


if __name__ == '__main__':
    unittest.main()
