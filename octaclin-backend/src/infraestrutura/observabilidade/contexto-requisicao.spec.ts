import { randomUUID } from 'crypto';
import { obterContextoCorrelacao, obterRequestId, obterRotaSegura } from './contexto-requisicao';

describe('contexto-requisicao', () => {
  it('deve preservar request id recebido de forma sanitizada', () => {
    expect(obterRequestId({ 'x-request-id': ' req-123_ABC:/bad value ' })).toBe('req-123_ABC:/badvalue');
  });

  it('deve gerar request id quando nao houver cabecalho de correlacao', () => {
    const requestId = obterRequestId({});

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  /**
   * Contrato com o BFF, e nao mais um detalhe interno da sanitizacao.
   *
   * `octaclin-web/lib/server/correlacao-bff.ts` emite `crypto.randomUUID()` e
   * SOBRESCREVE `x-request-id` a cada requisicao; a correlacao entre o log do
   * BFF e a linha de `user_action_logs` so fecha porque o backend devolve
   * exatamente a mesma string. Apertar o alfabeto de `sanitizarRequestId`
   * (hoje `[a-zA-Z0-9._:/-]`, que aceita hexadecimal e hifen) ou baixar o teto
   * de 128 caracteres abaixo dos 36 do UUID truncaria o id **em silencio**:
   * nada quebra, os dois lados passam a registrar strings diferentes e a
   * correlacao morre so em producao.
   *
   * O teste vive aqui de proposito. O spec do lado web redigita a regex a mao
   * em vez de importar esta funcao, entao ele continuaria verde depois do
   * aperto -- e este seria o unico lugar em que o drift reprova. O UUID e
   * gerado de verdade, e nao um literal, para a assercao valer para o formato
   * inteiro e nao para um sorteio especifico.
   */
  it('deve devolver intacto o uuid que o BFF emite em x-request-id', () => {
    const emitidoPeloBff = randomUUID();

    expect(obterRequestId({ 'x-request-id': emitidoPeloBff })).toBe(emitidoPeloBff);
  });

  it('deve montar contexto sem query string nem dados pessoais do usuario', () => {
    const contexto = obterContextoCorrelacao({
      headers: { 'x-request-id': 'req-456' },
      method: 'GET',
      originalUrl: '/pacientes?email=ana@example.com',
      usuarioAutenticado: {
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        papel: 'Professional',
        emailHash: 'hash-sensivel',
        permissoes: ['pacientes.ler']
      }
    });

    expect(contexto).toEqual({
      requestId: 'req-456',
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      metodo: 'GET',
      rota: '/pacientes'
    });
    expect(JSON.stringify(contexto)).not.toContain('ana@example.com');
    expect(JSON.stringify(contexto)).not.toContain('hash-sensivel');
  });

  it('deve preferir o template Express para nao registrar identificadores concretos', () => {
    expect(
      obterContextoCorrelacao({
        method: 'GET',
        originalUrl: '/pacientes/31109579-f13e-49c0-b7f6-614306d46a0e',
        route: { path: '/pacientes/:id' }
      }).rota
    ).toBe('/pacientes/:id');
  });
});

/**
 * A rota deixou de ser detalhe interno de `obterContextoCorrelacao` e virou
 * superficie exportada (PR 52, fase 1b): o caminho da negativa de autorizacao
 * precisa de rota sem pagar o resto da correlacao. Como agora ha um segundo
 * consumidor, as garantias que ela sempre teve -- sem querystring, com teto de
 * tamanho, template antes de caminho concreto -- passam a ser testadas direto.
 */
describe('obterRotaSegura', () => {
  it('deve prefixar o ponto de montagem ao template do roteador', () => {
    expect(obterRotaSegura({ baseUrl: '/api/v1', route: { path: '/pacientes/:id' } })).toBe('/api/v1/pacientes/:id');
  });

  it('deve cair para o caminho concreto sem query string quando nao ha template', () => {
    expect(obterRotaSegura({ originalUrl: '/pacientes?email=ana@example.com' })).toBe('/pacientes');
  });

  it('deve usar url quando originalUrl nao existe', () => {
    expect(obterRotaSegura({ url: '/agenda?de=2026-09-01' })).toBe('/agenda');
  });

  it('deve ignorar template vazio ou que nao e string', () => {
    expect(obterRotaSegura({ route: { path: '' }, originalUrl: '/relatorios' })).toBe('/relatorios');
    expect(obterRotaSegura({ route: { path: 42 }, originalUrl: '/relatorios' })).toBe('/relatorios');
  });

  // O caminho concreto e escolhido por quem chama, e ele vai parar na chave de
  // deduplicacao da negativa e nos metadados da trilha: sem teto, uma URL
  // gigante viraria linha gigante em `user_action_logs` e chave gigante em
  // memoria do processo.
  it('deve limitar o tamanho da rota', () => {
    const rotaLonga = `/${'a'.repeat(500)}`;

    expect(obterRotaSegura({ originalUrl: rotaLonga })).toHaveLength(200);
    expect(obterRotaSegura({ baseUrl: rotaLonga, route: { path: '/x' } })).toHaveLength(200);
  });

  it('deve devolver indefinido quando a requisicao nao tem caminho algum', () => {
    expect(obterRotaSegura({})).toBeUndefined();
  });

  // O motivo de a funcao ter sido exportada: `obterContextoCorrelacao` varre
  // todos os cabecalhos e chega a chamar `randomUUID()`, custo pago por
  // requisicao rejeitada em rajada e depois descartado. Se alguem reintroduzir
  // essa leitura aqui, o getter derruba o teste.
  it('nao deve ler cabecalhos para montar a rota', () => {
    const requisicao = { route: { path: '/pacientes/:id' } };
    Object.defineProperty(requisicao, 'headers', {
      get() {
        throw new Error('cabecalhos nao devem ser lidos para obter a rota');
      }
    });

    expect(obterRotaSegura(requisicao)).toBe('/pacientes/:id');
  });
});
