import { Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { NotificacaoOrm, TipoNotificacao } from '../infraestrutura/notificacao.orm';

const LIMITE_PADRAO = 20;

export interface ItemNotificacao {
  id: string;
  tipo: TipoNotificacao;
  pacienteId?: string | null;
  pacienteNome?: string;
  recursoTipo: string;
  recursoId: string;
  lidoEm?: Date | null;
  criadoEm: Date;
}

export interface CentralNotificacoes {
  naoLidas: number;
  itens: ItemNotificacao[];
}

/**
 * Toda consulta filtra por `usuarioId` vindo do JWT, nunca por id de requisicao:
 * o isolamento entre usuarios (e entre profissionais) e a propria clausula, nao
 * uma verificacao a parte que alguem pode esquecer de chamar.
 */
@Injectable()
export class ServicoNotificacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listar(usuario: UsuarioAutenticado, limite = LIMITE_PADRAO): Promise<CentralNotificacoes> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(NotificacaoOrm);
      const escopoDoUsuario = { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId };

      const [notificacoes, naoLidas] = await Promise.all([
        repositorio.find({
          where: escopoDoUsuario,
          order: { criadoEm: 'DESC' },
          take: limite
        }),
        repositorio.count({ where: { ...escopoDoUsuario, lidoEm: IsNull() } })
      ]);

      const nomes = await this.nomesDosPacientes(gerenciador, usuario.tenantId, notificacoes);

      return {
        naoLidas,
        itens: notificacoes.map((notificacao) => ({
          id: notificacao.id,
          tipo: notificacao.tipo,
          pacienteId: notificacao.pacienteId,
          ...(notificacao.pacienteId && nomes.has(notificacao.pacienteId)
            ? { pacienteNome: nomes.get(notificacao.pacienteId) }
            : {}),
          recursoTipo: notificacao.recursoTipo,
          recursoId: notificacao.recursoId,
          lidoEm: notificacao.lidoEm,
          criadoEm: notificacao.criadoEm
        }))
      };
    });
  }

  async marcarLidas(usuario: UsuarioAutenticado, ids?: string[]): Promise<{ marcadas: number }> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(NotificacaoOrm).update(
        {
          tenantId: usuario.tenantId,
          usuarioId: usuario.usuarioId,
          lidoEm: IsNull(),
          ...(ids?.length ? { id: In(ids) } : {})
        },
        { lidoEm: new Date() }
      );

      return { marcadas: resultado.affected ?? 0 };
    });
  }

  /**
   * O nome sai do cadastro na leitura, sob o escopo de quem le. A tabela de
   * notificacoes guarda so o id, entao ela nao vira uma segunda copia em claro
   * do nome do paciente.
   */
  private async nomesDosPacientes(
    gerenciador: EntityManager,
    tenantId: string,
    notificacoes: NotificacaoOrm[]
  ): Promise<Map<string, string>> {
    const ids = [...new Set(notificacoes.map((notificacao) => notificacao.pacienteId).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return new Map();

    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      select: { id: true, nomeCriptografado: true },
      where: { tenantId, id: In(ids) }
    });

    return new Map(pacientes.map((paciente) => [paciente.id, this.criptografia.descriptografar(paciente.nomeCriptografado)]));
  }
}
