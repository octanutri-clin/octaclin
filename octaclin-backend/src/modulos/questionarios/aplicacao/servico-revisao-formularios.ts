import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { In, MoreThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { obterSegredoAcesso } from '../../auth/infraestrutura/configuracao-jwt';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { EnvioQuestionarioOrm } from '../infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';

const DURACAO_COMPROVANTE_MS = 10 * 60 * 1000;

@Injectable()
export class ServicoRevisaoFormularios {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listarPendentes(tenantId: string, usuario: UsuarioAutenticado, pagina: number) {
    const paginaSegura = Math.max(1, Math.min(10000, Math.floor(pagina) || 1));
    const tamanho = 20;
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const consulta = gerenciador.getRepository(EnvioQuestionarioOrm).createQueryBuilder('envio')
        .innerJoin(PacienteOrm, 'paciente', 'paciente.id = envio.pacienteId AND paciente.tenantId = envio.tenantId')
        .innerJoin(RespostaCheckinOrm, 'resposta', 'resposta.envioQuestionarioId = envio.id AND resposta.tenantId = envio.tenantId AND resposta.finalizadoEm IS NOT NULL')
        .where('envio.tenantId = :tenantId', { tenantId })
        .andWhere('envio.status = :status', { status: 'respondido' })
        .andWhere('envio.revisadoEm IS NULL')
        .andWhere('paciente.statusCicloVida NOT IN (:...bloqueados)', { bloqueados: ['DELETED', 'DELETION_PENDING'] });
      if (profissionalId) consulta.andWhere('paciente.profissionalResponsavelId = :profissionalId', { profissionalId });
      const [envios, total] = await consulta.orderBy('envio.respondidoEm', 'ASC', 'NULLS LAST')
        .addOrderBy('envio.id', 'ASC').skip((paginaSegura - 1) * tamanho).take(tamanho).getManyAndCount();
      const ids = [...new Set(envios.map((envio) => envio.pacienteId))];
      const pacientes = ids.length ? await gerenciador.getRepository(PacienteOrm).find({
        where: ids.map((id) => ({ id, tenantId, ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) })),
        select: { id: true, nomeCriptografado: true }
      }) : [];
      const nomes = new Map(pacientes.map((p) => [p.id, this.criptografia.descriptografar(p.nomeCriptografado)]));
      return { pagina: paginaSegura, tamanho, total, itens: envios.map((envio) => ({
        id: envio.id, pacienteId: envio.pacienteId, pacienteNome: nomes.get(envio.pacienteId) ?? 'Paciente',
        respondidoEm: envio.respondidoEm
      })) };
    });
  }

  async obterDetalhe(tenantId: string, envioId: string, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({ where: { id: envioId, tenantId, status: 'respondido' } });
      if (!envio) throw new NotFoundException('Resposta nao encontrada.');
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: {
        id: envio.pacienteId, tenantId, ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {})
      } });
      if (!paciente || ['DELETED', 'DELETION_PENDING'].includes(paciente.statusCicloVida ?? 'ACTIVE')) throw new NotFoundException('Resposta nao encontrada.');
      const resposta = await gerenciador.getRepository(RespostaCheckinOrm).findOne({ where: { tenantId, envioQuestionarioId: envio.id, pacienteId: envio.pacienteId } });
      if (!resposta?.finalizadoEm) throw new NotFoundException('Resposta nao encontrada.');
      const valores = await gerenciador.getRepository(RespostaValorOrm).find({ where: { tenantId, respostaCheckinId: resposta.id } });
      const perguntasHistoricas = envio.snapshotEstrutura?.perguntas;
      const perguntasAtuais = perguntasHistoricas ? [] : await gerenciador.getRepository(PerguntaOrm).find({ where: { tenantId, questionarioId: envio.questionarioId } });
      const perguntas = perguntasHistoricas ?? perguntasAtuais;
      const porId = new Map(valores.map((valor) => [valor.perguntaId, valor.valor]));
      const questionario = perguntasHistoricas ? null : await gerenciador.getRepository(QuestionarioOrm).findOne({ where: { id: envio.questionarioId, tenantId } });
      const proximaConsulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
        where: { tenantId, pacienteId: paciente.id, status: In(['agendada', 'reagendada']), inicioEm: MoreThan(new Date()) },
        order: { inicioEm: 'ASC' }, select: { id: true, inicioEm: true }
      });
      return {
        id: envio.id,
        pacienteId: paciente.id,
        pacienteNome: this.criptografia.descriptografar(paciente.nomeCriptografado),
        titulo: envio.snapshotEstrutura?.titulo ?? questionario?.titulo ?? 'Formulário',
        respondidoEm: envio.respondidoEm,
        finalizadoEm: resposta.finalizadoEm,
        proximaConsultaEm: proximaConsulta?.inicioEm,
        revisadoEm: envio.revisadoEm,
        versaoHistoricaDisponivel: Boolean(perguntasHistoricas),
        respostas: [...perguntas].sort((a, b) => a.ordem - b.ordem).filter((p) => porId.has(p.id)).map((p) => ({
          perguntaId: p.id, enunciado: p.enunciado, tipo: p.tipo,
          valor: this.valorParaLeitura(p, porId.get(p.id))
        })),
        comprovanteLeitura: envio.revisadoEm ? undefined : this.criarComprovante(tenantId, envioId, usuario)
      };
    });
  }

  validarComprovante(comprovante: string, tenantId: string, envioId: string, usuario: UsuarioAutenticado): void {
    try {
      const [conteudo, assinatura] = comprovante.split('.');
      if (!conteudo || !assinatura || comprovante.split('.').length !== 2) throw new Error();
      const esperada = this.assinar(conteudo);
      if (assinatura.length !== esperada.length || !timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) throw new Error();
      const dados = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8')) as Record<string, unknown>;
      if (dados.finalidade !== 'revisao_formulario' || dados.tenantId !== tenantId || dados.envioId !== envioId ||
        dados.usuarioId !== usuario.usuarioId || dados.sessaoId !== (usuario.sessaoId ?? null) ||
        typeof dados.expiraEm !== 'number' || dados.expiraEm < Date.now()) throw new Error();
    } catch {
      throw new BadRequestException('Abra a resposta novamente antes de concluir a revisao.');
    }
  }

  private criarComprovante(tenantId: string, envioId: string, usuario: UsuarioAutenticado): string {
    const conteudo = Buffer.from(JSON.stringify({ finalidade: 'revisao_formulario', tenantId, envioId,
      usuarioId: usuario.usuarioId, sessaoId: usuario.sessaoId ?? null, expiraEm: Date.now() + DURACAO_COMPROVANTE_MS
    })).toString('base64url');
    return `${conteudo}.${this.assinar(conteudo)}`;
  }

  private valorParaLeitura(pergunta: { tipo: string; opcoes?: { valor: string; rotulo: string }[] }, valor: unknown): unknown {
    if (pergunta.tipo === 'upload_midia' && Array.isArray(valor)) {
      return `${valor.length} ${valor.length === 1 ? 'anexo informado' : 'anexos informados'}`;
    }
    if (pergunta.tipo !== 'multipla_escolha') return valor;
    const rotulos = new Map(pergunta.opcoes?.map((opcao) => [opcao.valor, opcao.rotulo]) ?? []);
    const rotular = (item: unknown) => typeof item === 'string' ? rotulos.get(item) ?? item : item;
    return Array.isArray(valor) ? valor.map(rotular) : rotular(valor);
  }

  private assinar(conteudo: string): string {
    return createHmac('sha256', obterSegredoAcesso()).update('octaclin:revisao-formulario:v1:').update(conteudo).digest('base64url');
  }
}
