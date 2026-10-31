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
        with patch('coletar_fontes.abrir_fonte', side_effect=OSError('falha sintética')):
            with self.assertRaises(OSError):
                coletar()


class TransporteOficialTest(unittest.TestCase):
    """Exercita o pipeline urllib real com transporte sintético, sem sockets."""
    def setUp(self):
        from email.message import Message
        from io import BytesIO
        from urllib.request import BaseHandler, build_opener
        from urllib.response import addinfourl
        import coletar_fontes as modulo
        self.modulo = modulo
        self.fontes = dict(modulo.FONTES)
        self.chamadas = []
        self.redirecionamentos = {}
        teste = self

        class TransporteSintetico(BaseHandler):
            handler_order = 100

            def abrir(self, req):
                url = req.full_url
                teste.chamadas.append(url)
                headers = Message()
                if url in teste.redirecionamentos:
                    headers['Location'] = teste.redirecionamentos[url]
                    status, dados = 302, b''
                else:
                    status = 200
                    dados = (json.dumps({'success': True, 'result': {'id': DATASET}}).encode()
                             if url == teste.fontes['metadados'] else b'<main>Sintetico</main>')
                resposta = addinfourl(BytesIO(dados), headers, url, status)
                resposta.msg = 'synthetic'
                return resposta

            https_open = http_open = file_open = abrir

        def construtor(*handlers):
            return build_opener(*handlers, TransporteSintetico())

        patcher = patch('coletar_fontes.build_opener', construtor)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_cinco_fontes_legitimas_preservam_manifesto_e_limites(self):
        r = coletar()
        self.assertEqual(self.chamadas, list(self.fontes.values()))
        self.assertEqual(len(r['fontes']), 5)
        self.assertEqual(r['direitos'], 'PENDENTE_conferencia_escopo_e_terceiros')

    def test_bloqueia_redirecionamento_https_externo_antes_da_conexao(self):
        origem = self.fontes['vitaminas']
        self.redirecionamentos[origem] = 'https://example.invalid/fora'
        with self.assertRaises(ValueError):
            coletar()
        self.assertEqual(self.chamadas, [origem])

    def test_bloqueia_downgrade_e_cadeia_https_http_https_no_primeiro_salto(self):
        origem = self.fontes['vitaminas']
        externo = 'http://example.invalid/intermediario'
        self.redirecionamentos.update({origem: externo, externo: self.fontes['elementos']})
        with self.assertRaises(ValueError):
            coletar()
        self.assertEqual(self.chamadas, [origem])

    def test_rejeita_destino_inicial_nao_autorizado_sem_transporte(self):
        for url in ['file:///sintetico', 'http://www.canada.ca/sintetico',
                    'https://www.canada.ca.example.invalid/', 'https://127.0.0.1/',
                    'https://www.canada.ca@localhost/', self.fontes['vitaminas'] + '#fragmento']:
            with self.subTest(url=url):
                self.chamadas.clear()
                with patch.dict(self.modulo.FONTES, {'vitaminas': url}, clear=True):
                    with self.assertRaises(ValueError):
                        coletar()
                self.assertEqual(self.chamadas, [])

    def test_redirect_relativo_para_outra_fonte_explicitamente_permitida(self):
        from urllib.parse import urlsplit
        origem = self.fontes['vitaminas']
        destino = self.fontes['elementos']
        self.redirecionamentos[origem] = urlsplit(destino).path
        r = coletar()
        self.assertEqual(r['fontes'][0]['urlFinal'], destino)
        self.assertEqual(self.chamadas[:2], [origem, destino])

    def test_ciclo_de_redirecionamento_falha_sem_manifesto(self):
        from urllib.error import HTTPError
        origem = self.fontes['vitaminas']
        self.redirecionamentos[origem] = origem
        with self.assertRaises(HTTPError):
            coletar()
        self.assertLessEqual(len(self.chamadas), 6)


if __name__ == '__main__':
    unittest.main()
