"""Pesquisa sintética opt-in: oráculo oficial Oxford, nunca dados do prontuário.
Saída numérica allowlisted; HTML/código remoto não é executado/incorporado.
Tolerâncias declaradas antes da coleta: z 1e-8, percentil 1e-6 pp.
Uso: python coletar-oraculo-oxford.py --output /tmp/pasta
"""
import argparse, hashlib, importlib.util, json, math, pathlib, re, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[3]
ENGINE = ROOT/'docs/history/phases/reviews/fase-314-rev11/g01_engine_rev11.py'
spec = importlib.util.spec_from_file_location('pesquisa', ENGINE)
engine = importlib.util.module_from_spec(spec); spec.loader.exec_module(engine)
URL = 'https://intergrowth21.ndog.ox.ac.uk/preterm/en/ManualEntry/Compute'

def casos(sexo):
    # Todos os 260 dias, ambos sexos/indicadores; níveis alternados + bordas com todos níveis.
    niveis = [-4,-3,-2,0,1,2,4]
    entradas = [(dia, niveis[(dia-189)%7]) for dia in range(189,449)]
    entradas += [(dia,z) for dia in (189,385,448) for z in niveis if (dia,z) not in entradas]
    return [{'pma_dias':d,'sexo':sexo,'z_alvo_sintetico':z,
             'peso_kg':engine.intergrowth_inverse(z,d,sexo,'weight'),
             'comprimento_cm':engine.intergrowth_inverse(z,d,sexo,'length')} for d,z in entradas]

def coletar(entradas, sexo, output, lote):
    payload={'Sex': 'Male' if sexo=='male' else 'Female'}
    for i,c in enumerate(entradas):
        for nome,valor in {'GestationalWeek':c['pma_dias']//7,'GestationalDay':c['pma_dias']%7,
                           'Weight':format(c['peso_kg'],'.17g'),'Length':format(c['comprimento_cm'],'.17g'),'Visible':'true'}.items():
            payload[f'Biometry[{i}].{nome}']=str(valor)
    with urllib.request.urlopen(urllib.request.Request(URL,data=urllib.parse.urlencode(payload).encode()),timeout=45) as r:
        raw=r.read();status=r.status
    (output/f'{sexo}-{lote}.html').write_bytes(raw) # só diretório temporário de pesquisa
    txt=raw.decode()
    arrays={}
    for indicador,indice in [('length',0),('weight',1)]:
        for campo in ('values','centiles','scores'):
            match=re.search(rf'calculations\[{indice}\]\.{campo}\s*=\s*(\[[^;]*\]);',txt)
            if not match:raise ValueError('resposta oficial sem vetor esperado')
            values=json.loads(match.group(1))
            if len(values)!=len(entradas) or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in values):
                raise ValueError('oraculo incompleto/nao finito')
            arrays[(indicador,campo)]=values
    ages=json.loads(re.search(r'var ages\s*=\s*(\[[^;]*\]);',txt).group(1))
    assert ages==[c['pma_dias'] for c in entradas]
    result=[]
    for i,c in enumerate(entradas):
        comparacoes=[]
        for indicador,medida in [('weight','peso_kg'),('length','comprimento_cm')]:
            assert arrays[(indicador,'values')][i]==c[medida]
            z=engine.intergrowth_z(c[medida],c['pma_dias'],sexo,indicador)
            p=engine.intergrowth_centile(z)
            oz,op=arrays[(indicador,'scores')][i],arrays[(indicador,'centiles')][i]
            comparacoes.append({'indicador':indicador,'z_oficial':oz,'percentil_oficial':op,
                               'erro_z_python':abs(z-oz),'erro_percentil_python_pp':abs(p-op)})
        result.append({**c,'resultados':comparacoes})
    return result,{'lote':lote,'sexo':sexo,'status_http':status,'sha256_html':hashlib.sha256(raw).hexdigest(),'casos':len(entradas)}

def main():
    arg=argparse.ArgumentParser();arg.add_argument('--output',type=pathlib.Path,required=True);a=arg.parse_args()
    a.output.mkdir(parents=True,exist_ok=True)
    result=[];lotes=[]
    for sexo in ('male','female'):
        entradas=casos(sexo)
        for inicio in range(0,len(entradas),100):
            casos_lote,e=coletar(entradas[inicio:inicio+100],sexo,a.output,inicio//100)
            result.extend(casos_lote);lotes.append(e)
    indicadores=[i for c in result for i in c['resultados']]
    resumo={'fonte':URL,'entrada':'exclusivamente sintetica gerada neste script','tolerancia_z':1e-8,'tolerancia_percentil_pp':1e-6,
            'casos':len(result),'resultados_indicadores':len(indicadores),'dias_por_sexo':260,
            'max_erro_z':max(i['erro_z_python'] for i in indicadores),
            'max_erro_percentil_pp':max(i['erro_percentil_python_pp'] for i in indicadores),
            'PASS':all(i['erro_z_python']<=1e-8 and i['erro_percentil_python_pp']<=1e-6 for i in indicadores),
            'limitacao':'oraculo independente de codigo local; nao certifica procedencia/licenca nem todos os valores possiveis',
            'lotes':lotes,'casos_sinteticos':result}
    (a.output/'oraculo-oxford-rev11.json').write_text(json.dumps(resumo,indent=2)+'\n')
    print(json.dumps({k:v for k,v in resumo.items() if k not in ('casos_sinteticos','lotes')},indent=2))
    if not resumo['PASS']:raise SystemExit(1)
if __name__=='__main__':main()
