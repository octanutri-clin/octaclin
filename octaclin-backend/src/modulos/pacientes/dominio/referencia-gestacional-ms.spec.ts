import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { faixaGestacional, GrupoImcGestacional } from './referencia-gestacional-ms';

describe('Tabela semanal ratificada da Fase 313', () => {
  it('confere todos os 248 valores contra a ficha recebida e ratificada', () => {
    const ficha = readFileSync(resolve(process.cwd(),'../docs/product/FICHA_VALIDACAO_CLINICA_FASE_313.md'),'utf8');
    const linhas = [...ficha.matchAll(/^\| (\d+) \| (\[[^\n]+)$/gm)].filter(m => Number(m[1]) >= 10 && Number(m[1]) <= 40);
    expect(linhas).toHaveLength(31);
    for (const linha of linhas) {
      const faixas = [...linha[2].matchAll(/\[(-?\d+,\d+);(-?\d+,\d+)\]/g)];
      expect(faixas).toHaveLength(4);
      ['baixo_peso','eutrofia','sobrepeso','obesidade'].forEach((grupo,i) => {
        expect(faixaGestacional(Number(linha[1]),grupo as GrupoImcGestacional)).toEqual({ minimo: Number(faixas[i][1].replace(',','.')),maximo: Number(faixas[i][2].replace(',','.')) });
      });
    }
  });
  it('nao deriva valores por interpolacao ou fora da tabela', () => {
    expect(faixaGestacional(9,'eutrofia')).toBeUndefined();
    expect(faixaGestacional(41,'eutrofia')).toBeUndefined();
    expect(faixaGestacional(13.5,'obesidade')).toBeUndefined();
  });
});
