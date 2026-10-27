import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { numeroEdicao, validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { converterEdicaoParaRascunho, PrecondicaoEdicaoPlanoDto, SalvarEdicaoPlanoDto } from './dtos-edicao-plano';

const id = '10000000-0000-4000-8000-000000000001';
const documento = () => ({ schemaVersao: 1, objetivos: '', refeicoes: [{ chaveCliente: 'r1', itens: [{ chaveCliente: 'i1', descricao: '', porcaoGramas: '', substituicoes: [] }] }] });
const entrada = () => ({ rascunhoIdEsperado: id, rascunhoRevisaoEsperada: 0, documento: documento() });
const erros = (v: unknown) => validate(plainToInstance(SalvarEdicaoPlanoDto, v), { whitelist: true, forbidNonWhitelisted: true });

describe('PA06 DTO de edição parcial', () => {
  it('não materializa bloco vazio de micros de catálogo, mas preserva tentativa real para rejeição', () => {
    const criar = (micros: Record<string, string | number>) => validarDocumentoEdicaoPlano({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', alimentoComposicaoId: id, micronutrientesPor100g: micros, substituicoes: [{ chaveCliente: 's', alimentoComposicaoId: id, micronutrientesPor100g: micros }] }] }] });
    const vazio = converterEdicaoParaRascunho(criar({}), { id }).refeicoes[0].itens[0];
    expect(vazio.micronutrientesPor100g).toBeUndefined();
    expect(vazio.substituicoes?.[0].micronutrientesPor100g).toBeUndefined();
    const override = converterEdicaoParaRascunho(criar({ ferroMg: 1 }), { id }).refeicoes[0].itens[0];
    expect(override.micronutrientesPor100g).toEqual({ ferroMg: 1 });
  });
  it('preserva micros editoriais e materializa somente valores preenchidos', () => {
    const d = validarDocumentoEdicaoPlano({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', micronutrientesPor100g: { ferroMg: '1,2', calcioMg: 0, vitaminaCMg: '' } }] }] });
    expect(d.refeicoes[0].itens[0]).toHaveProperty('micronutrientesPor100g.ferroMg', '1,2');
    const item = converterEdicaoParaRascunho(d, { id }).refeicoes[0].itens[0];
    expect(item).toHaveProperty('micronutrientesPor100g', { ferroMg: 1.2, calcioMg: 0 });
    expect(() => validarDocumentoEdicaoPlano({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', micronutrientesPor100g: { invalido: 1 } }] }] })).toThrow();
    const pendente = validarDocumentoEdicaoPlano({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', micronutrientesPor100g: { ferroMg: '-' } }] }] });
    expect(converterEdicaoParaRascunho(pendente, { id }).refeicoes[0].itens[0]).toHaveProperty('micronutrientesPor100g.ferroMg', NaN);
  });
  it('aceita incompletude editorial sem validar como prescrição clínica', async () => {
    expect(await erros(entrada())).toHaveLength(0);
  });
  it('aceita referências fechadas de cópia e rejeita IDs/identidades manipulados ou extras', async () => {
    const copia={pacienteOrigemId:id,planoOrigemId:id,versaoIdOrigem:id,numeroVersaoOrigem:1,rascunhoRevisaoOrigemEsperada:0,itemChaveOrigem:'item-origem',alternativaChaveOrigem:'alternativa-origem',itemChaveDestino:'item-destino',alternativaChaveDestino:'alternativa-destino'};
    expect(await erros({...entrada(),copiasEquivalencia:[copia]})).toHaveLength(0);
    expect((await erros({...entrada(),copiasEquivalencia:[{...copia,tenantId:id}]})).length).toBeGreaterThan(0);
    expect((await erros({...entrada(),copiasEquivalencia:[{...copia,pacienteOrigemId:'invalido'}]})).length).toBeGreaterThan(0);
    expect((await erros({...entrada(),copiasEquivalencia:Array(201).fill(copia)})).length).toBeGreaterThan(0);
  });
  it('limita o envelope inteiro de salvamento quando as referências excedem o orçamento do documento', async () => {
    const copia={pacienteOrigemId:id,planoOrigemId:id,numeroVersaoOrigem:1,itemChaveOrigem:'i'.repeat(100),alternativaChaveOrigem:'a'.repeat(100),itemChaveDestino:'d'.repeat(100),alternativaChaveDestino:'b'.repeat(100)};
    const itens=Array.from({length:100},(_,i)=>({chaveCliente:`item-${i}`,descricao:'a'.repeat(200),substituicoes:[]}));
    const pedido={...entrada(),documento:{schemaVersao:1,refeicoes:[{chaveCliente:'r1',itens},{chaveCliente:'r2',itens:itens.map((item,i)=>({...item,chaveCliente:`item-b-${i}`}))}]},copiasEquivalencia:Array(100).fill(copia)};
    expect((await erros(pedido)).length).toBeGreaterThan(0);
  });
  it.each([{}, { ...entrada(), tenantId: id }, { ...entrada(), rascunhoIdEsperado: 'x' },
    { ...entrada(), rascunhoRevisaoEsperada: '0' }, { ...entrada(), rascunhoRevisaoEsperada: -1 },
    { ...entrada(), rascunhoRevisaoEsperada: 2147483647 }, { ...entrada(), documento: null },
    { ...entrada(), documento: { ...documento(), schemaVersao: 2 } },
    { ...entrada(), documento: { ...documento(), preferenciasApresentacao: { interno: true } } }
  ])('rejeita envelope/versão/extras sem expor conteúdo no erro (%#)', async v => {
    expect((await erros(v)).length).toBeGreaterThan(0);
  });
  it('precondição de transição aceita legado vazio, mas não metade da identidade', async () => {
    const validar = (v: unknown) => validate(plainToInstance(PrecondicaoEdicaoPlanoDto, v), { whitelist: true, forbidNonWhitelisted: true });
    expect(await validar({})).toHaveLength(0);
    expect(await validar({ rascunhoIdEsperado: id, rascunhoRevisaoEsperada: 0 })).toHaveLength(0);
    expect((await validar({ rascunhoIdEsperado: id })).length).toBeGreaterThan(0);
    expect((await validar({ rascunhoRevisaoEsperada: 0 })).length).toBeGreaterThan(0);
  });
  it('copia documento sem alias e preserva zero factual versus vazio', () => {
    const original = documento();
    const copia = validarDocumentoEdicaoPlano(original);
    original.refeicoes[0].itens[0].descricao = 'alterado depois';
    expect(copia.refeicoes[0].itens[0].descricao).toBe('');
    expect(numeroEdicao(0)).toBe(0);
    expect(numeroEdicao('')).toBeUndefined();
    expect(numeroEdicao('-')).toBeUndefined();
    expect(numeroEdicao('1,25')).toBe(1.25);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, {}, '1e99', 'texto', 1_000_000_001])('recusa valor numérico sem representação editorial segura (%#)', v => {
    const d = documento();
    expect(() => validarDocumentoEdicaoPlano({ ...d, fatorAtividade: v })).toThrow('Documento de edição do plano inválido.');
  });
  it('recusa payload excessivo e metadado clínico não permitido dentro de alimento', () => {
    expect(() => validarDocumentoEdicaoPlano({ ...documento(), observacoes: 'x'.repeat(9000) })).toThrow();
    expect(() => validarDocumentoEdicaoPlano({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', nutrientesPor100g: { interno: 1 } }] }] })).toThrow();
    expect(() => validarDocumentoEdicaoPlano({ schemaVersao: 1, refeicoes: [], constructor: 'inválido' })).toThrow();
  });
  it('converte contexto manual g/kg sem aplicar fórmula ou distribuição preservadas na edição', () => {
    const d = validarDocumentoEdicaoPlano({ ...documento(), possuiCondicaoEspecial: true,
      metodoMacrosManual: 'gramas_por_kg', proteinasGPorKg: '0.6',
      formula: 'mifflin_st_jeor_1990', fatorAtividade: 1.4, carboidratosBasisPoints: 5000 });
    const convertido = converterEdicaoParaRascunho(d, { id });
    expect(convertido.origemMeta).toBe('manual');
    expect(convertido.macrosGramasPorKg?.proteinasGPorKg).toBe(0.6);
    expect(convertido.formula).toBeUndefined();
    expect(convertido.fatorAtividade).toBeUndefined();
    expect(convertido.distribuicaoMacros).toBeUndefined();
  });
  it('preserva percentual cru e converte separadamente sem arredondar nem confiar no basis point redundante', () => {
    for (const [texto, esperado] of [['1,', 100], ['1,25', 125], ['1,234', 123.4], ['', undefined], ['-', undefined]] as const) {
      const d = validarDocumentoEdicaoPlano({ ...documento(), carboidratosBasisPoints: 9999, percentuaisMacrosEdicao: { carboidratosBasisPoints: texto } });
      expect((d as unknown as { percentuaisMacrosEdicao: { carboidratosBasisPoints: string } }).percentuaisMacrosEdicao.carboidratosBasisPoints).toBe(texto);
      expect(converterEdicaoParaRascunho(d, { id }).distribuicaoMacros?.carboidratosBasisPoints).toBe(esperado);
    }
    expect(converterEdicaoParaRascunho(validarDocumentoEdicaoPlano({ ...documento(), carboidratosBasisPoints: 5000 }), { id }).distribuicaoMacros?.carboidratosBasisPoints).toBe(5000);
    expect(() => validarDocumentoEdicaoPlano({ ...documento(), percentuaisMacrosEdicao: { desconhecido: '1' } })).toThrow();
  });
  it('limita edição a 96KiB para caber no envelope HTTP existente de 100KiB', () => {
    const d = { schemaVersao: 1, refeicoes: Array.from({ length: 50 }, (_, i) => ({ chaveCliente: `r${i}`, orientacoes: 'x'.repeat(2000), itens: [] })) };
    expect(() => validarDocumentoEdicaoPlano(d)).toThrow();
  });

});
