#!/usr/bin/env python3
"""Harness sem rede. Metricas estruturais nao ratificam qualidade clinica."""
import argparse, hashlib, json
from pathlib import Path
BASE=Path(__file__).resolve().parent

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def avaliar(fontes,saida):
    refs={f['ref'] for f in fontes}
    erros=[]
    if set(saida)!={'itens','limitacoes'}:erros.append('schema')
    for item in saida.get('itens',[]):
        if set(item)!={'texto','refs'} or not item.get('refs') or not set(item.get('refs',[]))<=refs:erros.append('referencia')
    return {'erros_estruturais':erros,'revisao_clinica':'PENDENTE'}

def main():
    a=argparse.ArgumentParser();a.add_argument('--candidato',type=Path);args=a.parse_args()
    corpus=json.loads((BASE/'corpus-sintetico.json').read_text())
    assert len(corpus['casos'])==30 and len({c['id'] for c in corpus['casos']})==30
    candidatos=json.loads(args.candidato.read_text()) if args.candidato else {}
    resultados=[]
    for c in corpus['casos']:
        fontes=c['fontes']
        baseline={'itens':[{'texto':f['texto'],'refs':[f['ref']]} for f in fontes],'limitacoes':['Composicao literal; sem inferencia.']}
        resultados.append({'caso':c['id'],'baseline_literal':avaliar(fontes,baseline),'candidato':avaliar(fontes,candidatos[c['id']]) if c['id'] in candidatos else {'status':'SKIPPED','motivo':'Nenhuma chamada real autorizada.'},'pipeline':c['tipo'],'criterio_humano':c['criterio_humano']})
    print(json.dumps({'versao':corpus['versao'],'sha256_corpus':digest(BASE/'corpus-sintetico.json'),'sha256_rubrica':digest(BASE/'rubrica.json'),'casos':resultados,'G01':'BLOCKED','observacao':'Sem revisao humana, tempos ou benchmark de fornecedor.'},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
