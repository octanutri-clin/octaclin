import {
  ACAO_AUTORIZACAO_NEGADA,
  registrarAutorizacaoNegada,
  reiniciarJanelaAutorizacaoNegada
} from './auditoria-autorizacao';

/**
 * O modulo e dominio puro com estado de processo, no mesmo formato de
 * `menor-privilegio-providers.ts`: sem Nest, sem I/O, relogio recebido por
 * parametro. Testa-lo so pelas duas guardas deixaria sem prova justamente o que
 * nao aparece pela porta delas -- teto de chaves, poda, ordem de eviction e o
 * que acontece quando a trilha nao aceita a escrita.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const USUARIO = '22222222-2222-4222-8222-222222222222';
const AGORA = Date.parse('2026-09-01T10:00:00.000Z');

/** Precisam espelhar as constantes do modulo; nenhuma das duas e exportada. */
const MAXIMO_CHAVES_MONITORADAS = 2_000;
const ALVO_APOS_PODA = 1_800;

const JANELA_MS = 60_000;

interface OpcoesContexto {
  tenantId?: string;
  usuarioId?: string;
  metodo?: string;
  rota?: string;
  params?: Record<string, unknown>;
  semUsuario?: boolean;
  cabecalhosProibidos?: boolean;
}

function criarContexto(opcoes: OpcoesContexto = {}) {
  class ControladorFicticio {}
  function abrir() {}

  const requisicao: Record<string, unknown> = {
    method: opcoes.metodo ?? 'GET',
    baseUrl: '',
    // Template da rota, que e o que o Express expoe e o que
    // `obterRotaSegura` prefere -- por isso o alvo concreto precisa vir de
    // `params`.
    route: { path: opcoes.rota ?? '/pacientes/:id/prontuario' },
    params: opcoes.params ?? {},
    requestId: 'req-1',
    usuarioAutenticado: opcoes.semUsuario
      ? undefined
      : {
          tenantId: opcoes.tenantId ?? TENANT,
          usuarioId: opcoes.usuarioId ?? USUARIO,
          papel: 'Collaborator',
          emailHash: 'hash',
          permissoes: []
        }
  };

  if (opcoes.cabecalhosProibidos) {
    Object.defineProperty(requisicao, 'headers', {
      get() {
        throw new Error('cabecalhos nao devem ser lidos no caminho da negativa');
      }
    });
  } else {
    requisicao.headers = {};
  }

  return {
    getHandler: () => abrir,
    getClass: () => ControladorFicticio,
    switchToHttp: () => ({ getRequest: () => requisicao })
  } as never;
}

type ModoTrilha = 'sucesso' | 'rejeita' | 'lanca' | 'pendente';

function criarAuditoria(modo: ModoTrilha = 'sucesso') {
  let liberar: (() => void) | undefined;

  const registrar = jest.fn(() => {
    if (modo === 'lanca') throw new Error('trilha indisponivel');
    if (modo === 'rejeita') return Promise.reject(new Error('trilha indisponivel'));
    if (modo === 'pendente') return new Promise<void>((resolve) => (liberar = resolve));
    return Promise.resolve(undefined);
  });

  return { registrar, concluirPendente: () => liberar?.() };
}

const PAPEL_EXIGIDO = { tipo: 'papel', exigido: ['SuperAdmin'] } as const;

/** UUID deterministico e distinto por indice, para gerar cardinalidade em massa. */
function uuidDoIndice(indice: number): string {
  return `00000000-0000-4000-8000-${String(indice).padStart(12, '0')}`;
}

/** Drena os microtasks para que `then`/`catch` da escrita ja tenham rodado. */
const drenar = () => Promise.resolve().then(() => undefined);

