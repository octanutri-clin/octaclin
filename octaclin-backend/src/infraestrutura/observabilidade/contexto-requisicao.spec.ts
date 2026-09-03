import { obterContextoCorrelacao, obterRequestId, obterRotaSegura } from './contexto-requisicao';

describe('contexto-requisicao', () => {
  it('deve preservar request id recebido de forma sanitizada', () => {
    expect(obterRequestId({ 'x-request-id': ' req-123_ABC:/bad value ' })).toBe('req-123_ABC:/badvalue');
  });

  it('deve gerar request id quando nao houver cabecalho de correlacao', () => {
    const requestId = obterRequestId({});

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
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
