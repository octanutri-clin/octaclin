import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { EVENTO_RETORNO, impedimentoRetorno } from '../../comunicacoes/dominio/politica-retorno';
import { TipoCanalDireto, canalPermitido, dentroHorarioPermitido, interpretarPreferenciasComunicacao, preferenciasComunicacaoPadrao } from '../../comunicacoes/dominio/preferencias-comunicacao';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

export interface ItemRetorno {
  pacienteId: string;
  elegivel: boolean;
  motivo?: string;
  intervaloDias?: number;
  dataSugerida?: string;
  canalId?: string;
  templateId?: string;
}

@Injectable()
export class ServicoRetornosSemConsulta {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly comunicacoes: ServicoComunicacoes,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async simular(tenantId: string, usuario: UsuarioAutenticado, pacienteIds: string[]): Promise<ItemRetorno[]> {
    this.validarAutorizacao(usuario);
    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId), this.comunicacoes.listarTemplates(tenantId)
    ]);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const pacientes = await gerenciador.getRepository(PacienteOrm).find({
        where: pacienteIds.map((id) => ({ id, tenantId, ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) }))
      });
      const mapa = new Map(pacientes.map((paciente) => [paciente.id, paciente]));
      const historico = await this.historicoConsultas(gerenciador, tenantId, pacientes.map((paciente) => paciente.id));
      return Promise.all(pacienteIds.map(async (pacienteId) => {
        const paciente = mapa.get(pacienteId);
        if (!paciente) return { pacienteId, elegivel: false, motivo: 'paciente_indisponivel' };
        const sugestao = this.sugerirData(historico.get(pacienteId) ?? []);
        const base = { pacienteId, ...sugestao };
        if (paciente.arquivadoEm || ['inativo', 'pausado', 'encerrado', 'fechado'].includes(paciente.statusAdesao)) {
          return { ...base, elegivel: false, motivo: 'paciente_inativo' };
        }
        const impedimento = await impedimentoRetorno(gerenciador, tenantId, pacienteId);
        if (impedimento) return { ...base, elegivel: false, motivo: impedimento };
        let preferencias;
        try {
          preferencias = paciente.contatoCriptografado
            ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado))
            : preferenciasComunicacaoPadrao();
        } catch { return { ...base, elegivel: false, motivo: 'contato_ilegivel' }; }
        if (!dentroHorarioPermitido(new Date(), preferencias.horarioPermitido)) {
          return { ...base, elegivel: false, motivo: 'fora_horario' };
        }
        const tipos: TipoCanalDireto[] = preferencias.canalPreferido === 'qualquer'
          ? ['whatsapp', 'email'] : [preferencias.canalPreferido];
        for (const tipo of tipos) {
          if (!canalPermitido(preferencias, tipo)) continue;
          const canal = canais.find((item) => item.tipo === tipo && item.ativo);
          const template = templates.find((item) => item.canal === tipo && item.conteudo?.evento === EVENTO_RETORNO && (tipo !== 'whatsapp' || item.aprovado));
          if (canal && template) return { ...base, elegivel: true, canalId: canal.id, templateId: template.id };
        }
        return { ...base, elegivel: false, motivo: 'sem_canal_ou_template_autorizado' };
      }));
    });
  }

  async aprovar(tenantId: string, usuario: UsuarioAutenticado, pacienteIds: string[], loteId: string) {
    const previa = await this.simular(tenantId, usuario, pacienteIds);
    const chaves = pacienteIds.map((id) => `retorno-lote:${loteId}:${id}`);
    const existentes = await this.executorTenant.executar(tenantId, (gerenciador) => gerenciador.getRepository(MensagemNotificacaoOrm).find({
      select: { chaveIdempotencia: true },
      where: chaves.map((chaveIdempotencia) => ({ tenantId, chaveIdempotencia }))
    }));
    const jaEnfileirados = new Set(existentes.map((mensagem) => mensagem.chaveIdempotencia));
    const resultados: Array<{ pacienteId: string; status: 'enfileirada' | 'ignorada'; motivo?: string }> = [];
    for (const item of previa) {
      if (jaEnfileirados.has(`retorno-lote:${loteId}:${item.pacienteId}`) && item.motivo !== 'paciente_indisponivel') {
        resultados.push({ pacienteId: item.pacienteId, status: 'enfileirada' });
        continue;
      }
      if (!item.elegivel || !item.canalId || !item.templateId) {
        resultados.push({ pacienteId: item.pacienteId, status: 'ignorada', motivo: item.motivo });
        continue;
      }
      try {
        const mensagem = await this.comunicacoes.dispararMensagemSistema(tenantId, {
          pacienteId: item.pacienteId,
          canalId: item.canalId,
          templateId: item.templateId,
          chaveIdempotencia: `retorno-lote:${loteId}:${item.pacienteId}`,
          payload: { evento: EVENTO_RETORNO, origem: 'retorno_lote' }
        });
        resultados.push({ pacienteId: item.pacienteId, status: 'enfileirada' });
        try { await this.comunicacoes.publicarEventoNotificacao(tenantId, mensagem.id); } catch { /* outbox duravel */ }
      } catch (erro) {
        if (!(erro instanceof ConflictException)) throw erro;
        resultados.push({ pacienteId: item.pacienteId, status: 'ignorada', motivo: 'condicao_alterada' });
      }
    }
    return { resultados, totalEnfileirado: resultados.filter((item) => item.status === 'enfileirada').length };
  }

  private validarAutorizacao(usuario: UsuarioAutenticado) {
    if (!['Professional', 'SuperAdmin'].includes(usuario.papel) ||
        !usuario.permissoes.includes('pacientes.gerenciar') ||
        !usuario.permissoes.includes('comunicacoes.mensagens.enviar')) throw new ForbiddenException();
  }

  private async historicoConsultas(gerenciador: EntityManager, tenantId: string, ids: string[]): Promise<Map<string, Date[]>> {
    const mapa = new Map<string, Date[]>();
    if (!ids.length) return mapa;
    const linhas = await gerenciador.query(`
      SELECT paciente_id AS "pacienteId", fim_em AS "fimEm" FROM (
        SELECT paciente_id, fim_em, row_number() OVER (PARTITION BY paciente_id ORDER BY fim_em DESC) AS posicao
        FROM agenda_consultas WHERE tenant_id = $1 AND paciente_id = ANY($2::uuid[]) AND status = 'concluida'
      ) consultas WHERE posicao <= 4 ORDER BY "pacienteId", "fimEm" DESC
    `, [tenantId, ids]) as Array<{ pacienteId: string; fimEm: Date | string }>;
    for (const linha of linhas) mapa.set(linha.pacienteId, [...(mapa.get(linha.pacienteId) ?? []), new Date(linha.fimEm)]);
    return mapa;
  }

  private sugerirData(consultas: Date[]): Pick<ItemRetorno, 'intervaloDias' | 'dataSugerida'> {
    if (consultas.length < 2) return {};
    const diaClinico = (data: Date) => {
      const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(data);
      const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '0';
      return `${valor('year')}-${valor('month')}-${valor('day')}`;
    };
    const dias = consultas.map((data) => Date.parse(`${diaClinico(data)}T00:00:00Z`) / 86_400_000);
    const intervalos = dias.slice(0, 3).map((dia, indice) => dia - dias[indice + 1]).filter((valor) => valor > 0).sort((a, b) => a - b);
    if (!intervalos.length) return {};
    const meio = Math.floor(intervalos.length / 2);
    const mediana = Math.round(intervalos.length % 2 ? intervalos[meio] : (intervalos[meio - 1] + intervalos[meio]) / 2);
    return { intervaloDias: mediana, dataSugerida: new Date((dias[0] + mediana) * 86_400_000).toISOString().slice(0, 10) };
  }
}
