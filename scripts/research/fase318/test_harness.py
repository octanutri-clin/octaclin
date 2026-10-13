import unittest
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('harness',Path(__file__).with_name('avaliar-sinteticos.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
avaliar=module.avaliar
class Harness(unittest.TestCase):
 def test_referencia_desconhecida(self):self.assertIn('referencia',avaliar([{'ref':'F1'}],{'itens':[{'texto':'Sintetico','refs':['X9']}],'limitacoes':[]})['erros_estruturais'])
 def test_nao_ratifica_clinica(self):self.assertEqual(avaliar([{'ref':'F1'}],{'itens':[{'texto':'Sintetico','refs':['F1']}],'limitacoes':[]})['revisao_clinica'],'PENDENTE')
if __name__=='__main__':unittest.main()