describe('registrarAutorizacaoNegada', () => {
  beforeEach(() => {
    reiniciarJanelaAutorizacaoNegada();
  });

  describe('identidade do evento', () => {
    it('grava o UUID do parametro de rota como recursoId', async () => {
      const auditoria = criarAuditoria();

      registrarAutorizacaoNegada(
        auditoria as never,
        criarContexto({ params: { id: uuidDoIndice(7) } }),
        PAPEL_EXIGIDO,
        AGORA
      );
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: ACAO_AUTORIZACAO_NEGADA,
          recursoTipo: 'autorizacao',
          recursoId: uuidDoIndice(7)
        })
      );
    });

    // O achado que motivou a mudanca: a chave usava o *template* da rota, entao
    // sondar 500 pacientes distintos rendia uma unica linha por minuto -- e
    // enumeracao e exatamente o que auditar o 403 existe para detectar.
    it('nao colapsa recursos distintos da mesma rota na mesma janela', async () => {
      const auditoria = criarAuditoria();

      for (let indice = 0; indice < 50; indice += 1) {
        registrarAutorizacaoNegada(
          auditoria as never,
          criarContexto({ params: { id: uuidDoIndice(indice) } }),
          PAPEL_EXIGIDO,
          AGORA
        );
      }
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledTimes(50);
    });

    it('continua colapsando a repeticao do mesmo recurso', async () => {
      const auditoria = criarAuditoria();

      for (let tentativa = 0; tentativa < 50; tentativa += 1) {
        registrarAutorizacaoNegada(
          auditoria as never,
          criarContexto({ params: { id: uuidDoIndice(1) } }),
          PAPEL_EXIGIDO,
          AGORA
        );
        await drenar();
      }

      expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    });

    it('usa o parametro mais especifico da rota como recursoId', async () => {
      const auditoria = criarAuditoria();

      registrarAutorizacaoNegada(
        auditoria as never,
        criarContexto({
          rota: '/pacientes/:pacienteId/materiais/:id',
          params: { pacienteId: uuidDoIndice(1), id: uuidDoIndice(2) }
        }),
        PAPEL_EXIGIDO,
        AGORA
      );
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ recursoId: uuidDoIndice(2) })
      );
    });

    it('deixa recursoId vazio quando a rota nao tem parametro', async () => {
      const auditoria = criarAuditoria();

      registrarAutorizacaoNegada(auditoria as never, criarContexto({ rota: '/operacoes/logs' }), PAPEL_EXIGIDO, AGORA);
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ recursoId: undefined, metadados: expect.not.objectContaining({ alvoOpaco: true }) })
      );
    });

    // A coluna `recurso_id` e `uuid` no Postgres, e as guardas rodam antes dos
    // pipes: um slug gravado ali derrubaria o `INSERT` e a linha inteira se
    // perderia. Alem disso o valor e texto escolhido por quem ataca.
    it('nao grava parametro que nao e UUID, nem em recursoId nem em metadados', async () => {
      const auditoria = criarAuditoria();
      const protocoloForjado = "2026-000123' or 1=1--";

      registrarAutorizacaoNegada(
        auditoria as never,
        criarContexto({ rota: '/operacoes/protocolos/:protocolo', params: { protocolo: protocoloForjado } }),
        PAPEL_EXIGIDO,
        AGORA
      );
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          recursoId: undefined,
          metadados: expect.objectContaining({ alvoOpaco: true })
        })
      );
      expect(JSON.stringify(auditoria.registrar.mock.calls)).not.toContain(protocoloForjado);
    });

    it('ainda distingue alvos que nao sao UUID, para nao perder a enumeracao', async () => {
      const auditoria = criarAuditoria();

      for (const protocolo of ['2026-000001', '2026-000002', '2026-000003', '2026-000001']) {
        registrarAutorizacaoNegada(
          auditoria as never,
          criarContexto({ rota: '/operacoes/protocolos/:protocolo', params: { protocolo } }),
          PAPEL_EXIGIDO,
          AGORA
        );
        await drenar();
      }

      // Tres alvos distintos, e a repeticao do primeiro colapsada.
      expect(auditoria.registrar).toHaveBeenCalledTimes(3);
    });

    it('nao registra quando a requisicao chega sem tenant', () => {
      const auditoria = criarAuditoria();

      registrarAutorizacaoNegada(auditoria as never, criarContexto({ semUsuario: true }), PAPEL_EXIGIDO, AGORA);

      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('janela de deduplicacao', () => {
    it('volta a gravar quando a janela expira, e nao antes', async () => {
      const auditoria = criarAuditoria();
      const contexto = () => criarContexto({ params: { id: uuidDoIndice(1) } });

      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA);
      await drenar();
      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA + JANELA_MS - 1);
      await drenar();
      expect(auditoria.registrar).toHaveBeenCalledTimes(1);

      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA + JANELA_MS);
      await drenar();
      expect(auditoria.registrar).toHaveBeenCalledTimes(2);
    });

    it('nao varre cabecalhos nem gera requestId no caminho da negativa', async () => {
      const auditoria = criarAuditoria();

      // O getter de `headers` lanca: se `obterContextoCorrelacao` voltasse ao
      // caminho, a negativa deixaria de ser registrada. `randomUUID` viaja
      // junto dela, e o `requestId` gerado seria descartado de qualquer forma.
      registrarAutorizacaoNegada(
        auditoria as never,
        criarContexto({ cabecalhosProibidos: true, params: { id: uuidDoIndice(1) } }),
        PAPEL_EXIGIDO,
        AGORA
      );
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-1' }));
    });
  });

  describe('janela sob falha da trilha', () => {
    // A promessa deste modulo e "o pior caso e gravar de novo -- nunca deixar
    // de gravar uma negativa distinta". Marcar a chave antes de saber se a
    // escrita deu certo invertia isso: uma falha silenciava a chave por 60 s.
    it('nao consome a janela quando a escrita rejeita', async () => {
      const auditoria = criarAuditoria('rejeita');
      const contexto = () => criarContexto({ params: { id: uuidDoIndice(1) } });

      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA);
      await drenar();
      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA + 1);
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledTimes(2);
    });

    it('nao consome a janela quando a escrita lanca de forma sincrona', () => {
      const auditoria = criarAuditoria('lanca');
      const contexto = () => criarContexto({ params: { id: uuidDoIndice(1) } });

      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA);
      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA + 1);

      expect(auditoria.registrar).toHaveBeenCalledTimes(2);
    });

    // A reserva provisoria existe so para isto: conter a rajada que chega
    // enquanto a primeira escrita ainda nao respondeu.
    it('contem a rajada concorrente enquanto a escrita esta em voo', async () => {
      const auditoria = criarAuditoria('pendente');
      const contexto = () => criarContexto({ params: { id: uuidDoIndice(1) } });

      for (let tentativa = 0; tentativa < 10; tentativa += 1) {
        registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA);
      }
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledTimes(1);

      auditoria.concluirPendente();
      await drenar();
      registrarAutorizacaoNegada(auditoria as never, contexto(), PAPEL_EXIGIDO, AGORA + 1);
      await drenar();

      // Confirmada, a janela passa a valer de verdade.
      expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    });
  });

  describe('teto de chaves', () => {
    const negar = (auditoria: { registrar: jest.Mock }, indice: number, agora = AGORA) =>
      registrarAutorizacaoNegada(
        auditoria as never,
        criarContexto({ params: { id: uuidDoIndice(indice) } }),
        PAPEL_EXIGIDO,
        agora
      );

    const encherAteOTeto = async (auditoria: { registrar: jest.Mock }) => {
      for (let indice = 0; indice < MAXIMO_CHAVES_MONITORADAS; indice += 1) negar(auditoria, indice);
      await drenar();
      expect(auditoria.registrar).toHaveBeenCalledTimes(MAXIMO_CHAVES_MONITORADAS);
    };

    // Poda amortizada: liberar um lote (10% do teto) faz a varredura O(n)
    // acontecer a cada ~200 insercoes em vez de uma vez por requisicao.
    it('libera um lote de chaves de uma vez, e nao apenas a mais antiga', async () => {
      const auditoria = criarAuditoria();
      await encherAteOTeto(auditoria);

      negar(auditoria, MAXIMO_CHAVES_MONITORADAS);
      await drenar();
      const aposTranspor = auditoria.registrar.mock.calls.length;

      const evictadas = MAXIMO_CHAVES_MONITORADAS - ALVO_APOS_PODA;
      // A ultima chave do lote evictado volta a gravar; a primeira que
      // sobreviveu continua suprimida.
      negar(auditoria, evictadas - 1);
      negar(auditoria, evictadas);
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledTimes(aposTranspor + 1);
    });

    it('descarta por idade antes de descartar por ordem de uso', async () => {
      const auditoria = criarAuditoria();
      await encherAteOTeto(auditoria);

      // Uma janela inteira depois, todas as chaves anteriores expiraram: a poda
      // por idade sozinha ja libera o mapa.
      negar(auditoria, MAXIMO_CHAVES_MONITORADAS, AGORA + JANELA_MS);
      await drenar();
      negar(auditoria, 0, AGORA + JANELA_MS);
      await drenar();

      expect(auditoria.registrar).toHaveBeenCalledTimes(MAXIMO_CHAVES_MONITORADAS + 2);
    });

    // `Map.set` em chave existente nao reordena. Sem o `delete` antes, a
    // eviction seria FIFO e descartaria primeiro as chaves mais persistentes --
    // exatamente as que a dedup deveria continuar suprimindo.
    it('evicta por uso, mantendo viva a chave que continua sendo negada', async () => {
      const auditoria = criarAuditoria();
      await encherAteOTeto(auditoria);

      // A chave mais antiga volta a ser usada e passa a ser a mais recente.
      negar(auditoria, 0);
      await drenar();
      expect(auditoria.registrar).toHaveBeenCalledTimes(MAXIMO_CHAVES_MONITORADAS);

      // Transpor o teto dispara a poda, que agora evicta a partir da chave 1.
      negar(auditoria, MAXIMO_CHAVES_MONITORADAS);
      await drenar();

      negar(auditoria, 0);
      await drenar();
      // Sobreviveu: nenhuma escrita nova.
      expect(auditoria.registrar).toHaveBeenCalledTimes(MAXIMO_CHAVES_MONITORADAS + 1);

      negar(auditoria, 1);
      await drenar();
      // Foi evictada: grava de novo.
      expect(auditoria.registrar).toHaveBeenCalledTimes(MAXIMO_CHAVES_MONITORADAS + 2);
    });
  });
});
