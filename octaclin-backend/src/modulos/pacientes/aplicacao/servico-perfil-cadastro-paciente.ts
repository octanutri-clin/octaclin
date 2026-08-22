import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import {
  AtualizarContatoCadastroPacienteDto,
  AtualizarFiscalCadastroPacienteDto,
  AtualizarIdentificacaoCadastroPacienteDto,
  AtualizarOperacaoCadastroPacienteDto,
  FiscalCadastroPacienteRespostaDto,
  PerfilCadastroPacienteRespostaDto,
  QualidadeCadastroSecaoDto,
  QualidadeEAcessoPacienteRespostaDto
} from './dtos';
import { ConvitePacienteOrm } from '../infraestrutura/convite-paciente.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { PerfilCadastroPacienteOrm } from '../infraestrutura/perfil-cadastro-paciente.orm';
import { ServicoDuplicidadePacientes } from './servico-duplicidade-pacientes';

type CampoCifrado =
  | 'identificacaoCriptografada'
  | 'contatoCriptografado'
  | 'operacaoCriptografada'
  | 'fiscalCriptografado';

@Injectable()
export class ServicoPerfilCadastroPaciente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly duplicidade: ServicoDuplicidadePacientes
  ) {}

  async obter(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<PerfilCadastroPacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const perfil = await gerenciador.getRepository(PerfilCadastroPacienteOrm).findOne({
        where: { tenantId, pacienteId }
      });
      return {
        identificacao: usuario.papel === 'Professional' || usuario.papel === 'SuperAdmin'
          ? this.descriptografarBloco(perfil?.identificacaoCriptografada)
          : undefined,
        contato: this.descriptografarBloco(perfil?.contatoCriptografado),
        operacao: this.descriptografarBloco(perfil?.operacaoCriptografada),
        atualizadoEm: perfil?.atualizadoEm
      };
    });
  }

  async atualizarIdentificacao(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarIdentificacaoCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarIdentificacaoCadastroPacienteDto> {
    if (dados.condicaoBiologica && dados.sexo !== 'feminino') {
      throw new BadRequestException('A condicao biologica so pode ser registrada para sexo feminino.');
    }
    return this.atualizarBloco(tenantId, pacienteId, 'identificacaoCriptografada', dados, usuario);
  }

  async atualizarContato(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarContatoCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarContatoCadastroPacienteDto> {
    const telefone = dados.ddi && dados.celular ? `${dados.ddi}${dados.celular}` : dados.telefone;
    return this.atualizarBloco(tenantId, pacienteId, 'contatoCriptografado', { ...dados, telefone }, usuario);
  }

  async atualizarOperacao(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarOperacaoCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarOperacaoCadastroPacienteDto> {
    return this.atualizarBloco(tenantId, pacienteId, 'operacaoCriptografada', dados, usuario);
  }

  async obterFiscal(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<FiscalCadastroPacienteRespostaDto> {
    this.garantirPermissaoFinanceira(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const perfil = await gerenciador.getRepository(PerfilCadastroPacienteOrm).findOne({
        where: { tenantId, pacienteId }
      });
      return { ...this.descriptografarBloco(perfil?.fiscalCriptografado), atualizadoEm: perfil?.atualizadoEm };
    });
  }

  async obterQualidadeEAcesso(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<QualidadeEAcessoPacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const perfil = await gerenciador.getRepository(PerfilCadastroPacienteOrm).findOne({ where: { tenantId, pacienteId } });
      const identificacao = this.descriptografarBloco<AtualizarIdentificacaoCadastroPacienteDto>(perfil?.identificacaoCriptografada);
      const contato = this.descriptografarBloco<AtualizarContatoCadastroPacienteDto>(perfil?.contatoCriptografado);
      const operacao = this.descriptografarBloco<AtualizarOperacaoCadastroPacienteDto>(perfil?.operacaoCriptografada);
      const fiscal = usuario.permissoes.includes('agenda.financeiro.ler')
        ? this.descriptografarBloco<AtualizarFiscalCadastroPacienteDto>(perfil?.fiscalCriptografado)
        : undefined;

      const secoes = this.calcularQualidade(paciente, identificacao, contato, operacao, fiscal, Boolean(fiscal || usuario.permissoes.includes('agenda.financeiro.ler')));
      const total = secoes.reduce((soma, secao) => soma + (secao.opcional ? 0 : secao.total), 0);
      const preenchidos = secoes.reduce((soma, secao) => soma + (secao.opcional ? 0 : secao.preenchidos), 0);

      return {
        percentualPreenchido: total ? Math.round((preenchidos / total) * 100) : 100,
        secoes,
        possiveisDuplicidades: await this.duplicidade.verificarPorPaciente(gerenciador, tenantId, usuario, paciente, contato),
        acessoPortal: await this.obterEstadoAcesso(gerenciador, tenantId, paciente, contato)
      };
    });
  }

  async atualizarFiscal(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarFiscalCadastroPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<AtualizarFiscalCadastroPacienteDto> {
    this.garantirPermissaoFinanceira(usuario);
    return this.atualizarBloco(tenantId, pacienteId, 'fiscalCriptografado', dados, usuario);
  }

  private async atualizarBloco<T extends object>(
    tenantId: string,
    pacienteId: string,
    campo: CampoCifrado,
    dados: T,
    usuario: UsuarioAutenticado
  ): Promise<T> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(PerfilCadastroPacienteOrm);
      const perfil = (await repositorio.findOne({ where: { tenantId, pacienteId } })) ?? repositorio.create({ tenantId, pacienteId });
      perfil[campo] = this.criptografia.criptografar(JSON.stringify(dados));
      await repositorio.save(perfil);
      return dados;
    });
  }

  private async garantirPacienteAcessivel(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<PacienteOrm> {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    return paciente;
  }

  private calcularQualidade(
    paciente: PacienteOrm,
    identificacao?: AtualizarIdentificacaoCadastroPacienteDto,
    contato?: AtualizarContatoCadastroPacienteDto,
    operacao?: AtualizarOperacaoCadastroPacienteDto,
    fiscal?: AtualizarFiscalCadastroPacienteDto,
    incluirFiscal = false
  ): QualidadeCadastroSecaoDto[] {
    const criarSecao = (secao: QualidadeCadastroSecaoDto['secao'], titulo: string, campos: Array<[string, unknown]>, opcional = false) => {
      const camposFaltantes = campos.filter(([, valor]) => !this.temValor(valor)).map(([rotulo]) => rotulo);
      return { secao, titulo, camposFaltantes, preenchidos: campos.length - camposFaltantes.length, total: campos.length, opcional };
    };
    const secoes: QualidadeCadastroSecaoDto[] = [
      criarSecao('identificacao', 'Identificacao', [
        ['Nome completo', this.descriptografarSeguro(paciente.nomeCriptografado)],
        ['Data de nascimento', paciente.dataNascimento],
        ['Apelido ou nome de uso', identificacao?.nomeUso],
        ['Sexo', identificacao?.sexo],
        ...(identificacao?.sexo === 'feminino' ? [['Condicao biologica', identificacao.condicaoBiologica] as [string, unknown]] : [])
      ]),
      criarSecao('contato', 'Contato e endereco', [
        ['E-mail', contato?.email], ['DDI', contato?.ddi], ['Celular com DDD', contato?.celular],
        ['Canal preferido', contato?.canalPreferido], ['CEP', contato?.endereco?.cep],
        ['Endereco', contato?.endereco?.logradouro], ['Bairro', contato?.endereco?.bairro],
        ['Cidade', contato?.endereco?.cidade], ['Estado', contato?.endereco?.estado], ['Instagram', contato?.instagram]
      ]),
      criarSecao('operacao', 'Operacao', [
        ['Categoria do paciente', operacao?.categoria], ['Origem', operacao?.origem], ['Etiquetas', operacao?.tags]
      ])
    ];
    if (incluirFiscal) secoes.push(criarSecao('fiscal', 'Dados fiscais opcionais', [['CPF', fiscal?.cpf], ['E-mail para recibo', fiscal?.emailRecibo]], true));
    return secoes;
  }

  private async obterEstadoAcesso(
    gerenciador: EntityManager,
    tenantId: string,
    paciente: PacienteOrm,
    contato?: AtualizarContatoCadastroPacienteDto
  ): Promise<QualidadeEAcessoPacienteRespostaDto['acessoPortal']> {
    const convite = await gerenciador.getRepository(ConvitePacienteOrm).findOne({
      where: { tenantId, pacienteId: paciente.id },
      order: { criadoEm: 'DESC' }
    });
    const usuario = paciente.usuarioId
      ? await gerenciador.getRepository(UsuarioOrm).findOne({ where: { id: paciente.usuarioId, tenantId } })
      : null;
    const consentimentos = paciente.usuarioId
      ? await gerenciador.getRepository(ConsentimentoLgpdOrm).find({
          where: { tenantId, usuarioId: paciente.usuarioId },
          order: { aceitoEm: 'DESC' }
        })
      : [];
    const aceitesPermitidos = new Set(['termos_uso', 'politica_privacidade', 'consentimento_lgpd']);
    const aceitesUnicos = new Map<string, { tipo: string; versao: string; aceitoEm: Date }>();
    for (const aceite of consentimentos) {
      if (aceitesPermitidos.has(aceite.tipo) && !aceitesUnicos.has(aceite.tipo)) {
        aceitesUnicos.set(aceite.tipo, { tipo: aceite.tipo, versao: aceite.versao, aceitoEm: aceite.aceitoEm });
      }
    }
    let status: QualidadeEAcessoPacienteRespostaDto['acessoPortal']['status'] = 'nao_convidado';
    if (usuario) status = usuario.ativo ? 'acesso_ativo' : 'acesso_desativado';
    else if (convite?.status === 'pendente') status = convite.expiraEm <= new Date() ? 'convite_expirado' : 'convite_pendente';
    else if (convite?.status === 'revogado') status = 'convite_revogado';
    else if (convite?.status === 'expirado') status = 'convite_expirado';

    return {
      status,
      email: usuario ? this.descriptografarSeguro(usuario.emailCriptografado) : contato?.email ?? (convite ? this.descriptografarSeguro(convite.emailCriptografado) : undefined),
      conviteId: convite?.id,
      conviteCriadoEm: convite?.criadoEm,
      conviteExpiraEm: convite?.expiraEm,
      conviteAceitoEm: convite?.aceitoEm,
      conviteRevogadoEm: convite?.revogadoEm,
      ultimoAcessoEm: usuario?.ultimoLoginEm,
      canalPreferido: contato?.canalPreferido,
      preferencias: this.obterPreferenciasPortal(paciente),
      aceites: [...aceitesUnicos.values()]
    };
  }

  private obterPreferenciasPortal(paciente: PacienteOrm): QualidadeEAcessoPacienteRespostaDto['acessoPortal']['preferencias'] {
    const contato = this.descriptografarSeguro(paciente.contatoCriptografado);
    if (!contato) return undefined;
    try {
      const parseado = JSON.parse(contato) as { preferencias?: Record<string, unknown> };
      const preferencias = parseado.preferencias;
      if (!preferencias || typeof preferencias !== 'object') return undefined;
      const horario = preferencias.horarioPermitido && typeof preferencias.horarioPermitido === 'object'
        ? preferencias.horarioPermitido as Record<string, unknown>
        : undefined;
      const canal = preferencias.canalPreferido;
      return {
        email: typeof preferencias.email === 'boolean' ? preferencias.email : undefined,
        whatsapp: typeof preferencias.whatsapp === 'boolean' ? preferencias.whatsapp : undefined,
        canalPreferido: canal === 'email' || canal === 'whatsapp' || canal === 'qualquer' ? canal : undefined,
        horarioPermitido: horario ? {
          inicio: typeof horario.inicio === 'string' ? horario.inicio : undefined,
          fim: typeof horario.fim === 'string' ? horario.fim : undefined,
          timezone: typeof horario.timezone === 'string' ? horario.timezone : undefined
        } : undefined
      };
    } catch {
      return undefined;
    }
  }

  private temValor(valor: unknown): boolean {
    if (Array.isArray(valor)) return valor.length > 0;
    return valor !== undefined && valor !== null && String(valor).trim().length > 0;
  }

  private normalizar(valor?: string): string | undefined {
    const normalizado = valor?.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    return normalizado || undefined;
  }

  private descriptografarSeguro(valor?: Buffer): string | undefined {
    if (!valor) return undefined;
    try { return this.criptografia.descriptografar(valor); } catch { return undefined; }
  }

  private garantirPermissaoFinanceira(usuario: UsuarioAutenticado): void {
    if (!usuario.permissoes.includes('agenda.financeiro.ler')) {
      throw new ForbiddenException('Usuario sem permissao para dados fiscais.');
    }
  }

  private descriptografarBloco<T extends object>(valor?: Buffer): T | undefined {
    if (!valor) return undefined;
    try {
      const resultado: unknown = JSON.parse(this.criptografia.descriptografar(valor));
      if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)) return undefined;
      return resultado as T;
    } catch {
      return undefined;
    }
  }
}
