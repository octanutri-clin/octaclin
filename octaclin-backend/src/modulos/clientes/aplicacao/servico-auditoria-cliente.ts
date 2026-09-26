import { Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { validarFiltrosAuditoriaCliente } from './filtros-auditoria-cliente.dto';

interface LinhaAuditoriaCliente {
  usuarioId: string | null;
  acao: string;
  recursoTipo: string | null;
  criadoEm: Date;
}

@Injectable()
export class ServicoAuditoriaCliente {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listar(tenantId: string, entrada: object = {}) {
    const filtros = validarFiltrosAuditoriaCliente(entrada);
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 25;
    const parametros: unknown[] = [tenantId];
    const condicoes = ['a.tenant_id = $1'];
    const adicionar = (condicao: string, valor: unknown) => {
      parametros.push(valor);
      condicoes.push(`${condicao} $${parametros.length}`);
    };
    if (filtros.usuarioId) adicionar('u.id =', filtros.usuarioId);
    if (filtros.acao) adicionar('a.acao =', filtros.acao);
    if (filtros.recursoTipo) adicionar('a.recurso_tipo =', filtros.recursoTipo);
    if (filtros.inicio) adicionar('a.criado_em >=', new Date(`${filtros.inicio}T00:00:00Z`));
    if (filtros.fim) adicionar('a.criado_em <', new Date(new Date(`${filtros.fim}T00:00:00Z`).getTime() + 86400000));
    parametros.push(limite + 1, (pagina - 1) * limite);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      // Nunca selecionar a entidade inteira: IP, metadados e recurso_id ficam no servidor.
      // O join impede expor a identidade de um operador externo ao tenant.
      const linhas: LinhaAuditoriaCliente[] = await gerenciador.query(`
        SELECT u.id AS "usuarioId", a.acao, a.recurso_tipo AS "recursoTipo", a.criado_em AS "criadoEm"
        FROM user_action_logs a
        LEFT JOIN usuarios u ON u.id = a.usuario_id AND u.tenant_id = a.tenant_id
        WHERE ${condicoes.join(' AND ')}
        ORDER BY a.criado_em DESC, a.id DESC
        LIMIT $${parametros.length - 1} OFFSET $${parametros.length}
      `, parametros);
      return {
        itens: linhas.slice(0, limite).map((linha) => ({
          usuarioId: linha.usuarioId, acao: linha.acao,
          recursoTipo: linha.recursoTipo, criadoEm: linha.criadoEm.toISOString()
        })),
        pagina, limite, temMais: linhas.length > limite
      };
    });
  }
}
