"""Oráculo independente sintético; stdlib Python, sem acesso a pacientes/rede."""
from fractions import Fraction
from random import Random
from pathlib import Path
import json
SEED = 314159
rng = Random(SEED)
def texto(n, casas):
    return f'{n // 10**casas}.{n % 10**casas:0{casas}d}'
def razao(v):
    return {'numerador': str(v.numerator), 'denominador': str(v.denominator)}
def halfup(v):
    return (2 * v.numerator + v.denominator) // (2 * v.denominator)
casos=[]
for nutriente in ['energiaKcal','proteinasG','carboidratosG','gordurasG']:
    for _ in range(1000):
        p=texto(rng.randint(1,10000000),3)
        bp=texto(rng.randint(1,10000000),3)
        ba=texto(rng.randint(1,10000000),3)
        vp=texto(rng.randint(1,10000000000),8)
        va=texto(rng.randint(1,10000000000),8)
        passo=rng.choice(['1','0.1','0.01','0.001'])
        alvo=Fraction(p)*Fraction(vp)/Fraction(bp)
        q=alvo*Fraction(ba)/Fraction(va)
        sugerida=halfup(q/Fraction(passo))*Fraction(passo)
        obtido=sugerida*Fraction(va)/Fraction(ba)
        delta=obtido-alvo
        casos.append({'nutriente':nutriente,'p':p,'bp':bp,'ba':ba,'vp':vp,'va':va,'passo':passo,'alvo':razao(alvo),'q':razao(q),'sugerida':razao(sugerida),'obtido':razao(obtido),'delta':razao(delta),'percentual':razao(100*delta/alvo)})
Path(__file__).with_name('oraculo-equivalencias.json').write_text(json.dumps({'seed':SEED,'casos':casos},separators=(',',':'))+'\n')
