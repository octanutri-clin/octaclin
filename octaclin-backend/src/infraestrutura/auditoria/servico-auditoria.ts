import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../banco-dados/executor-tenant';
import { redigirMetadadosAuditoria } from './redacao-auditoria';
import { UserActionLogOrm } from './user-action-log.orm';

export interface RegistrarAuditoriaEntrada {
  tenantId: string;
  usuarioId?: string;
  acao: string;
  recursoTipo?: string;
  recursoId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadados?: Record<string, unknown>;
}

/** Escrita que participa de uma transacao ja aberta; ver {@link registrarAuditoriaNaTransacao}. */
export interface RegistrarAuditoriaNaTransacaoEntrada {
  tenantId: string;
  usuarioId?: string;
  acao: string;
  recursoTipo?: string;
  recursoId?: string;
  metadados?: Record<string, unknown>;
}

/**
 * Falhas de gravacao acumuladas desde o boot deste processo.
 *
 * Vive no modulo, e nao na instancia, por uma razao concreta: `ServicoAuditoria`
 * esta em `providers` de 15 modulos Nest, e o container cria uma instancia por
 * modulo que o declara. Um campo de instancia daria 15 contadores independentes,
 * e o alarme da fase 3 -- que le este numero -- observaria a fatia de um deles.
 * Uma queda geral de gravacao apareceria como um quinze avos dela, ou seja,
 * abaixo de qualquer limiar util. O contador precisa ter o mesmo escopo do
 * processo que o alarme monitora.
 *
 * A trilha nao pode derrubar a acao de negocio -- registrar o acesso nao pode
 * impedir o atendimento --, entao o `catch` abaixo continua engolindo o erro de
 * proposito. O que estava errado era o efeito colateral disso: com o log em
 * `warn` e nada mais, a trilha podia parar de gravar por horas sem que nenhum
 * alarme tocasse, e a ausencia de registro e indistinguivel da ausencia de
 * acesso -- justamente a evidencia que a auditoria existe para produzir.
 *
 * Monotonico por contrato: reseta so no restart e nunca decrementa, para que o
 * alarme possa trabalhar com delta por janela.
 */
let totalFalhasProcesso = 0;

/** Total monotonico de falhas de gravacao da trilha neste processo. Ver {@link totalFalhasProcesso}. */
export function obterTotalFalhasAuditoria(): number {
  return totalFalhasProcesso;
}

/**
 * Zera o contador. Existe para o teste, nao para producao: o valor e monotonico
 * por contrato e nenhum caminho de aplicacao deve chama-la. Sem ela, casos que
 * compartilham o mesmo processo Jest passariam a depender da ordem de execucao
 * uns dos outros -- exatamente o acoplamento que o contador global introduz e
 * que precisa ficar visivel, em vez de escondido atras de uma instancia nova.
 */
export function zerarTotalFalhasAuditoriaParaTeste(): void {
  totalFalhasProcesso = 0;
}

/**
 * Grava uma linha da trilha reusando a transacao que o chamador ja abriu.
 *
 * Existe porque quatro escritas em `planos-alimentares` nao podem passar por
 * `ServicoAuditoria.registrar`: elas rodam dentro de um
 * `ExecutorTenant.executar` em curso, e `registrar` abre um
 * `fonteDados.transaction` proprio. Rotea-las pelo servico significaria pedir
 * uma segunda conexao do pool enquanto a primeira segura `pessimistic_write`
 * sobre o plano e sobre a versao -- risco de auto-deadlock sob pressao de pool
 * -- e, pior, quebraria a atomicidade: a linha de auditoria comitaria
 * independentemente do negocio, deixando registro de publicacao para uma
 * publicacao que rolou de volta.
 *
 * Entao a escrita direta permanece, e a redacao vem junto dela: esta funcao e o
 * segundo caminho de escrita da trilha, e nao uma excecao sem filtro. Os dois
 * caminhos existentes -- este e `ServicoAuditoria.registrar` -- passam pela
 * mesma `redigirMetadadosAuditoria`, e o gate `pnpm test:redacao-auditoria`
 * confere as chaves dos call sites dos dois.
 *
 * Diferenca deliberada em relacao a `registrar`: aqui o erro **propaga**. A
 * escrita faz parte da transacao de negocio; engolir a falha produziria uma
 * publicacao comitada sem trilha, que e o resultado que a auditoria existe para
 * tornar impossivel. Em `registrar` a trilha e um efeito colateral e engolir e
 * o certo; aqui ela e parte do fato registrado.
 */
