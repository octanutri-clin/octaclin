import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { analisarCsv } from '../../../infraestrutura/exportacao/csv';
import type { LinhaCsv } from '../../../infraestrutura/exportacao/csv';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { ServicoPortalCliente } from '../../clientes/aplicacao/servico-portal-cliente';
import { ServicoConvitesPaciente } from './servico-convites-paciente';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ImportarPacientesDto } from './dtos';

/**
 * Teto por importacao. Nao e limite de plano: e freio de abuso — um POST com
 * 50 mil linhas segura a instancia inteira (a Fase 201 ainda nao liberou mais
 * de um backend) e serve de vetor de exfiltracao por tentativa e erro.
 */
export const LIMITE_LINHAS_IMPORTACAO = 500;

const COLUNAS = {
  nome: ['nome', 'paciente', 'nome completo', 'nome do paciente'],
  contato: ['contato', 'email', 'e-mail', 'telefone', 'celular', 'whatsapp'],
  dataNascimento: ['data de nascimento', 'data nascimento', 'datanascimento', 'nascimento', 'aniversario'],
  anexo: ['anexo', 'arquivo', 'exame', 'documento']
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SituacaoLinhaImportacao = 'valido' | 'invalido' | 'duplicado' | 'limite_plano';

export interface LinhaImportacaoPaciente {
  /** Numero da linha no arquivo enviado, para o cliente achar o erro na planilha. */
  linha: number;
  nome?: string;
  contato?: string;
  dataNascimento?: string;
  /**
   * Nome do arquivo declarado na planilha. O anexo em si nao sobe por aqui: o
   * upload assinado da Fase 200 exige paciente existente e valida mime, tamanho
   * e cota no servidor. Quem importa usa `pacienteId` para subir o arquivo
   * depois, pelo mesmo caminho de qualquer outro anexo.
   */
  anexo?: string;
  /** Preenchido so quando a linha foi gravada de verdade. */
  pacienteId?: string;
  linkConvite?: string;
  situacao: SituacaoLinhaImportacao;
  erros: string[];
  /** Nao impediram a criacao do paciente, mas o operador precisa ver. */
  avisos: string[];
}

export interface RelatorioImportacaoPacientes {
  total: number;
  validos: number;
  duplicados: number;
  invalidos: number;
  bloqueadosPorPlano: number;
  criados: number;
  convitesCriados: number;
  linhas: LinhaImportacaoPaciente[];
}

interface LinhaPreparada {
  relatorio: LinhaImportacaoPaciente;
  chave?: string;
}

/**
 * Importacao de pacientes por planilha.
 *
 * Duas entradas com a mesma analise: `previa` mostra o relatorio sem gravar e
 * `importar` grava as linhas validas. O relatorio devolve **uma entrada por
 * linha do arquivo**, inclusive as recusadas — linha invalida que some sem
 * aviso e o pior resultado possivel de uma importacao.
 */
@Injectable()
export class ServicoImportacaoPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly portalCliente: ServicoPortalCliente,
    private readonly convites: ServicoConvitesPaciente
  ) {}

  async previa(
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: ImportarPacientesDto
  ): Promise<RelatorioImportacaoPacientes> {
    return this.processar(tenantId, usuario, dados, false);
  }

  async importar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: ImportarPacientesDto
  ): Promise<RelatorioImportacaoPacientes> {
    return this.processar(tenantId, usuario, dados, true);
  }

  private async processar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: ImportarPacientesDto,
    gravar: boolean
  ): Promise<RelatorioImportacaoPacientes> {
    const { cabecalho, linhas } = analisarCsv(dados.conteudo ?? '');
    if (!linhas.length) throw new BadRequestException('Arquivo sem nenhuma linha de paciente.');
    if (linhas.length > LIMITE_LINHAS_IMPORTACAO) {
      throw new BadRequestException(
        `Importe no maximo ${LIMITE_LINHAS_IMPORTACAO} pacientes por vez (o arquivo tem ${linhas.length}).`
      );
    }

    const indices = this.mapearColunas(cabecalho);
    if (indices.nome === undefined) {
      throw new BadRequestException(
        `Arquivo sem coluna de nome. Cabecalhos aceitos: ${COLUNAS.nome.join(', ')}.`
      );
    }

    const limite = await this.portalCliente.checarLimite(tenantId, 'pacientes');
    if (!limite.permitido) {
      throw new ForbiddenException(limite.mensagem ?? 'Limite do plano atingido para esta acao.');
    }
    let vagasRestantes = limite.restante ?? Number.POSITIVE_INFINITY;

    const relatorio = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalResponsavelId = await this.resolverProfissionalResponsavel(gerenciador, tenantId, usuario, dados);
      const chavesExistentes = await this.carregarChavesExistentes(gerenciador, tenantId, profissionalResponsavelId);
      const repositorio = gerenciador.getRepository(PacienteOrm);

      const relatorio: RelatorioImportacaoPacientes = {
        total: linhas.length,
        validos: 0,
        duplicados: 0,
        invalidos: 0,
        bloqueadosPorPlano: 0,
        criados: 0,
        convitesCriados: 0,
        linhas: []
      };

      for (const linha of linhas) {
        const preparada = this.prepararLinha(linha, indices);
        const { relatorio: item, chave } = preparada;

        if (item.situacao === 'invalido') {
          relatorio.invalidos += 1;
        } else if (chave && chavesExistentes.has(chave)) {
          item.situacao = 'duplicado';
          item.erros.push('Paciente ja cadastrado para este profissional.');
          relatorio.duplicados += 1;
        } else if (vagasRestantes <= 0) {
          item.situacao = 'limite_plano';
          item.erros.push('Limite de pacientes do plano atingido. Amplie o plano para importar o restante.');
          relatorio.bloqueadosPorPlano += 1;
        } else {
          relatorio.validos += 1;
          vagasRestantes -= 1;
          if (chave) chavesExistentes.add(chave);

          if (gravar) {
            const paciente = await repositorio.save(
              repositorio.create({
                tenantId,
                profissionalResponsavelId,
                nomeCriptografado: this.criptografia.criptografar(item.nome as string),
                contatoCriptografado: item.contato ? this.criptografia.criptografar(item.contato) : undefined,
                buscaHashes: this.criptografia.gerarHashesBuscaPii(tenantId, [item.nome, item.contato]),
                dataNascimento: item.dataNascimento,
                statusAdesao: 'novo',
                scoreRisco: '0'
              })
            );
            item.pacienteId = paciente.id;
            relatorio.criados += 1;
          }
        }

        if (gravar && item.anexo && !item.pacienteId) {
          item.avisos.push('Linha nao criada: o anexo declarado ficara sem paciente para receber.');
        }

        relatorio.linhas.push(item);
      }

      return relatorio;
    });

    if (dados.enviarConvite) {
      for (const item of relatorio.linhas) {
        if (item.situacao !== 'valido') continue;
        if (!item.contato || !EMAIL.test(item.contato)) {
          item.avisos.push('Convite nao enviado: a coluna de contato precisa ter um e-mail.');
          continue;
        }
        if (gravar && item.pacienteId && (await this.convidar(tenantId, usuario, item))) {
          relatorio.convitesCriados += 1;
        }
      }
    }

    return relatorio;
  }

  /**
   * Convite de portal do paciente recem-criado.
   *
   * Falha de convite nao derruba a importacao nem desfaz o paciente: o cadastro
   * ja e util sem portal, e refazer a planilha inteira por causa de um e-mail
   * repetido seria o pior resultado para quem esta migrando de sistema. O motivo
   * fica no aviso da linha.
   */
  private async convidar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    item: LinhaImportacaoPaciente
  ): Promise<boolean> {
    try {
      const convite = await this.convites.criarConvite(tenantId, usuario.usuarioId, item.pacienteId as string, {
        email: item.contato as string
      });
      item.linkConvite = convite.linkAtivacao;
      return true;
    } catch (erro) {
      item.avisos.push(`Convite nao criado: ${erro instanceof Error ? erro.message : 'falha desconhecida'}`);
      return false;
    }
  }

  private async resolverProfissionalResponsavel(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    dados: ImportarPacientesDto
  ): Promise<string> {
    // Profissional so importa para a propria carteira: o id do corpo e ignorado
    // de proposito, senao a importacao vira um jeito de plantar paciente na
    // carteira alheia.
    const doVinculo = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    if (doVinculo) return doVinculo;
    if (!dados.profissionalResponsavelId) {
      throw new BadRequestException('Informe o profissional responsavel pelos pacientes importados.');
    }
    return dados.profissionalResponsavelId;
  }

  /**
   * Chaves dos pacientes que ja existem na carteira do responsavel.
   *
   * A comparacao so olha a carteira do profissional responsavel: o mesmo
   * paciente atendido por dois profissionais e legitimo, e varrer o tenant
   * inteiro contaria "duplicado" sobre paciente que quem importa nem pode ver.
   *
   * ponytail: carrega a carteira inteira e descriptografa em memoria porque nao
   * ha coluna de deduplicacao no banco. Aguenta as milhares de linhas de uma
   * clinica; se virar gargalo, criar coluna `chave_deduplicacao` com indice.
   */
  private async carregarChavesExistentes(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalResponsavelId: string
  ): Promise<Set<string>> {
    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      where: { tenantId, profissionalResponsavelId, arquivadoEm: IsNull() },
      select: { id: true, nomeCriptografado: true, dataNascimento: true }
    });

    return new Set(
      pacientes.map((paciente) =>
        this.montarChave(this.criptografia.descriptografar(paciente.nomeCriptografado), paciente.dataNascimento)
      )
    );
  }

  private prepararLinha(linha: LinhaCsv, indices: Record<string, number | undefined>): LinhaPreparada {
    const ler = (campo: keyof typeof COLUNAS) => {
      const indice = indices[campo];
      return indice === undefined ? undefined : linha.campos[indice]?.trim() || undefined;
    };

    const item: LinhaImportacaoPaciente = { linha: linha.numero, situacao: 'valido', erros: [], avisos: [] };
    const nome = ler('nome');
    const contato = ler('contato');
    const nascimentoBruto = ler('dataNascimento');
    item.anexo = ler('anexo');

    if (!nome || nome.length < 2) item.erros.push('Informe o nome do paciente (minimo 2 caracteres).');
    else if (nome.length > 180) item.erros.push('Nome com mais de 180 caracteres.');
    else item.nome = nome;

    if (contato && contato.length > 80) item.erros.push('Contato com mais de 80 caracteres.');
    else item.contato = contato;

    if (nascimentoBruto) {
      const nascimento = this.normalizarData(nascimentoBruto);
      if (!nascimento) item.erros.push(`Data de nascimento invalida: "${nascimentoBruto}".`);
      else if (nascimento > new Date().toISOString().slice(0, 10)) {
        item.erros.push('Data de nascimento no futuro.');
      } else item.dataNascimento = nascimento;
    }

    if (item.erros.length) {
      item.situacao = 'invalido';
      return { relatorio: item };
    }
    return { relatorio: item, chave: this.montarChave(item.nome as string, item.dataNascimento) };
  }

  private mapearColunas(cabecalho: string[]): Record<string, number | undefined> {
    const indiceDe = (aceitos: readonly string[]) => {
      const indice = cabecalho.findIndex((coluna) => aceitos.includes(coluna));
      return indice >= 0 ? indice : undefined;
    };
    return {
      nome: indiceDe(COLUNAS.nome),
      contato: indiceDe(COLUNAS.contato),
      dataNascimento: indiceDe(COLUNAS.dataNascimento),
      anexo: indiceDe(COLUNAS.anexo)
    };
  }

  /** `dd/mm/aaaa` e `aaaa-mm-dd`, que e o que sai de Excel e de exportacao de concorrente. */
  private normalizarData(valor: string): string | undefined {
    const texto = valor.trim();
    const brasileira = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(texto);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    const [ano, mes, dia] = brasileira
      ? [brasileira[3], brasileira[2], brasileira[1]]
      : iso
        ? [iso[1], iso[2], iso[3]]
        : [];
    if (!ano) return undefined;

    const data = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    if (Number.isNaN(data.getTime()) || data.getUTCDate() !== Number(dia) || data.getUTCMonth() + 1 !== Number(mes)) {
      return undefined;
    }
    return `${ano}-${mes}-${dia}`;
  }

  private montarChave(nome: string, dataNascimento?: string): string {
    const normalizado = nome
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/\s+/g, ' ')
      .trim();
    return `${normalizado}|${dataNascimento ?? ''}`;
  }
}
