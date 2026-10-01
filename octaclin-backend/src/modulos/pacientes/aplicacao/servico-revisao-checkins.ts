import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { obterSegredoAcesso } from '../../auth/infraestrutura/configuracao-jwt';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

const DURACAO_COMPROVANTE_MS = 10 * 60 * 1000;

@Injectable()
export class ServicoRevisaoCheckins {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listarPendentes(tenantId: string, usuario: UsuarioAutenticado, pagina: number) {
    const paginaSegura = Math.max(1, Math.min(10000, Math.floor(pagina) || 1));
    const tamanho = 20;
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const consulta = gerenciador.getRepository(LogDiarioRapidoOrm).createQueryBuilder('diario')
        .innerJoin(PacienteOrm, 'paciente', 'paciente.id = diario.pacienteId AND paciente.tenantId = diario.tenantId')
        .where('diario.tenantId = :tenantId', { tenantId })
        .andWhere('diario.tipo = :tipo', { tipo: 'humor' })
        .andWhere('diario.revisadoEm IS NULL')
        .andWhere('paciente.arquivadoEm IS NULL')
        .andWhere('paciente.statusCicloVida = :ativo', { ativo: 'ACTIVE' });
      if (profissionalId) consulta.andWhere('paciente.profissionalResponsavelId = :profissionalId', { profissionalId });
      const [diarios, total] = await consulta.orderBy('diario.registradoEm', 'ASC')
        .addOrderBy('diario.id', 'ASC').skip((paginaSegura - 1) * tamanho).take(tamanho).getManyAndCount();
      const pacientes = diarios.length ? await gerenciador.getRepository(PacienteOrm).find({
        where: diarios.map((diario) => ({ id: diario.pacienteId, tenantId,
          ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) })),
        select: { id: true, nomeCriptografado: true }
      }) : [];
      const nomes = new Map(pacientes.map((paciente) => [paciente.id, this.criptografia.descriptografar(paciente.nomeCriptografado)]));
      return { pagina: paginaSegura, tamanho, total, itens: diarios.map((diario) => ({
        id: diario.id, pacienteId: diario.pacienteId,
        pacienteNome: nomes.get(diario.pacienteId) ?? 'Paciente', registradoEm: diario.registradoEm
      })) };
    });
  }

  async obterDetalhe(tenantId: string, diarioId: string, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const diario = await gerenciador.getRepository(LogDiarioRapidoOrm).findOne({ where: { id: diarioId, tenantId } });
      if (!diario || diario.tipo !== 'humor') throw new NotFoundException('Registro de hábitos não encontrado.');
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: {
        id: diario.pacienteId, tenantId, arquivadoEm: IsNull(), statusCicloVida: 'ACTIVE',
        ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {})
      } });
      if (!paciente) throw new NotFoundException('Registro de hábitos não encontrado.');
      let valor: Record<string, unknown> = {};
      try {
        valor = diario.valorCriptografado
          ? JSON.parse(this.criptografia.descriptografar(diario.valorCriptografado)) as Record<string, unknown>
          : diario.valor ?? {};
      } catch {
        throw new UnprocessableEntityException('Registro indisponível para leitura. Acione o suporte antes de confirmar a revisão.');
      }
      return {
        id: diario.id, pacienteId: paciente.id,
        pacienteNome: this.criptografia.descriptografar(paciente.nomeCriptografado),
        registradoEm: diario.registradoEm,
        humor: typeof valor.humor === 'string' ? valor.humor : undefined,
        adesaoPlano: typeof valor.adesaoPlano === 'number' ? valor.adesaoPlano : undefined,
        sintomas: typeof valor.sintomas === 'string' ? valor.sintomas : undefined,
        observacoes: typeof valor.observacoes === 'string' ? valor.observacoes : undefined,
        revisadoEm: diario.revisadoEm,
        comprovanteLeitura: diario.revisadoEm ? undefined : this.criarComprovante(tenantId, diarioId, usuario)
      };
    });
  }

  async revisar(tenantId: string, diarioId: string, usuario: UsuarioAutenticado, comprovante: string) {
    this.validarComprovante(comprovante, tenantId, diarioId, usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(LogDiarioRapidoOrm);
      const diario = await repositorio.findOne({ where: { id: diarioId, tenantId } });
      if (!diario || diario.tipo !== 'humor') throw new NotFoundException('Registro de hábitos não encontrado.');
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: {
        id: diario.pacienteId, tenantId, arquivadoEm: IsNull(), statusCicloVida: 'ACTIVE',
        ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {})
      } });
      if (!paciente) throw new NotFoundException('Registro de hábitos não encontrado.');
      if (diario.revisadoEm) return { id: diario.id, revisadoEm: diario.revisadoEm, revisadoPorUsuarioId: diario.revisadoPorUsuarioId };
      const revisadoEm = new Date();
      const atualizado = await repositorio.update({ id: diarioId, tenantId, revisadoEm: IsNull() }, {
        revisadoEm, revisadoPorUsuarioId: usuario.usuarioId
      });
      if (!atualizado.affected) {
        const atual = await repositorio.findOne({ where: { id: diarioId, tenantId } });
        if (!atual?.revisadoEm) throw new NotFoundException('Registro de hábitos não encontrado.');
        return { id: atual.id, revisadoEm: atual.revisadoEm, revisadoPorUsuarioId: atual.revisadoPorUsuarioId };
      }
      return { id: diario.id, revisadoEm, revisadoPorUsuarioId: usuario.usuarioId };
    });
  }

  private criarComprovante(tenantId: string, diarioId: string, usuario: UsuarioAutenticado): string {
    const conteudo = Buffer.from(JSON.stringify({ finalidade: 'revisao_habitos', tenantId, diarioId,
      usuarioId: usuario.usuarioId, sessaoId: usuario.sessaoId ?? null,
      expiraEm: Date.now() + DURACAO_COMPROVANTE_MS
    })).toString('base64url');
    return `${conteudo}.${this.assinar(conteudo)}`;
  }

  private validarComprovante(comprovante: string, tenantId: string, diarioId: string, usuario: UsuarioAutenticado): void {
    try {
      const [conteudo, assinatura] = comprovante.split('.');
      if (!conteudo || !assinatura || comprovante.split('.').length !== 2) throw new Error();
      const esperada = this.assinar(conteudo);
      if (assinatura.length !== esperada.length || !timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) throw new Error();
      const dados = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8')) as Record<string, unknown>;
      if (dados.finalidade !== 'revisao_habitos' || dados.tenantId !== tenantId || dados.diarioId !== diarioId ||
          dados.usuarioId !== usuario.usuarioId || dados.sessaoId !== (usuario.sessaoId ?? null) ||
          typeof dados.expiraEm !== 'number' || dados.expiraEm < Date.now()) throw new Error();
    } catch {
      throw new BadRequestException('Abra o registro novamente antes de confirmar a revisão.');
    }
  }

  private assinar(conteudo: string): string {
    return createHmac('sha256', obterSegredoAcesso()).update('octaclin:revisao-habitos:v1:').update(conteudo).digest('base64url');
  }
}
