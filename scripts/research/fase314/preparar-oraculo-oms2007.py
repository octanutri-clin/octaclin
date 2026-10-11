"""Entradas exclusivamente sintéticas para executar a implementação R oficial OMS.
Coeficientes TXT completos permanecem no diretório temporário, fora do produto/Git.
"""
import pathlib,csv,json,argparse,math,importlib.util
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('pesquisa',ROOT/'docs/history/phases/reviews/fase-314-rev11/g01_engine_rev11.py')
e=importlib.util.module_from_spec(s);s.loader.exec_module(e)
a=argparse.ArgumentParser();a.add_argument('--fontes',type=pathlib.Path,required=True);a.add_argument('--output',type=pathlib.Path,required=True);args=a.parse_args()
rows=[]
for ind,last in [('bfa',229),('hfa',229),('wfa',121)]:
    data=list(csv.DictReader((args.fontes/f'who2007-{ind}.txt').open(),delimiter='\t'))
    assert len(data)==(last-60+1)*2
    for sexo in (1,2):
        d={float(r['age']):(float(r['l']),float(r['m']),float(r['s'])) for r in data if int(r['sex'])==sexo}
        assert sorted(d)==list(range(60,last+1))
        for month in range(60,last):
            for frac in [0,.5]:
                age=month+frac;p=tuple((1-frac)*d[month][i]+frac*d[month+1][i] for i in range(3))
                for z in [-5,-3,-2,0,2,3,5]:
                    if abs(z)<=3 or ind=='hfa': val=e.who_lms_inverse(z,*p)
                    else:
                        sg=1 if z>0 else -1
                        val=e.who_lms_inverse(sg*3,*p)+sg*(abs(z)-3)*abs(e.who_lms_inverse(sg*3,*p)-e.who_lms_inverse(sg*2,*p))
                    rows.append({'indicador':ind,'sexo':sexo,'meses':age,'medida':val})
        for age in [59.999,60.001,last-.001,last,last+.001]:
            rows.append({'indicador':ind,'sexo':sexo,'meses':age,'medida':100 if ind=='hfa' else 15})
args.output.mkdir(parents=True,exist_ok=True)
with (args.output/'entradas-oms2007.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
print('Entradas sinteticas:',len(rows))
