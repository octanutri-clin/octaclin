"""Motor ARITMÉTICO DE PESQUISA G01 — NÃO USAR EM PRONTUÁRIO NEM EM PRODUÇÃO.

Sem download de dados, dependências ou material de paciente. Os coeficientes
INTERGROWTH são candidatos da investigação REV3, ainda não licenciados/ratificados.
Este código é independente do runtime TypeScript OctaClin e testa APENAS a aritmética.
"""
from __future__ import annotations
import math


def who_lms_z(value:float, L:float, M:float, S:float)->float:
    if not all(math.isfinite(v) for v in (value,L,M,S)) or min(value,M,S)<=0:
        raise ValueError('entrada invalida')
    if abs(L)<1e-14:
        return math.log(value/M)/S
    return math.expm1(L*math.log(value/M))/(L*S)


def who_lms_inverse(z:float, L:float,M:float,S:float)->float:
    if not all(map(math.isfinite,(z,L,M,S))) or M<=0 or S<=0:
        raise ValueError('entrada invalida')
    if abs(L)<1e-14:
        return M*math.exp(S*z)
    q=1+L*S*z
    if q<=0:
        raise ValueError('fora do dominio LMS')
    return M*q**(1/L)


def who_z_with_tail(value:float,L:float,M:float,S:float)->float:
    base=who_lms_z(value,L,M,S)
    if base>3:
        p3=who_lms_inverse(3,L,M,S)
        p2=who_lms_inverse(2,L,M,S)
        return 3+(value-p3)/(p3-p2)
    if base< -3:
        m3=who_lms_inverse(-3,L,M,S)
        m2=who_lms_inverse(-2,L,M,S)
        return -3+(value-m3)/(m2-m3)
    return base


def who2007_interpolate(months:float, anchors:list[dict])->tuple[float,float,float]:
    """Apenas entre âncoras adjacentes PRESENTES; não inventa 60/229/121."""
    rows=sorted((float(r['mes']),float(r['L']),float(r['M']),float(r['S'])) for r in anchors)
    if not rows or months<rows[0][0] or months>rows[-1][0]:
        raise ValueError('mes nao coberto por ancoras')
    for v in rows:
        if months==v[0]:return v[1:]
    for a,b in zip(rows,rows[1:]):
        if a[0]<months<b[0]:
            if b[0]-a[0]!=1:
                raise ValueError('ancoras mensais nao adjacentes')
            t=months-a[0]
            return tuple((1-t)*a[i]+t*b[i] for i in (1,2,3))
    raise ValueError('mes sem intervalo')


def route_who_bmi(days:int)->str:
    if not isinstance(days,int) or days<0:raise ValueError('dias civis invalidos')
    return 'OMS2006' if days<=1856 else 'OMS2007'


def sisvan_imc_class(z:float, faixa:str)->str:
    if not math.isfinite(z) or faixa not in ('young','older'):
        raise ValueError('classificacao sem contexto')
    if z< -3:return 'magreza_acentuada'
    if z< -2:return 'magreza'
    if z<=1:return 'eutrofia'
    if faixa=='young':
        if z<=2:return 'risco_sobrepeso'
        if z<=3:return 'sobrepeso'
        return 'obesidade'
    if z<=2:return 'sobrepeso'
    if z<=3:return 'obesidade'
    return 'obesidade_grave'


def _ig_mu_sigma(pma_days:int,sex:str,measure:str)->tuple[float,float]:
    if not isinstance(pma_days,int) or not 189<=pma_days<=448:
        raise ValueError('PMA fora do dominio OctaClin REV9 [189,448]')
    if sex not in ('male','female') or measure not in ('weight','length'):
        raise ValueError('sexo/indicador invalidos')
    w=pma_days/7
    s=1 if sex=='male' else 0
    if measure=='weight':
        mu=2.591277-0.01155*math.sqrt(w)-2201.705/(w*w)+0.0911639*s
        sigma=0.1470258+505.92394/(w*w)-140.0576*math.log(w)/(w*w)
    else:
        mu=4.136244-547.0018/(w*w)+0.0026066*w+0.0314961*s
        sigma=0.050489+310.44761/(w*w)-90.0742*math.log(w)/(w*w)
    if sigma<=0:raise ValueError('sigma nao positivo')
    return mu,sigma


def intergrowth_z(value:float,pma_days:int,sex:str,measure:str)->float:
    if not math.isfinite(value) or value<=0:raise ValueError('medida invalida')
    mu,sigma=_ig_mu_sigma(pma_days,sex,measure)
    return (math.log(value)-mu)/sigma


def intergrowth_inverse(z:float,pma_days:int,sex:str,measure:str)->float:
    if not math.isfinite(z):raise ValueError('z invalido')
    mu,sigma=_ig_mu_sigma(pma_days,sex,measure)
    return math.exp(mu+sigma*z)


def intergrowth_centile(z:float)->float:
    if not math.isfinite(z):raise ValueError('z invalido')
    return 50*math.erfc(-z/math.sqrt(2))


def sisvan_wfa_class(z:float)->str:
    if not math.isfinite(z):raise ValueError('z invalido')
    if z< -3:return 'muito_baixo_peso'
    if z< -2:return 'baixo_peso'
    if z<=2:return 'peso_adequado'
    return 'peso_elevado'


def sisvan_hfa_class(z:float)->str:
    if not math.isfinite(z):raise ValueError('z invalido')
    if z< -3:return 'muito_baixa_estatura'
    if z< -2:return 'baixa_estatura'
    return 'estatura_adequada'


def who_flag(z:float,measure:str)->bool:
    """Política REV9 sobre valores Z não arredondados; não diagnóstico."""
    if not math.isfinite(z):raise ValueError('z invalido')
    lo,hi={'height':(-6,6),'weight':(-6,5),'bmi':(-5,5),'wfl':(-5,5)}[measure]
    return z<lo or z>hi
