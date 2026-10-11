"""Testes de referência sintéticos, sem dados pessoais/sem runtime OctaClin."""
from __future__ import annotations
import csv
import json
import math
import pathlib
import unittest
from g01_engine_rev11 import (
    who_lms_z, who_lms_inverse, who_z_with_tail, who2007_interpolate,
    intergrowth_z, intergrowth_inverse, intergrowth_centile,
    sisvan_imc_class, sisvan_wfa_class, sisvan_hfa_class, who_flag, route_who_bmi
)
ROOT = pathlib.Path(__file__).parent

class ReferenceValidation(unittest.TestCase):
    def test_who2006_gold_from_separate_anthro_execution(self):
        with (ROOT/'WHO2006_AMOSTRA_GOLD_RCPCH.csv').open() as fh:
            rows=list(csv.DictReader(fh))
        self.assertEqual(len(rows),48)
        checks=0
        for r in rows:
            L,M,S=[float(r[k]) for k in ('L','M','S')]
            for z, col in [(-2,'valor_z_menos2'),(0,'valor_z_zero'),(2,'valor_z_mais2')]:
                val=float(r[col]); actual=who_lms_z(val,L,M,S)
                self.assertAlmostEqual(actual,z,delta=0.00005,msg=f'{r} z={z}')
                self.assertAlmostEqual(who_lms_inverse(z,L,M,S),val,delta=0.000002,msg=f'{r} z={z}')
                checks+=1
        self.assertEqual(checks,144)

    def test_12_who_anthro_directly_published_examples(self):
        """WHO anthro README: four synthetic records x BFA/HFA/WFA."""
        with (ROOT/'WHO2006_EXEMPLOS_DOCUMENTADOS_ANTHRO.csv').open() as f:
            rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),4)
        for r in rows:
            kg,cm=float(r['peso_kg']),float(r['estatura_cm'])
            bfa=who_z_with_tail(kg/(cm/100)**2,*[float(r['bmi_'+x]) for x in 'LMS'])
            hfa=who_z_with_tail(cm,*[float(r['hfa_'+x]) for x in 'LMS'])
            wfa=who_z_with_tail(kg,*[float(r['wfa_'+x]) for x in 'LMS'])
            for actual,col in ((bfa,'z_bmi_publ'),(hfa,'z_hfa_publ'),(wfa,'z_wfa_publ')):
                self.assertAlmostEqual(actual,float(r[col]),delta=0.005, msg=(r,actual,col))

    def test_48_who_first_party_coefficients_match_gold_source(self):
        """Compara OMS/anthro oficial vs WHO LMS da derivação RCPCH."""
        with (ROOT/'WHO2006_AMOSTRA_GOLD_RCPCH.csv').open() as f:
            derived=list(csv.DictReader(f))
        with (ROOT/'WHO2006_48_COEFICIENTES_OFICIAIS_ANTHRO.csv').open() as f:
            official=list(csv.DictReader(f))
        d={(r['sex'],r['indicador'],int(r['dia'])):r for r in derived}
        self.assertEqual(len(official),48)
        for r in official:
            other=d[(r['sex'],r['indicador'],int(r['dia']))]
            for key in 'LMS':
                self.assertEqual(float(r[key]),float(other[key]),(r,key))

    def test_who2007_published_11yo_bmi_tail(self):
        L,M,S=-1.7862,16.9392,0.11070
        self.assertAlmostEqual(who_lms_z(30,L,M,S),3.2353902101095855,places=10)
        self.assertAlmostEqual(who_z_with_tail(30,L,M,S),3.35390255606726,places=10)
        self.assertEqual(sisvan_imc_class(3.35390255606726, 'older'), 'obesidade_grave')

    def test_2007_anchors_interpolation_not_clamping(self):
        with (ROOT/'WHO2007_AMOSTRA_LMS_RCPCH.csv').open() as f:
            a=[r for r in csv.DictReader(f) if r['sex']=='m' and r['indicador']=='bmi' and int(r['mes']) in (61,62)]
        result=who2007_interpolate(61.5,a)
        self.assertAlmostEqual(result[0],(-.7387-.7621)/2,places=9)
        self.assertAlmostEqual(result[1],(15.2641+15.2616)/2,places=9)
        self.assertAlmostEqual(result[2],(.0839+.08414)/2,places=9)
        with self.assertRaises(ValueError):who2007_interpolate(60.8,a)
        with self.assertRaises(ValueError):who2007_interpolate(62.1,a)

    def test_who_bmi_policy_boundary_1856_1857(self):
        self.assertEqual(route_who_bmi(1856),'OMS2006')
        self.assertEqual(route_who_bmi(1857),'OMS2007')
        with self.assertRaises(ValueError):route_who_bmi(-1)

    def test_sisvan_cut_points(self):
        self.assertEqual(sisvan_imc_class(-3,'young'),'magreza')
        self.assertEqual(sisvan_imc_class(-2,'young'),'eutrofia')
        self.assertEqual(sisvan_imc_class(1,'young'),'eutrofia')
        self.assertEqual(sisvan_imc_class(2,'young'),'risco_sobrepeso')
        self.assertEqual(sisvan_imc_class(3,'young'),'sobrepeso')
        self.assertEqual(sisvan_imc_class(3+1e-8,'young'),'obesidade')
        self.assertEqual(sisvan_imc_class(1,'older'),'eutrofia')
        self.assertEqual(sisvan_imc_class(2,'older'),'sobrepeso')
        self.assertEqual(sisvan_imc_class(3,'older'),'obesidade')

    def test_sisvan_other_indicators_and_flags(self):
        self.assertEqual(sisvan_wfa_class(-3),'baixo_peso')
        self.assertEqual(sisvan_wfa_class(-2),'peso_adequado')
        self.assertEqual(sisvan_wfa_class(2),'peso_adequado')
        self.assertEqual(sisvan_wfa_class(2+1e-9),'peso_elevado')
        self.assertEqual(sisvan_hfa_class(-3),'baixa_estatura')
        self.assertEqual(sisvan_hfa_class(-2),'estatura_adequada')
        self.assertTrue(who_flag(-6.00001,'height'))
        self.assertFalse(who_flag(-6,'height'))
        self.assertFalse(who_flag(6,'height'))
        self.assertTrue(who_flag(6.00001,'height'))
        self.assertFalse(who_flag(5,'weight'))
        self.assertTrue(who_flag(5.00001,'weight'))
        self.assertFalse(who_flag(5,'bmi'))
        self.assertTrue(who_flag(5.00001,'bmi'))

    def test_wfh_four_direct_official_WHO_anthro_outputs(self):
        """OMS 'anthro' README: quatro casos WFH, incluindo caudas -5/+4."""
        fixtures={('m',120,18):-2.39,('f',80,15):4.13,('m',100,10):-5.19,('m',100,15):-0.29}
        with (ROOT/'WHO2006_WFH_WFL_AMOSTRA_OFICIAL.csv').open() as f:
            rows=list(csv.DictReader(f))
        rows={(r['sexo'],int(r['cm'])):r for r in rows if r['tipo']=='WFH'}
        for (sex,cm,kg),expected in fixtures.items():
            r=rows[(sex,cm)]
            actual=who_z_with_tail(kg,*[float(r[x]) for x in 'LMS'])
            self.assertAlmostEqual(actual,expected,delta=.005)

    def test_first_party_wfl_wfh_median_and_boundaries(self):
        with (ROOT/'WHO2006_WFH_WFL_AMOSTRA_OFICIAL.csv').open() as f:
            rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),20)
        for r in rows:
            L,M,S=[float(r[x]) for x in 'LMS']
            self.assertAlmostEqual(who_z_with_tail(M,L,M,S),0,delta=1e-12)
            self.assertAlmostEqual(who_lms_inverse(2,L,M,S),
                                   who_lms_inverse(who_z_with_tail(who_lms_inverse(2,L,M,S),L,M,S),L,M,S),delta=1e-10)

    def test_ig_agrees_with_previous_synthetic_fixture_not_independent(self):
        d=json.loads((ROOT/'FASE_314_FIXTURES_SINTETICAS_REV8.json').read_text())
        self.assertEqual(len(d['ig_candidate_cases']),7)
        n=0
        for r in d['ig_candidate_cases']:
            pma=r['pma_weeks']*7+r['pma_days']
            for typ,unit,key,cp in [('weight','weight_kg','z_weight','centile_weight'),('length','length_cm','z_length','centile_length')]:
                z=intergrowth_z(float(r[unit]),pma,r['sex'],typ)
                self.assertAlmostEqual(z,r[key],delta=1e-10)
                self.assertAlmostEqual(intergrowth_centile(z),r[cp],delta=1e-10)
                n+=2
        self.assertEqual(n,28)

    def test_ig_all_days_sexes_two_measures_and_seven_z_levels(self):
        n=0
        for day in range(27*7,64*7+1):
            for sex in ('male','female'):
                for typ in ('weight','length'):
                    for z in (-4,-3,-2,0,1,2,4):
                        y=intergrowth_inverse(z,day,sex,typ)
                        self.assertTrue(math.isfinite(y) and y>0)
                        self.assertAlmostEqual(intergrowth_z(y,day,sex,typ),z,delta=1e-11)
                        n+=1
        self.assertEqual(n,7280)
        with self.assertRaises(ValueError):intergrowth_z(1,188,'male','weight')
        with self.assertRaises(ValueError):intergrowth_z(1,449,'male','weight')
        with self.assertRaises(ValueError):intergrowth_z(0,280,'male','weight')

    def test_ig_55week_discrepancy_is_not_hidden(self):
        y=intergrowth_inverse(-3,55*7,'male','weight')
        self.assertAlmostEqual(y,4.405026478034957,delta=1e-10)
        self.assertGreater(abs(y-4.40),.005)
        self.assertAlmostEqual(intergrowth_z(4.40,55*7,'male','weight'),-3.00886892191424,places=10)

if __name__=='__main__':unittest.main()