export async function registrarAuditoriaNaTransacao(
  gerenciador: EntityManager,
  entrada: RegistrarAuditoriaNaTransacaoEntrada
): Promise<void> {
  const repositorio = gerenciador.getRepository(UserActionLogOrm);
  await repositorio.save(
    repositorio.create({
      tenantId: entrada.tenantId,
      usuarioId: entrada.usuarioId,
      acao: entrada.acao,
      recursoTipo: entrada.recursoTipo,
      recursoId: entrada.recursoId,
      metadados: redigirMetadadosAuditoria(entrada.metadados)
    })
  );
}

/**
 * Caminho de escrita da trilha `user_action_logs` para quem ainda nao esta
 * dentro de uma transacao -- 101 call sites, todos os controladores.
 *
 * Nao e o *unico* caminho, e a versao anterior deste comentario afirmava que
 * era. Quatro escritas em `planos-alimentares` gravam direto pelo
 * `EntityManager` da transacao em curso; elas usam
 * {@link registrarAuditoriaNaTransacao}, pelas razoes documentadas la. O que e
 * verdade, e o que importa, e que **os dois caminhos aplicam a mesma redacao** e
 * que nao existe um terceiro -- o gate de cobertura reprova o CI se aparecer um
 * `getRepository(UserActionLogOrm).save` fora destes dois pontos.
 */
@Injectable()
export class ServicoAuditoria {
  private readonly logger = new Logger(ServicoAuditoria.name);

  constructor(private readonly executorTenant: ExecutorTenant) {}

  /** Total monotonico de falhas de gravacao da trilha neste processo. Ver {@link totalFalhasProcesso}. */
  obterTotalFalhas(): number {
    return obterTotalFalhasAuditoria();
  }

  async registrar(entrada: RegistrarAuditoriaEntrada): Promise<void> {
    try {
      await this.executorTenant.executar(entrada.tenantId, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(UserActionLogOrm);
        await repositorio.save(
          repositorio.create({
            tenantId: entrada.tenantId,
            usuarioId: entrada.usuarioId,
            acao: entrada.acao,
            recursoTipo: entrada.recursoTipo,
            recursoId: entrada.recursoId,
            ip: entrada.ip,
            userAgent: entrada.userAgent,
            // A redacao vem depois da fusao com `requestId` de proposito: o
            // filtro vale para tudo que chega a coluna, inclusive o que este
            // servico acrescenta. `requestId` sobrevive porque e identificador
            // opaco de correlacao -- ver a excecao em `redacao-auditoria.ts`.
            metadados: redigirMetadadosAuditoria({
              ...(entrada.metadados ?? {}),
              ...(entrada.requestId ? { requestId: entrada.requestId } : {})
            })
          })
        );
      });
    } catch (erro) {
      totalFalhasProcesso += 1;
      // So o nome da classe do erro entra no log. A mensagem de um erro de
      // banco carrega SQL, valor de parametro e as vezes host ou credencial --
      // seria vazar pelo log de falha exatamente o que a redacao acabou de
      // tirar da trilha.
      this.logger.warn({
        evento: 'auditoria.falha',
        tenantId: entrada.tenantId,
        usuarioId: entrada.usuarioId,
        acao: entrada.acao,
        requestId: entrada.requestId,
        erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido',
        totalFalhas: totalFalhasProcesso
      });
    }
  }
}
