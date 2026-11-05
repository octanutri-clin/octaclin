import importlib.util
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('papeis_ux', Path(__file__).with_name('validar-papeis-ux.py'))
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def documento(nome):
    return {'name': nome, 'description': 'Revisao sintetica de produto',
            'developer_instructions': 'Somente leitura do brief sintetico fornecido.',
            'features': {k: False for k in MOD.FEATURES}}


class PapeisUxTest(unittest.TestCase):
    def test_papeis_versionados_existem_e_restringem_capacidades(self):
        self.assertEqual(MOD.auditar(Path(__file__).resolve().parent.parent), [])

    def test_nao_aceita_autoridade_modelo_mcp_sandbox_ou_features_extras(self):
        for campo in ('model', 'model_provider', 'mcp_servers', 'sandbox_mode', 'approval_policy'):
            with self.subTest(campo=campo):
                d = documento(MOD.NOMES[0]); d[campo] = 'nao_autorizado'
                self.assertIn('CAMPOS_NAO_PERMITIDOS_OU_AUSENTES', MOD.validar_documento(d, MOD.NOMES[0]))
        d = documento(MOD.NOMES[0]); d['features']['outra'] = False
        self.assertIn('FERRAMENTA_NAO_DESABILITADA', MOD.validar_documento(d, MOD.NOMES[0]))

    def test_nao_aceita_ativar_ferramenta_ou_valor_falso_ambiguo(self):
        for campo in MOD.FEATURES:
            for valor in (True, 'false', 0, None):
                with self.subTest(campo=campo, valor=valor):
                    d = documento(MOD.NOMES[0]); d['features'][campo] = valor
                    self.assertIn('FERRAMENTA_NAO_DESABILITADA', MOD.validar_documento(d, MOD.NOMES[0]))

    def test_identidades_nao_sao_intercambiaveis_e_instrucoes_nao_podem_sumir(self):
        d = documento(MOD.NOMES[1])
        self.assertIn('IDENTIDADE_DIVERGENTE', MOD.validar_documento(d, MOD.NOMES[0]))
        d = documento(MOD.NOMES[0]); d['developer_instructions'] = ' '
        self.assertIn('INSTRUCAO_AUSENTE', MOD.validar_documento(d, MOD.NOMES[0]))

    def test_ausencia_toml_malformado_e_symlink_falham_fechado(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(len(MOD.auditar(tmp)), 2)
            pasta = Path(tmp) / '.codex' / 'agents'; pasta.mkdir(parents=True)
            arquivo = pasta / (MOD.NOMES[0] + '.toml'); arquivo.write_text('name = [')
            self.assertTrue(MOD.auditar(tmp))
            arquivo.unlink(); arquivo.symlink_to('/nao-ler')
            self.assertIn(MOD.NOMES[0] + ':SYMLINK', MOD.auditar(tmp))


if __name__ == '__main__':
    unittest.main()
