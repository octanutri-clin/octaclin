import unittest
from extrair_tabelas import extrair


def pagina(valor='1,000', coluna='RDA/AI', extra=''):
    return f'''<table id="tbl1"><tr><th id="idade">Age</th><th id="nutriente">Calcium mg/day</th>
    <th id="tipo" headers="nutriente">{coluna}</th><th id="grupo">Males</th></tr><tr>
    <td headers="grupo idade">19–30 y</td><td headers="grupo nutriente tipo">{valor}</td>
    </tr>{extra}</table>'''


class ExtracaoTest(unittest.TestCase):
    def test_numero_e_cabecalhos_exatos(self):
        r = extrair(pagina())[0]
        self.assertEqual((r['grupo'], r['idade'], r['nutriente'], r['coluna'], r['valor']),
                         ('Males', '19–30 y', 'Calcium mg/day', 'RDA/AI', '1000'))

    def test_notas_nao_concatenam_numero(self):
        r = extrair(pagina('75<sup><a href="#nota">8</a></sup>'))[0]
        self.assertEqual(r['valor'], '75')
        self.assertEqual(r['notas'], ['#nota'])

    def test_ausencia_nao_e_zero(self):
        r = extrair(pagina('ND', 'UL'))[0]
        self.assertIsNone(r['valor'])
        self.assertEqual(extrair(pagina('0', 'UL'))[0]['valor'], '0')

    def test_preserva_decimal(self):
        self.assertEqual(extrair(pagina('2.4'))[0]['valor'], '2.4')

    def test_numero_malformado_falha(self):
        with self.assertRaises(ValueError):
            extrair(pagina('1,2'))

    def test_header_duplicado_falha(self):
        with self.assertRaises(ValueError):
            extrair(pagina(extra='<tr><th id="tipo">UL</th></tr>'))

    def test_header_ausente_falha(self):
        with self.assertRaises(ValueError):
            extrair(pagina().replace('id="nutriente"', 'id="outro"'))

    def test_header_idade_ausente_falha(self):
        with self.assertRaises(ValueError):
            extrair(pagina().replace('id="idade"', 'id="idade_errada"'))

    def test_coluna_vinculada_a_outro_nutriente_falha(self):
        with self.assertRaises(ValueError):
            extrair(pagina().replace('id="tipo" headers="nutriente"', 'id="tipo" headers="grupo"'))

    def test_celula_duplicada_falha(self):
        with self.assertRaises(ValueError):
            extrair(pagina().replace('</tr></table>', '<td headers="grupo nutriente tipo">200</td></tr></table>'))

    def test_nao_mapeia_ne_ou_rae_por_aproximacao(self):
        r = extrair(pagina().replace('Calcium mg/day', 'Niacin mg/day NE'))[0]
        self.assertEqual(r['nutriente'], 'Niacin mg/day NE')
        self.assertNotIn('codigoCanonico', r)


if __name__ == '__main__':
    unittest.main()
