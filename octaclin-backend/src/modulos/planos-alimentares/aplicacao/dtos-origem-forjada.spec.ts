import { BadRequestException } from '@nestjs/common';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { SubstituicaoPlanoAlimentarDto } from './dtos';

/**
 * FOOD06 M01 (revisão de segurança de C2): a procedência de um item é decidida no servidor. O corpo
 * HTTP não pode trazer `origem`, `fonte` nem o snapshot de composição para se passar por base oficial.
 */
describe('origem de composição não é aceita do cliente', () => {
  const pipe = criarPipeValidacaoHttp();
  const validar = (corpo: unknown) => pipe.transform(corpo, { type: 'body', metatype: SubstituicaoPlanoAlimentarDto });
  const base = { descricao: 'Item sintético', quantidade: 1, unidade: 'g', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 5, carboidratosG: 10, gordurasG: 2 } };

  it('o item manual válido continua aceito', async () => {
    await expect(Promise.resolve(validar(base))).resolves.toBeDefined();
  });
  it.each([
    ['origem catalogo', { origem: 'catalogo' }],
    ['fonte oficial forjada', { fonte: { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3', versao: '1' } }],
    ['snapshot de composição', { composicaoSnapshot: { origem: 'catalogo', fonte: { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3' } } }],
    ['micronutrientes já resolvidos', { micronutrientes: { schemaVersao: 1 } }],
    ['codigoOrigem', { codigoOrigem: 'ALIMENTO-1' }]
  ])('recusa %s no corpo do item', async (_nome, extra) => {
    const campo = Object.keys(extra)[0]!;
    const erro = await Promise.resolve().then(() => validar({ ...base, ...extra })).then(() => undefined, (e: unknown) => e);
    expect(erro).toBeInstanceOf(BadRequestException);
    // A recusa é pelo campo extra, não por outro defeito do item.
    expect(JSON.stringify((erro as BadRequestException).getResponse())).toContain(`property ${campo} should not exist`);
  });
});
