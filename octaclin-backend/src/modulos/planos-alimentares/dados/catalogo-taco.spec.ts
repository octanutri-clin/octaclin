import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CatalogoTaco } from './importador-taco';
import {
  normalizarNutriente,
  serializarCatalogoTaco,
  validarIdentidadeCatalogoTaco
} from './importador-taco';

const caminhoCatalogo = join(__dirname, 'catalogo-taco-4a.json');

function carregar(): { texto: string; catalogo: CatalogoTaco } {
  const texto = readFileSync(caminhoCatalogo, 'utf8');
  return { texto, catalogo: JSON.parse(texto) as CatalogoTaco };
}

describe('catalogo TACO 4a edicao', () => {
  it('preserva NA/ausente como null e converte Tr em zero', () => {
    expect(normalizarNutriente('NA', 1)).toBeNull();
    expect(normalizarNutriente('', 1)).toBeNull();
    expect(normalizarNutriente('Tr', 1)).toBe(0);
    expect(normalizarNutriente('*', 1)).toBe('invalido');
  });

  it('tem origem fixa, contagem esperada e conteudo canonico', () => {
    const { texto, catalogo } = carregar();
    expect(catalogo.metadados.arquivoOrigem.sha256).toBe(
      'a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14'
    );
    expect(catalogo.metadados.contagem).toEqual({
      linhasPlanilha: 696,
      linhasNaoAlimento: 99,
      alimentosCandidatos: 597,
      alimentosValidos: 583,
      alimentosExcluidos: 14,
      exclusoesPorMotivo: { valor_nutricional_em_reavaliacao_ou_invalido: 14 }
    });
    expect(catalogo.metadados.exclusoes).toHaveLength(14);
    expect(catalogo.metadados.exclusoes.every((item) => item.motivo === 'valor_nutricional_em_reavaliacao_ou_invalido')).toBe(true);
    expect(texto.replace(/\r\n/g, '\n')).toBe(serializarCatalogoTaco(catalogo));
  });

  it('mantem alimentos ordenados, unicos e nutrientes validos', () => {
    const { catalogo } = carregar();
    const codigos = catalogo.alimentos.map((alimento) => alimento.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(codigos).toEqual([...codigos].sort((a, b) => a - b));
    expect(codigos).not.toContain(591);
    expect(new Set(catalogo.alimentos.map((alimento) => alimento.categoria)).size).toBe(15);
    expect(catalogo.alimentos.some((alimento) => alimento.categoria === 'Número do')).toBe(false);

    for (const alimento of catalogo.alimentos) {
      expect(alimento.descricao.trim()).not.toBe('');
      expect(alimento.categoria.trim()).not.toBe('');
      for (const valor of [
        alimento.energiaKcal,
        alimento.proteinaG,
        alimento.lipideosG,
        alimento.carboidratoG,
        alimento.fibraG,
        alimento.sodioMg
      ]) {
        expect(valor === null || (Number.isFinite(valor) && valor >= 0)).toBe(true);
      }
    }

    expect(createHash('sha256').update(JSON.stringify(catalogo.alimentos)).digest('hex')).toBe(
      catalogo.metadados.sha256Alimentos
    );
  });

  it('recalcula a identidade transformada e rejeita catalogo normalizado adulterado', () => {
    const { catalogo } = carregar();
    expect(validarIdentidadeCatalogoTaco(catalogo)).toEqual({
      versaoArtefato: 'taco-4a-cmvcol-taco3-v1',
      sha256Alimentos: catalogo.metadados.sha256Alimentos
    });

    const adulterado = structuredClone(catalogo);
    adulterado.alimentos[0].energiaKcal = 999;
    expect(() => validarIdentidadeCatalogoTaco(adulterado)).toThrow('hash dos alimentos normalizados nao confere');
  });

  it('preserva exemplos conhecidos da planilha oficial', () => {
    const { catalogo } = carregar();
    expect(catalogo.alimentos.find((alimento) => alimento.codigo === 1)).toEqual({
      codigo: 1,
      descricao: 'Arroz, integral, cozido',
      categoria: 'Cereais e derivados',
      energiaKcal: 124,
      proteinaG: 2.6,
      lipideosG: 1,
      carboidratoG: 25.8,
      fibraG: 2.7,
      sodioMg: 1
    });
    expect(catalogo.alimentos.at(-1)?.codigo).toBe(597);
  });
});
