import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { validarPedidoPreferenciasEquivalencia, validarPreferenciasEquivalencia, PREFERENCIAS_EQUIVALENCIA_PADRAO } from '../dominio/preferencias-equivalencia';
@Injectable()
export class ServicoPreferenciasEquivalencia {
  constructor(private readonly executor: ExecutorTenant) {}
  private permitir(u: UsuarioAutenticado, escrever = false) {
    if (u.papel !== 'Professional' || !u.permissoes.includes(escrever ? 'planos_alimentares.gerenciar' : 'planos_alimentares.ler')) throw new ForbiddenException('Preferências indisponíveis para este acesso.');
  }
  private async proprio(g: EntityManager, u: UsuarioAutenticado) {
    const p = await g.getRepository(ProfissionalOrm).findOne({ where: { tenantId: u.tenantId, usuarioId: u.usuarioId, arquivadoEm: IsNull() } });
    if (!p) throw new ForbiddenException('Vínculo profissional indisponível.');
    return p;
  }
  private resposta(p: ProfissionalOrm) {
    try { return { preferencias: validarPreferenciasEquivalencia(p.preferenciasEquivalencia ?? PREFERENCIAS_EQUIVALENCIA_PADRAO), revisao: p.preferenciasEquivalenciaRevisao ?? 0 }; }
    catch { throw new ServiceUnavailableException('Preferências indisponíveis.'); }
  }
  async obter(u: UsuarioAutenticado) {
    this.permitir(u);
    return this.executor.executar(u.tenantId, async g => this.resposta(await this.proprio(g, u)));
  }
  async salvar(u: UsuarioAutenticado, entrada: unknown) {
    this.permitir(u, true);
    let pedido: ReturnType<typeof validarPedidoPreferenciasEquivalencia>;
    try { pedido = validarPedidoPreferenciasEquivalencia(entrada); }
    catch { throw new BadRequestException('Preferências inválidas.'); }
    return this.executor.executar(u.tenantId, async g => {
      const p = await this.proprio(g, u);
      if ((p.preferenciasEquivalenciaRevisao ?? 0) !== pedido.revisaoEsperada || pedido.revisaoEsperada >= 2147483647) throw new ConflictException('As preferências mudaram. Reabra a configuração.');
      const revisao = pedido.revisaoEsperada + 1;
      const resultado = await g.getRepository(ProfissionalOrm).update({ id: p.id, tenantId: u.tenantId, usuarioId: u.usuarioId, arquivadoEm: IsNull(), preferenciasEquivalenciaRevisao: pedido.revisaoEsperada },
        { preferenciasEquivalencia: pedido.preferencias, preferenciasEquivalenciaRevisao: revisao });
      if (resultado.affected !== 1) throw new ConflictException('As preferências mudaram. Reabra a configuração.');
      return { preferencias: pedido.preferencias, revisao };
    });
  }
}
