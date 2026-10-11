"""Gera evidências auditáveis a partir dos dados sintéticos fixados neste pacote."""
import csv, json, pathlib, math, hashlib, sys, subprocess, datetime
from g01_engine_rev11 import who_lms_z, who_lms_inverse, who_z_with_tail, who2007_interpolate, intergrowth_z, intergrowth_inverse, intergrowth_centile, sisvan_imc_class
ROOT=pathlib.Path(__file__).resolve().parent
OLD=ROOT/'FASE_314_FIXTURES_SINTETICAS_REV8.json'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    lines=[]
    with (ROOT/'WHO2006_AMOSTRA_GOLD_RCPCH.csv').open() as f: data=list(csv.DictReader(f))
    for r in data:
        L,M,S=map(float,[r['L'],r['M'],r['S']])
        for target,key in [(-2,'valor_z_menos2'),(0,'valor_z_zero'),(2,'valor_z_mais2')]:
            val=float(r[key]);calc=who_lms_z(val,L,M,S)
            lines.append({'sexo':r['sex'],'indicador':r['indicador'],'dia':int(r['dia']),
                          'valor':val,'z_esperado_anthro':target,'z_obtido_motor_pesquisa':calc,
                          'erro_z':calc-target,'origem':'WHO anthro_measurements gold via RCPCH; LMS WHO via RCPCH'})
    out=ROOT/'OMS2006_144_COMPARACOES.csv'
    with out.open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=lines[0].keys());w.writeheader();w.writerows(lines)
    expected=json.loads(OLD.read_text())['ig_candidate_cases']
    ig=[]
    for r in expected:
        pma=7*r['pma_weeks']+r['pma_days']
        for typ,unit,key in [('weight','weight_kg','z_weight'),('length','length_cm','z_length')]:
            z=intergrowth_z(r[unit],pma,r['sex'],typ)
            ig.append({'pma_dias':pma,'sexo':r['sex'],'indicador':typ,'medida':r[unit],
                       'z_fixture_anterior':r[key],'z_calculado_rev11':z,
                       'erro_z':z-r[key], 'tipo_prova':'consistencia interna; nao e oraculo independente'})
    out=ROOT/'INTERGROWTH_14_COMPARACOES_INTERNAS.csv'
    with out.open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=ig[0].keys());w.writeheader();w.writerows(ig)
    with (ROOT/'WHO2006_48_COEFICIENTES_OFICIAIS_ANTHRO.csv').open() as f:
        official_lms=list(csv.DictReader(f))
    der={(r['sex'],r['indicador'],r['dia']):r for r in data}
    matches=[all(float(r[k])==float(der[(r['sex'],r['indicador'],r['dia'])][k]) for k in ('L','M','S')) for r in official_lms]
    with (ROOT/'WHO2006_EXEMPLOS_DOCUMENTADOS_ANTHRO.csv').open() as f:
        direct_examples=list(csv.DictReader(f))
    official_cases=[]
    for r in direct_examples:
        kg,cm=float(r['peso_kg']),float(r['estatura_cm'])
        for measurement,val,prefix,expected in [('bmi',kg/(cm/100)**2,'bmi','z_bmi_publ'),('height',cm,'hfa','z_hfa_publ'),('weight',kg,'wfa','z_wfa_publ')]:
            z=who_z_with_tail(val,*[float(r[prefix+'_'+v]) for v in ('L','M','S')])
            official_cases.append({'sexo':r['sexo'],'dia':int(r['dia']),'indicador':measurement,'valor':val,'z_esperado_arredondado_WHO':float(r[expected]),'z_obtido_rev11':z,'erro_z':z-float(r[expected])})
    with (ROOT/'OMS2006_12_COMPARACOES_DIRETAS_WHO.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=official_cases[0].keys());w.writeheader();w.writerows(official_cases)
    with (ROOT/'WHO2006_WFH_WFL_AMOSTRA_OFICIAL.csv').open() as f:
        wfh_rows=list(csv.DictReader(f))
    direct_wfh=[]
    for sx,cm,kg,z_expected in [('m',120,18,-2.39),('f',80,15,4.13),('m',100,10,-5.19),('m',100,15,-0.29)]:
        r=next(r for r in wfh_rows if r['tipo']=='WFH' and r['sexo']==sx and int(r['cm'])==cm)
        actual=who_z_with_tail(kg,*[float(r[v]) for v in 'LMS'])
        direct_wfh.append({'sexo':sx,'estatura_cm':cm,'peso_kg':kg,'z_esperado_pacote_WHO':z_expected,'z_calculado_rev11':actual,'erro_z':actual-z_expected})
    with (ROOT/'OMS2006_4_WFH_COMPARACOES_OFICIAIS.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=direct_wfh[0].keys());w.writeheader();w.writerows(direct_wfh)
    with (ROOT/'WHO2007_AMOSTRA_LMS_RCPCH.csv').open() as f:
        anchors=list(csv.DictReader(f))
    bmi=[r for r in anchors if r['sex']=='m' and r['indicador']=='bmi' and int(r['mes']) in (61,62)]
    z_1856=who_lms_z(15.2,-0.7235,15.184,.0874)
    interpolated=who2007_interpolate(1857/30.4375,bmi)
    z_1857=who_lms_z(15.2,*interpolated)
    test=subprocess.run([sys.executable,'-m','unittest','-v','test_g01_rev11.py'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    (ROOT/'execucao_unittest.txt').write_text(test.stdout)
    summary={
        'schema':'octaclin-fase314-g01-rev11-research-only',
        'run_date_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'no_patient_data':True,
        'independent_source':'RCPCH who_under2_gold_192.csv generated WHO anthro_measurements; subset for BMI, length/height and weight; original data of 0-731 days',
        'source_commit_rcpch':'d70093121c073997e352976398264bc3301f0c8d',
        'source_url_gold':'https://github.com/rcpch/rcpchgrowth-python/blob/d70093121c073997e352976398264bc3301f0c8d/rcpchgrowth/tests/who_test_data/who_under2_gold_192.csv',
        'source_url_who_lms':'https://github.com/rcpch/rcpchgrowth-python/tree/d70093121c073997e352976398264bc3301f0c8d/rcpchgrowth/data_tables/who',
        'who2006_first_party_coefficients_match_RCPCH':{'n_triples':len(matches),'pass':len(matches)==48 and all(matches),'source':'WHO/anthro first-party TXT vs RCPCH daily LMS; checked by unittest'},
        'who2006_gold':{'num_sex':2,'num_indicators':3,'num_day_points':8,'n_comparisons':len(lines),'max_abs_error_z':max(abs(x['erro_z']) for x in lines),'mean_abs_error_z':sum(abs(x['erro_z']) for x in lines)/len(lines),'PASS_if_delta_less_equal':0.00005,'pass':all(abs(x['erro_z'])<=0.00005 for x in lines)},
        'who2006_12_WHO_official_publication':{'count':len(official_cases),'max_abs_error_z':max(abs(c['erro_z']) for c in official_cases),'tolerance_rounding_2_decimals':0.005,'pass':all(abs(c['erro_z'])<=0.005 for c in official_cases)},
        'who2006_4_WFH_WHO_official':{'count':len(direct_wfh),'max_abs_error_z':max(abs(c['erro_z']) for c in direct_wfh),'tolerance_rounding_2_decimals':.005,'pass':all(abs(c['erro_z'])<=.005 for c in direct_wfh)},
        'who2007':{'published_sample_11yo_boy_bmi30_z_tail':who_z_with_tail(30,-1.7862,16.9392,.1107),'source_anchor_132_months_present':True,'anchors_integral_unverified':True},
        'who_1856_1857':{'local_routing_1856':'OMS2006','local_routing_1857':'OMS2007','comparison_same_bmi_15_2_male':{'z_1856':z_1856,'z_1857':z_1857,'difference':z_1857-z_1856},'methodological_note':'transition is a local policy; source references differ, not numerical continuity'},
        'intergrowth':{'cases_previous_fixture':len(expected),'component_z_comparisons':len(ig),'max_abs_error_z':max(abs(x['erro_z']) for x in ig),'daily_points':(448-189+1),'sexes':2,'indicators':2,'seven_z_values':7,'internal_roundtrip_checks':(448-189+1)*2*2*7,'is_independent_oxford_comparison':False,'pma_domain_days':[189,448], 'weight_55weeks_pdf_quantile_difference_kg':intergrowth_inverse(-3,385,'male','weight')-4.40},
        'unittest':{'command':'python -m unittest -v test_g01_rev11.py','returncode':test.returncode,'tests_total':13,'PASS':test.returncode==0},
        'G01_status':'PARTIAL_NOT_PASS',
        'licensing_verification':'NOT_PERFORMED',
        'octaclin_runtime_verified':False,
        'full_16_WHO_files_downloaded_and_verified':False,
        'original_oxford_28_outputs_replayed':False,
    }
    tracked=['WHO2006_AMOSTRA_GOLD_RCPCH.csv','WHO2006_48_COEFICIENTES_OFICIAIS_ANTHRO.csv','WHO2006_EXEMPLOS_DOCUMENTADOS_ANTHRO.csv','WHO2006_WFH_WFL_AMOSTRA_OFICIAL.csv','OMS2006_4_WFH_COMPARACOES_OFICIAIS.csv','WHO2007_AMOSTRA_LMS_RCPCH.csv','OMS2006_12_COMPARACOES_DIRETAS_WHO.csv','OMS2006_144_COMPARACOES.csv','INTERGROWTH_14_COMPARACOES_INTERNAS.csv','g01_engine_rev11.py','test_g01_rev11.py','execucao_unittest.txt']
    summary['local_artifact_sha256']={p:sha(ROOT/p) for p in tracked}
    (ROOT/'resultado_resumo_G01_REV11.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({key:summary[key] for key in ['who2006_gold','who2007','who_1856_1857','intergrowth','unittest','G01_status']},indent=2,ensure_ascii=False))
    if test.returncode:raise SystemExit(test.returncode)
if __name__=='__main__':main()
