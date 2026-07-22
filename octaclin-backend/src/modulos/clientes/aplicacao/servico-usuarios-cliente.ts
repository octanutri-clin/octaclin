import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { CriarUsuarioClienteDto, PapelUsuarioClienteAdministrativo, UsuarioClienteRespostaDto } from './dtos';

const papeisAdministrativos = ['Client', 'Professional', 'Collaborator'] satisfies PapelUsuarioClienteAdministrativo[];

@Injectable()
export class ServicoUsuariosCliente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas
  ) {}

  async listar(tenantId: string): Promise<{ itens: UsuarioClienteRespostaDto[]; total: number }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const usuarios = await gerenciador.getRepository(UsuarioOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' }
      });
      const itens = usuarios
        .filter((usuario) => this.ehPapelAdministrativo(usuario.role))
        .map((usuario) => this.mapearResposta(usuario));

      return { itens, total: itens.length };
    });
  }

  async criar(tenantId: string, dados: CriarUsuarioClienteDto): Promise<UsuarioClienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(UsuarioOrm);
      const emailNormalizado = dados.email.trim().toLowerCase();
      const emailHash = this.criptografia.gerarHashBusca(dados.email);
      const existente = await repositorio.findOne({ where: { tenantId, emailHash } });

      if (existente) {
        throw new ConflictException('Ja existe usuario com este email nesta conta.');
      }

      const usuario = await repositorio.save(
        repositorio.create({
          tenantId,
          emailHash,
          emailCriptografado: this.criptografia.criptografar(emailNormalizado),
          senhaHash: this.senhas.gerarHash(dados.senhaInicial),
          role: dados.role,
          ativo: true
        })
      );

      return this.mapearResposta(usuario);
    });
  }

  async desativar(tenantId: string, usuarioAtualId: string, usuarioId: string): Promise<void> {
    if (usuarioAtualId === usuarioId) {
      throw new ForbiddenException('O gestor logado nao pode desativar o proprio acesso.');
    }

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(UsuarioOrm);
      const usuario = await repositorio.findOne({ where: { id: usuarioId, tenantId } });
      if (!usuario || !this.ehPapelAdministrativo(usuario.role)) {
        throw new NotFoundException('Usuario administrativo nao encontrado.');
      }

      await repositorio.update({ id: usuarioId, tenantId }, { ativo: false });
    });
  }

  private ehPapelAdministrativo(role: string): role is PapelUsuarioClienteAdministrativo {
    return papeisAdministrativos.includes(role as PapelUsuarioClienteAdministrativo);
  }

  private mapearResposta(usuario: UsuarioOrm): UsuarioClienteRespostaDto {
    return {
      id: usuario.id,
      tenantId: usuario.tenantId,
      email: this.criptografia.descriptografar(usuario.emailCriptografado),
      role: usuario.role as PapelUsuarioClienteAdministrativo,
      ativo: usuario.ativo,
      ultimoLoginEm: usuario.ultimoLoginEm,
      criadoEm: usuario.criadoEm,
      atualizadoEm: usuario.atualizadoEm
    };
  }
}
