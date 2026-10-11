"""Integridade + reprodução isolada da REV11, preservando os bytes recebidos.
Corrige somente no resultado derivado o contador sobrescrito no gerador externo.
"""
import argparse, hashlib, json, pathlib, shutil, subprocess, sys, tempfile, os
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE=ROOT/'docs/history/phases/reviews/fase-314-rev11'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=pathlib.Path,required=True);args=parser.parse_args()
    mapping=json.loads((BASE/'integracao.json').read_text())['arquivos']
    manifest=(BASE/'MANIFEST_SHA256.txt').read_text().splitlines()
    for line in manifest:
        expected,name=line.split(None,1)
        path=ROOT/mapping[name.strip()]
        if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError('manifesto divergente: '+name)
    args.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='octaclin-rev11-sintetico-') as temp:
        folder=pathlib.Path(temp)
        for name,path in mapping.items():shutil.copy2(ROOT/path,folder/name)
        env={'PATH':os.defpath,'PYTHONNOUSERSITE':'1','PYTHONDONTWRITEBYTECODE':'1'}
        tests=subprocess.run([sys.executable,'-m','unittest','-v','test_g01_rev11.py'],cwd=folder,env=env,capture_output=True,text=True)
        (args.output/'unittest-reexecutado.log').write_text(tests.stdout+tests.stderr)
        if tests.returncode:raise SystemExit(tests.returncode)
        generator=subprocess.run([sys.executable,'gerar_evidencias_rev11.py'],cwd=folder,env=env,capture_output=True,text=True)
        if generator.returncode:raise SystemExit(generator.returncode)
        summary=json.loads((folder/'resultado_resumo_G01_REV11.json').read_text())
        real_cases=len(json.loads((folder/'FASE_314_FIXTURES_SINTETICAS_REV8.json').read_text())['ig_candidate_cases'])
        original_counter=summary['intergrowth']['cases_previous_fixture']
        summary['intergrowth']['cases_previous_fixture']=real_cases
        summary['correcao_contador']={'valor_gerador_original':original_counter,'valor_verificado':real_cases,'causa':'variavel expected sobrescrita pela coluna z_wfa_publ no loop de exemplos WHO; nao altera numeros/oraculos'}
        summary['integridade_manifesto']={'arquivos':len(manifest),'PASS':True}
        for name in ['OMS2006_144_COMPARACOES.csv','OMS2006_12_COMPARACOES_DIRETAS_WHO.csv','OMS2006_4_WFH_COMPARACOES_OFICIAIS.csv','INTERGROWTH_14_COMPARACOES_INTERNAS.csv']:
            shutil.copy2(folder/name,args.output/name)
        (args.output/'resultado-reexecutado-corrigido.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps({'integridade':len(manifest),'testes':13,'casos_ig':real_cases,'contador_recebido':original_counter,'G01':'BLOCKED'},indent=2))
if __name__=='__main__':main()
