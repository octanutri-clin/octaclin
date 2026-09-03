import { createHash } from 'crypto';
import type { ExecutionContext } from '@nestjs/common';
import type { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { obterRotaSegura, type RequisicaoComContexto } from '../../../infraestrutura/observabilidade/contexto-requisicao';

/**
 * Registro da negativa de autorizacao (PR 52, fase 1b).
 *
 * `GuardaPapeis` e `GuardaPermissoes` lancavam `ForbiddenException` mudas. Do
 * ponto de vista da trilha, um 403 era indistinguivel de uma requisicao que
 * nunca aconteceu -- e negativa de autorizacao e justamente o sinal que separa
 * "ninguem tentou" de "alguem tentou e foi barrado", que e o primeiro indicio
 * de credencial comprometida ou de papel concedido errado.
 *
 * Fica em modulo proprio porque as duas guardas precisam exatamente do mesmo
 * comportamento: mesma acao, mesma forma de metadados e, sobretudo, a mesma
 * janela de deduplicacao. Duas copias divergiriam, e a copia que divergisse
 * seria a que ninguem lembraria de testar.
 */

/** Acao unica das duas guardas: a triagem separa papel de permissao por `metadados.tipo`. */
export const ACAO_AUTORIZACAO_NEGADA = 'auth.autorizacao.negada';

/**
 * Contencao de amplificacao.
 *
 * Diferente do login, aqui nao existe `ServicoProtecaoAbuso` no caminho: uma
 * sessao valida pode martelar uma rota proibida em laco e cada 403 viraria uma
 * escrita em `user_action_logs`. A trilha e append-only e entra em backup, ou
 * seja, o custo nao e so de banco -- e permanente.
 *
 * A janela colapsa repeticoes da *mesma* negativa -- mesmo tenant, mesmo
 * usuario, mesma exigencia, mesma rota e **mesmo alvo concreto** -- para uma
 * escrita por minuto. Isso preserva o que a auditoria precisa provar (que
 * aquele usuario foi barrado naquele recurso, e quando) e descarta so a
 * redundancia. Uma negativa nova -- outro usuario, outra rota, outra permissao,
 * outro paciente -- nunca e engolida pela janela.
 *
 * O estado e por processo e em memoria de proposito: e uma otimizacao de
 * volume, nao um controle de seguranca. Se o processo reinicia, o pior caso e
 * gravar de novo -- nunca deixar de gravar uma negativa distinta.
 */
const JANELA_DEDUPLICACAO_MS = 60_000;

/**
 * Teto de chaves vivas. A propria chave carrega rota e alvo, que o cliente
 * influencia, entao sem teto a defesa contra amplificacao na trilha viraria
 * amplificacao de memoria no processo.
 *
 * Custo por chave depois que o alvo concreto entrou na identidade: as partes
 * de tamanho livre sao a rota (limitada a 200 caracteres por
 * `obterRotaSegura`) e ate {@link MAXIMO_PARAMETROS_NA_CHAVE} parametros, cada
 * um limitado a 36 caracteres (UUID) ou a 19 (impressao digital) -- as demais
 * partes vem de tenant, usuario e do decorator do handler. O pior caso fica em
 * torno de 700 caracteres, ou ~1,5 KB por entrada em UTF-16 com o overhead do
 * `Map`; 2.000 entradas custam ~3 MB no pior caso e menos de 1 MB no formato
 * tipico (tenant, usuario, uma permissao, rota curta, um UUID). Um teto maior
 * daria mais dedup e mais memoria; este e o ponto em que a memoria continua
 * irrelevante para o processo.
 */
const MAXIMO_CHAVES_MONITORADAS = 2_000;

/**
 * Alvo de tamanho apos uma poda.
 *
 * A poda so vale a pena se for amortizada. Reduzir para `MAXIMO - 1` faria a
 * insercao seguinte reencostar no teto, e toda requisicao subsequente pagaria
 * uma varredura O(n) -- justamente sob a rajada que a janela existe para
 * conter. Liberando 10% de uma vez, a varredura acontece a cada ~200
 * insercoes, o que da O(n/200) amortizado por requisicao.
 */
const ALVO_APOS_PODA = 1_800;

/** Teto de parametros de rota considerados. Nenhuma rota do produto usa mais que isso. */
const MAXIMO_PARAMETROS_NA_CHAVE = 4;

/** Prefixo hexadecimal da impressao digital de um parametro que nao e UUID. */
const TAMANHO_IMPRESSAO_DIGITAL = 16;

/**
 * UUID canonico. As guardas rodam **antes** dos pipes do Nest, entao
 * `ParseUUIDPipe` ainda nao validou nada quando chegamos aqui: o formato tem de
 * ser conferido neste modulo.
 */
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EntradaJanela {
  /** Instante da reserva. A expiracao conta a partir daqui, confirmada ou nao. */
  instante: number;
  /**
   * `false` enquanto a escrita esta em voo. So a confirmacao torna a supressao
   * legitima; ver {@link liberarJanela}.
   */
  confirmada: boolean;
}

const ultimaEscritaPorChave = new Map<string, EntradaJanela>();

/** Ponto de reinicio do estado de janela, para que um teste nao contamine o seguinte. */
export function reiniciarJanelaAutorizacaoNegada(): void {
  ultimaEscritaPorChave.clear();
}

function podarChavesExpiradas(agora: number): void {
  for (const [chave, entrada] of ultimaEscritaPorChave) {
    if (agora - entrada.instante >= JANELA_DEDUPLICACAO_MS) ultimaEscritaPorChave.delete(chave);
  }

  // `Map` preserva ordem de insercao e este modulo reinsere a chave a cada uso
  // (ver `dentroDaJanela`), entao a ordem e de uso e nao de criacao: o que sai
  // primeiro e a chave ha mais tempo sem 403, e nao a chave mais persistente --
  // que e exatamente a que a dedup precisa manter viva.
  //
  // Perder uma entrada de janela nao perde auditoria: a proxima negativa
  // daquela chave volta a ser gravada.
  while (ultimaEscritaPorChave.size > ALVO_APOS_PODA) {
    const maisAntiga = ultimaEscritaPorChave.keys().next();
    if (maisAntiga.done) break;
    ultimaEscritaPorChave.delete(maisAntiga.value);
  }
}

/**
 * `true` quando a negativa deve ser suprimida.
 *
 * No caminho de gravacao a chave e apenas *reservada* (`confirmada: false`).
 * Reserva provisoria existe so para conter rajada concorrente: enquanto a
 * escrita esta em voo, as repeticoes da mesma negativa nao disparam N escritas
 * simultaneas. Se a escrita falhar, `liberarJanela` desfaz a reserva -- do
 * contrario uma unica falha silenciaria aquela chave por 60 s inteiros,
 * quebrando a promessa deste modulo de nunca deixar de gravar uma negativa
 * distinta.
 */
function dentroDaJanela(chave: string, agora: number): boolean {
  const anterior = ultimaEscritaPorChave.get(chave);
  if (anterior !== undefined && agora - anterior.instante < JANELA_DEDUPLICACAO_MS) {
    // `Map.set` em chave existente nao reordena; o `delete` antes e o que
    // transforma a eviction do teto em LRU de verdade.
    ultimaEscritaPorChave.delete(chave);
    ultimaEscritaPorChave.set(chave, anterior);
    return true;
  }

  if (ultimaEscritaPorChave.size >= MAXIMO_CHAVES_MONITORADAS) podarChavesExpiradas(agora);
  ultimaEscritaPorChave.delete(chave);
  ultimaEscritaPorChave.set(chave, { instante: agora, confirmada: false });
  return false;
}

/** Promove a reserva a escrita efetiva: dai em diante a supressao e legitima. */
function confirmarJanela(chave: string, agora: number): void {
  const entrada = ultimaEscritaPorChave.get(chave);
  if (entrada?.instante === agora) entrada.confirmada = true;
}

/**
 * Desfaz a reserva de uma escrita que nao aconteceu.
 *
 * O `instante` identifica a reserva: se outra ja tomou o lugar desta, a
 * comparacao falha e nada e removido.
 */
function liberarJanela(chave: string, agora: number): void {
  const entrada = ultimaEscritaPorChave.get(chave);
  if (entrada && !entrada.confirmada && entrada.instante === agora) ultimaEscritaPorChave.delete(chave);
}

function nomeDe(valor: unknown): string | undefined {
  return typeof valor === 'function' ? valor.name || undefined : undefined;
}

/**
 * `Controlador.metodo` do alvo. E o que permite achar o handler no codigo sem
 * depender da rota, que pode ser reescrita por prefixo global ou proxy.
 */
function descreverAlvo(contexto: ExecutionContext): string | undefined {
  const partes = [nomeDe(contexto.getClass?.()), nomeDe(contexto.getHandler?.())].filter(Boolean);
  return partes.length ? partes.join('.') : undefined;
}

interface RequisicaoDeGuarda extends RequisicaoComContexto {
  /** Parametros ja extraidos pelo roteador do Express, antes de qualquer pipe. */
  params?: Record<string, unknown>;
}

interface AlvoConcreto {
  /** Componente de identidade do alvo dentro da chave de deduplicacao. */
  identidade: string;
  /** Preenchido so quando ha parametro em formato UUID; ver o bloco abaixo. */
  recursoId?: string;
  /** `true` quando algum parametro existia mas nao pode ser gravado. */
  opaco: boolean;
}

/**
 * Identifica o recurso concreto que o 403 protegeu.
 *
 * Sem isto a dedup usaria so o *template* da rota (`obterRotaSegura` prefere
 * `route.path`), e um profissional sondando `GET /pacientes/:id/prontuario`
 * contra 500 pacientes produziria uma unica linha por minuto. Nao sao a mesma
 * negativa: sao 500 recursos distintos, e colapsa-los apaga exatamente o sinal
 * de enumeracao que auditar o 403 existe para detectar.
 *
 * O parametro de rota e entrada do atacante, entao ele entra sob duas regras
 * diferentes:
 *
 * 1. **Vai para `recurso_id` so se for UUID.** A coluna e `uuid` no Postgres --
 *    um slug arbitrario faria o `INSERT` falhar e a trilha perderia a linha
 *    inteira, que e pior que perder o identificador. Alem disso um UUID e
 *    inofensivo por construcao: alfabeto fixo, 36 caracteres, nenhum texto
 *    livre. E e o formato real da maioria das rotas guardadas -- dez
 *    controladores usam `ParseUUIDPipe`.
 * 2. **O que nao e UUID vira impressao digital.** `protocolo`, `alertaId` e os
 *    poucos `@Param('id')` sem pipe aceitam texto livre; grava-lo seria deixar
 *    o atacante escolher o conteudo da trilha. O `sha256` truncado nao e
 *    reversivel, tem tamanho fixo (o que e o que torna o teto de memoria
 *    calculavel) e ainda assim distingue alvos -- a contagem de linhas
 *    distintas por minuto continua denunciando a enumeracao.
 */
function identificarAlvoConcreto(requisicao: RequisicaoDeGuarda): AlvoConcreto {
  const parametros = Object.values(requisicao?.params ?? {})
    .filter((valor): valor is string => typeof valor === 'string' && valor !== '')
    .slice(0, MAXIMO_PARAMETROS_NA_CHAVE);

  if (!parametros.length) return { identidade: '', opaco: false };

  let recursoId: string | undefined;
  let opaco = false;

  const partes = parametros.map((valor) => {
    if (PADRAO_UUID.test(valor)) {
      // O ultimo UUID da rota e o recurso mais especifico: em
      // `/pacientes/:pacienteId/materiais/:id` o alvo do 403 e o material.
      recursoId = valor;
      return valor;
    }

    opaco = true;
    return `op:${createHash('sha256').update(valor).digest('hex').slice(0, TAMANHO_IMPRESSAO_DIGITAL)}`;
  });

  return { identidade: partes.join('/'), recursoId, opaco };
}

export interface ExigenciaNegada {
  tipo: 'papel' | 'permissao';
  /**
   * Somente o que a rota exigia (ou, no caso de permissao, o subconjunto que
   * faltou). A lista completa de permissoes do portador nunca entra: ela e o
   * mapa do que aquela credencial abre, e a trilha e lida por perfis de
   * operacao que nao precisam desse mapa para triar um 403.
   */
  exigido: readonly string[];
}

/**
 * Registra a negativa sem poder alterar o desfecho HTTP.
 *
 * Duas protecoes, porque `canActivate` e sincrono e o 403 tem de sair de
 * qualquer jeito:
 *
 * 1. `try` externo -- cobre falha sincrona (contexto malformado, injecao
 *    trocada, duble de teste que lanca na hora).
 * 2. `Promise.resolve(...).catch` -- a escrita nao e aguardada. Aguardar
 *    tornaria a guarda assincrona e colocaria a latencia do banco no caminho de
 *    toda requisicao autorizada; alem disso uma rejeicao tardia viraria
 *    `unhandledRejection`. O `catch` neutraliza a rejeicao sem converte-la em
 *    nada visivel para o cliente -- e aproveita para devolver a chave a janela.
 *
 * O efeito combinado: falha de auditoria nunca transforma 403 em 500, e
 * tampouco em 200 -- o `throw` da guarda acontece depois desta chamada,
 * incondicionalmente.
 */
export function registrarAutorizacaoNegada(
  auditoria: ServicoAuditoria,
  contexto: ExecutionContext,
  exigencia: ExigenciaNegada,
  agora: number = Date.now()
): void {
  // Fora do `try` para que o `catch` possa devolver a chave a janela quando a
  // trilha lanca de forma sincrona: sem isso uma unica excecao sincrona
  // silenciaria aquela negativa pelos 60 s seguintes.
  let chaveReservada: string | undefined;

  try {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoDeGuarda>();
    const usuario = requisicao?.usuarioAutenticado;

    // As duas guardas rodam depois de `GuardaJwt`, que preenche
    // `usuarioAutenticado` com `tenantId` e `usuarioId` vindos das claims
    // validadas -- por isso ha autor e escopo para gravar. A guarda deste `if`
    // cobre o caso em que a composicao muda: sem tenant nao existe linha
    // possivel em `user_action_logs`, e forjar um destruiria o isolamento.
    if (!usuario?.tenantId) return;

    // Nada aqui varre cabecalho nem gera UUID: `obterContextoCorrelacao` faria
    // as duas coisas, e o `requestId` que ela produz e deliberadamente
    // descartado logo abaixo. Sob a rajada que a janela existe para conter,
    // esse custo seria pago por todo 403 inclusive pelos suprimidos.
    const metodo = requisicao.method;
    const rota = obterRotaSegura(requisicao);
    const alvo = descreverAlvo(contexto);
    const alvoConcreto = identificarAlvoConcreto(requisicao);
    const exigido = [...exigencia.exigido].sort().join(',');
    const chave = [
      usuario.tenantId,
      usuario.usuarioId,
      exigencia.tipo,
      exigido,
      metodo ?? '',
      rota ?? alvo ?? '',
      alvoConcreto.identidade
    ].join('|');

    if (dentroDaJanela(chave, agora)) return;
    chaveReservada = chave;

    Promise.resolve(
      auditoria.registrar({
        tenantId: usuario.tenantId,
        usuarioId: usuario.usuarioId,
        acao: ACAO_AUTORIZACAO_NEGADA,
        recursoTipo: 'autorizacao',
        recursoId: alvoConcreto.recursoId,
        // Vem do middleware de correlacao. Nunca e gerado aqui: um id inventado
        // no momento do 403 nao correlaciona com nada e so ocuparia a coluna.
        requestId: requisicao.requestId ?? requisicao.correlacao?.requestId,
        metadados: {
          tipo: exigencia.tipo,
          exigido,
          metodo,
          rota,
          alvo,
          // Declara que havia alvo concreto e que ele nao pode ser gravado, para
          // o leitor da trilha nao concluir que a rota era sem parametro.
          ...(alvoConcreto.opaco ? { alvoOpaco: true } : {})
        }
      })
    ).then(
      () => confirmarJanela(chave, agora),
      () => liberarJanela(chave, agora)
    );
  } catch {
    // Silencio deliberado: ver o bloco acima. A negativa de autorizacao vale
    // mais que o seu registro, e o `throw` da guarda vem logo em seguida.
    if (chaveReservada !== undefined) liberarJanela(chaveReservada, agora);
  }
}
