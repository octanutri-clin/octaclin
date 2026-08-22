import { Injectable } from '@nestjs/common';
import { ArrayOverlap, EntityManager, IsNull } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

export type MotivoDuplicidade = 'nome_e_nascimento' | 'contato' | 'nome';

export interface CandidatoDuplicidade {
  pacienteId: string;
  nome: string;
  motivos: MotivoDuplicidade[];
}

const MAXIMO_CANDIDATOS = 5;

/**
 * Aviso consultivo de possivel cadastro repetido, compartilhado pelo cadastro
 * novo e pelo perfil do paciente.
 *
 * ponytail: ArrayOverlap sobre hashes e so pre-filtro; a decisao final e
 * igualdade sobre texto normalizado, que nao remove acento e nao tolera erro de
 * digitacao. Upgrade, se doer: NFKD em normalizar e comparacao fonetica.
 */
@Injectable()
export class ServicoDuplicidadePacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly auditoria: ServicoAuditoria
  ) {}

  /** Entrada do controlador: abre a transacao e delega. */
  async verificar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: { nome: string; contato?: string; dataNascimento?: string }
  ): Promise<{ candidatos: CandidatoDuplicidade[] }> {
    const candidatos = await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.verificarPorTexto(gerenciador, tenantId, usuario, dados));
    return { candidatos };
  }

  /** Cadastro novo: ainda nao existe paciente, so o que foi digitado. */
  async verificarPorTexto(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: { nome: string; contato?: string; dataNascimento?: string }
  ): Promise<CandidatoDuplicidade[]> {
    const hashes = this.criptografia.gerarHashesBuscaPii(tenantId, [dados.nome, dados.contato]);
    return this.comparar(gerenciador, tenantId, usuario, hashes, {
      nome: this.normalizar(dados.nome),
      contato: this.normalizar(dados.contato),
      nascimento: dados.dataNascimento,
      ignorarId: undefined
    });
  }

  /** Perfil: o paciente ja existe e nao pode ser candidato de si mesmo. */
  async verificarPorPaciente(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    pacienteAtual: PacienteOrm,
    contatoPerfil?: { email?: string; celular?: string }
  ): Promise<CandidatoDuplicidade[]> {
    const nome = this.descriptografarSeguro(pacienteAtual.nomeCriptografado);
    const contato = contatoPerfil?.email ?? contatoPerfil?.celular ?? this.obterContatoComparavel(pacienteAtual);
    // buscaHashes ja vem calculado no cadastro do paciente; recalcular so serve de
    // fallback para paciente sintetico/legado sem o indice preenchido.
    const hashes = pacienteAtual.buscaHashes?.length
      ? pacienteAtual.buscaHashes
      : this.criptografia.gerarHashesBuscaPii(tenantId, [nome, contato]);
    return this.comparar(gerenciador, tenantId, usuario, hashes, {
      nome: this.normalizar(nome),
      contato: this.normalizar(contato),
      nascimento: pacienteAtual.dataNascimento ? String(pacienteAtual.dataNascimento) : undefined,
      ignorarId: pacienteAtual.id
    });
  }

  async registrarDispensa(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pacienteCriadoId: string,
    candidatosDispensados: string[]
  ): Promise<void> {
    await this.auditoria.registrar({
      tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'paciente.duplicidade_dispensada',
      recursoTipo: 'paciente',
      recursoId: pacienteCriadoId,
      metadados: { candidatosDispensados }
    });
  }

  private async comparar(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    hashes: string[],
    alvo: { nome?: string; contato?: string; nascimento?: string; ignorarId?: string }
  ): Promise<CandidatoDuplicidade[]> {
    // Sem hashes nao ha filtro de indice possivel: nomes com menos de 3
    // caracteres (primeiras teclas digitadas no cadastro novo) geram hashes
    // vazios. Sem este guard, cada keystroke faria um find() sem ArrayOverlap,
    // varrendo e decifrando toda a carteira do profissional.
    if (!hashes.length) return [];
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const candidatos = await gerenciador.getRepository(PacienteOrm).find({
      where: {
        tenantId,
        arquivadoEm: IsNull(),
        buscaHashes: ArrayOverlap(hashes),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      },
      select: { id: true, nomeCriptografado: true, contatoCriptografado: true, dataNascimento: true }
    });

    return candidatos.flatMap((candidato) => {
      if (candidato.id === alvo.ignorarId) return [];
      const nomeCandidato = this.normalizar(this.descriptografarSeguro(candidato.nomeCriptografado));
      const nascimentoCandidato = candidato.dataNascimento ? String(candidato.dataNascimento) : undefined;
      const mesmoNome = Boolean(alvo.nome && nomeCandidato && alvo.nome === nomeCandidato);

      const motivos: MotivoDuplicidade[] = [];
      if (mesmoNome && alvo.nascimento && alvo.nascimento === nascimentoCandidato) {
        motivos.push('nome_e_nascimento');
      } else if (mesmoNome && !alvo.nascimento && !nascimentoCandidato) {
        motivos.push('nome');
      }
      if (alvo.contato && alvo.contato === this.normalizar(this.obterContatoComparavel(candidato))) {
        motivos.push('contato');
      }

      return motivos.length
        ? [{
            pacienteId: candidato.id,
            nome: this.descriptografarSeguro(candidato.nomeCriptografado) ?? 'Paciente',
            motivos
          }]
        : [];
    }).slice(0, MAXIMO_CANDIDATOS);
  }

  private obterContatoComparavel(paciente: PacienteOrm): string | undefined {
    const contato = this.descriptografarSeguro(paciente.contatoCriptografado);
    if (!contato) return undefined;
    try {
      const parseado = JSON.parse(contato) as { email?: unknown; whatsapp?: unknown };
      if (typeof parseado.email === 'string') return parseado.email;
      if (typeof parseado.whatsapp === 'string') return parseado.whatsapp;
      return undefined;
    } catch {
      return contato;
    }
  }

  private normalizar(valor?: string): string | undefined {
    const normalizado = valor?.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    return normalizado || undefined;
  }

  private descriptografarSeguro(valor?: Buffer): string | undefined {
    if (!valor) return undefined;
    try { return this.criptografia.descriptografar(valor); } catch { return undefined; }
  }
}
