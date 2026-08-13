import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarRascunhoCondutaTerapeuticaDto, CriarCondutaTerapeuticaDto } from './dtos';
import { CondutaTerapeuticaOrm, TipoCondutaTerapeutica } from '../infraestrutura/conduta-terapeutica.orm';
import { CondutaTerapeuticaVersaoOrm } from '../infraestrutura/conduta-terapeutica-versao.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

export type CondutaTerapeuticaResposta = {
  id: string;
  tipo: TipoCondutaTerapeutica;
  arquivadaEm?: Date;
  criadoEm: Date;
  versoes: Array<{
    id: string;
    numero: number;
    titulo: string;
    conteudo: string;
    validadeInicio?: string;
    validadeFim?: string;
    estado: 'rascunho' | 'publicada' | 'descartada';
    publicadaEm?: Date;
    criadoEm: Date;
  }>;
};

@Injectable()
export class ServicoCondutasTerapeuticas {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<CondutaTerapeuticaResposta[]> {
    this.garantirPapelProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      const condutas = await gerenciador.getRepository(CondutaTerapeuticaOrm).find({
        where: { tenantId, pacienteId }, order: { arquivadaEm: 'ASC', atualizadoEm: 'DESC' }
      });
      const versoes = condutas.length
        ? await gerenciador.getRepository(CondutaTerapeuticaVersaoOrm).find({
            where: condutas.map((conduta) => ({ tenantId, condutaTerapeuticaId: conduta.id })),
            order: { numero: 'DESC' }
          })
        : [];
      return condutas.map((conduta) => this.mapear(conduta, versoes.filter((versao) => versao.condutaTerapeuticaId === conduta.id)));
    });
  }

  async criar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado, dados: CriarCondutaTerapeuticaDto) {
    this.garantirPapelProfissional(usuario);
    this.validarPeriodo(dados.validadeInicio, dados.validadeFim);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, true);
      const repositorio = gerenciador.getRepository(CondutaTerapeuticaOrm);
      const conduta = await repositorio.save(repositorio.create({
        tenantId, pacienteId, profissionalId: paciente.profissionalResponsavelId, tipo: dados.tipo
      }));
      const versao = await this.criarVersao(gerenciador, tenantId, conduta.id, 1, usuario.usuarioId, dados);
      return this.mapear(conduta, [versao]);
    });
  }

  async atualizarRascunho(tenantId: string, pacienteId: string, condutaId: string, usuario: UsuarioAutenticado, dados: AtualizarRascunhoCondutaTerapeuticaDto) {
    this.garantirPapelProfissional(usuario);
    this.validarPeriodo(dados.validadeInicio, dados.validadeFim);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conduta = await this.obterCondutaNoEscopo(gerenciador, tenantId, pacienteId, condutaId, usuario, true);
      const versao = await gerenciador.getRepository(CondutaTerapeuticaVersaoOrm).findOne({
        where: { tenantId, condutaTerapeuticaId: conduta.id, publicadaEm: IsNull(), descartadaEm: IsNull() },
        order: { numero: 'DESC' }, lock: { mode: 'pessimistic_write' }
      });
      if (!versao) throw new NotFoundException('Rascunho da conduta nao encontrado. Crie uma nova versao antes de editar.');
      versao.tituloCriptografado = this.criptografia.criptografar(dados.titulo.trim());
      versao.conteudoCriptografado = this.criptografia.criptografar(dados.conteudo.trim());
      versao.validadeInicio = dados.validadeInicio?.slice(0, 10);
      versao.validadeFim = dados.validadeFim?.slice(0, 10);
      await gerenciador.getRepository(CondutaTerapeuticaVersaoOrm).save(versao);
      return this.mapear(conduta, [versao]);
    });
  }

  async publicar(tenantId: string, pacienteId: string, condutaId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conduta = await this.obterCondutaNoEscopo(gerenciador, tenantId, pacienteId, condutaId, usuario, true);
      const repositorio = gerenciador.getRepository(CondutaTerapeuticaVersaoOrm);
      const rascunho = await repositorio.findOne({
        where: { tenantId, condutaTerapeuticaId: conduta.id, publicadaEm: IsNull(), descartadaEm: IsNull() },
        order: { numero: 'DESC' }, lock: { mode: 'pessimistic_write' }
      });
      if (!rascunho) throw new NotFoundException('Nenhum rascunho disponivel para publicacao.');
      const publicada = await repositorio.findOne({
        where: { tenantId, condutaTerapeuticaId: conduta.id, publicadaEm: Not(IsNull()), descartadaEm: IsNull() },
        order: { numero: 'DESC' }, lock: { mode: 'pessimistic_write' }
      });
      if (publicada) { publicada.descartadaEm = new Date(); await repositorio.save(publicada); }
      rascunho.revisadaEm = new Date();
      rascunho.revisadaPorUsuarioId = usuario.usuarioId;
      rascunho.publicadaEm = new Date();
      await repositorio.save(rascunho);
      return this.mapear(conduta, [rascunho, ...(publicada ? [publicada] : [])]);
    });
  }

  async criarNovaVersao(tenantId: string, pacienteId: string, condutaId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conduta = await this.obterCondutaNoEscopo(gerenciador, tenantId, pacienteId, condutaId, usuario, true);
      const repositorio = gerenciador.getRepository(CondutaTerapeuticaVersaoOrm);
      const atual = await repositorio.findOne({ where: { tenantId, condutaTerapeuticaId: conduta.id, descartadaEm: IsNull() }, order: { numero: 'DESC' }, lock: { mode: 'pessimistic_write' } });
      if (!atual) throw new NotFoundException('Versao da conduta nao encontrada.');
      if (!atual.publicadaEm) throw new BadRequestException('Edite o rascunho atual antes de criar outra versao.');
      const nova = await repositorio.save(repositorio.create({
        tenantId, condutaTerapeuticaId: conduta.id, numero: atual.numero + 1,
        tituloCriptografado: atual.tituloCriptografado, conteudoCriptografado: atual.conteudoCriptografado,
        validadeInicio: atual.validadeInicio, validadeFim: atual.validadeFim, criadoPorUsuarioId: usuario.usuarioId
      }));
      return this.mapear(conduta, [nova]);
    });
  }

  async arquivar(tenantId: string, pacienteId: string, condutaId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conduta = await this.obterCondutaNoEscopo(gerenciador, tenantId, pacienteId, condutaId, usuario, true);
      conduta.arquivadaEm = new Date();
      await gerenciador.getRepository(CondutaTerapeuticaOrm).save(conduta);
      return { id: conduta.id, arquivadaEm: conduta.arquivadaEm };
    });
  }

  private async criarVersao(gerenciador: EntityManager, tenantId: string, condutaId: string, numero: number, usuarioId: string, dados: CriarCondutaTerapeuticaDto) {
    const repositorio = gerenciador.getRepository(CondutaTerapeuticaVersaoOrm);
    return repositorio.save(repositorio.create({
      tenantId, condutaTerapeuticaId: condutaId, numero, criadoPorUsuarioId: usuarioId,
      tituloCriptografado: this.criptografia.criptografar(dados.titulo.trim()),
      conteudoCriptografado: this.criptografia.criptografar(dados.conteudo.trim()),
      validadeInicio: dados.validadeInicio?.slice(0, 10), validadeFim: dados.validadeFim?.slice(0, 10)
    }));
  }

  private async obterCondutaNoEscopo(gerenciador: EntityManager, tenantId: string, pacienteId: string, condutaId: string, usuario: UsuarioAutenticado, bloquear = false) {
    await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, bloquear);
    const conduta = await gerenciador.getRepository(CondutaTerapeuticaOrm).findOne({
      where: { id: condutaId, tenantId, pacienteId, arquivadaEm: IsNull() }, ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!conduta) throw new NotFoundException('Conduta terapeutica nao encontrada.');
    return conduta;
  }

  private async garantirPacienteNoEscopo(gerenciador: EntityManager, tenantId: string, pacienteId: string, usuario: UsuarioAutenticado, bloquear = false) {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), ...(profissionalResponsavelId ? { profissionalResponsavelId } : {}) },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    return paciente;
  }

  private validarPeriodo(inicio?: string, fim?: string) {
    if (inicio && fim && fim < inicio) throw new BadRequestException('A data final de validade deve ser posterior ou igual a inicial.');
  }

  private garantirPapelProfissional(usuario: UsuarioAutenticado) {
    if (usuario.papel !== 'Professional' && usuario.papel !== 'SuperAdmin') throw new ForbiddenException('Somente profissionais autorizados podem registrar condutas terapeuticas.');
  }

  private mapear(conduta: CondutaTerapeuticaOrm, versoes: CondutaTerapeuticaVersaoOrm[]): CondutaTerapeuticaResposta {
    return {
      id: conduta.id, tipo: conduta.tipo, arquivadaEm: conduta.arquivadaEm, criadoEm: conduta.criadoEm,
      versoes: versoes.map((versao) => ({
        id: versao.id, numero: versao.numero,
        titulo: this.criptografia.descriptografar(versao.tituloCriptografado),
        conteudo: this.criptografia.descriptografar(versao.conteudoCriptografado),
        validadeInicio: versao.validadeInicio, validadeFim: versao.validadeFim,
        estado: versao.descartadaEm ? 'descartada' : versao.publicadaEm ? 'publicada' : 'rascunho',
        publicadaEm: versao.publicadaEm, criadoEm: versao.criadoEm
      }))
    };
  }
}
