import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { EntityManager, In, IsNull, Like } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import { CompartilhamentoReceitaNutricionalOrm } from '../infraestrutura/compartilhamento-receita-nutricional.orm';
import { CanalEntregaReceita, EntregaCompartilhamentoReceitaOrm } from '../infraestrutura/entrega-compartilhamento-receita.orm';
import { PreferenciaCompartilhamentoReceitaOrm } from '../infraestrutura/preferencia-compartilhamento-receita.orm';
import { SubscriptionPushPacienteOrm } from '../infraestrutura/subscription-push-paciente.orm';
import { CompartilharReceitasNutricionaisDto, AtualizarConsentimentoReceitasDto, CriarSubscriptionPushDto, RevogarSubscriptionPushDto } from './dtos-compartilhamento-receita';
import { resumirAlimentosDaReceita } from '../dominio/receitas-nutricionais';
import { lerConteudoReceita, projetarConteudoReceitaPaciente } from '../dominio/conteudo-receita';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';

import { ServicoPorcionamentoReceita } from './servico-porcionamento-receita';
import { hashPedidoCompartilhamento, lerSnapshotCompartilhamentoReceita, normalizarInstrucoesReceita, projetarSnapshotCompartilhamentoPaciente, quantidadesOriginaisReceita, validarPedidoCompartilhamento, type SnapshotCompartilhamentoReceita } from './snapshot-compartilhamento-receita';

const CANAIS_EXTERNOS = ['email', 'whatsapp', 'push'] as const;

@Injectable()
export class ServicoCompartilhamentoReceitas {
  constructor(private readonly executorTenant: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis, private readonly porcionamento: ServicoPorcionamentoReceita) {}

  async compartilhar(tenantId: string, usuario: UsuarioAutenticado, entrada: CompartilharReceitasNutricionaisDto) {
    this.garantirProfissional(usuario);
    const dados = validarPedidoCompartilhamento(entrada);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      // Ordem: chave da intenção, paciente, preferências, receitas por UUID, shares.
      await gerenciador.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`receita-share-request:${tenantId}:${dados.chaveIdempotencia}`]);
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, id: dados.pacienteId, arquivadoEm: IsNull() }, lock: { mode: 'pessimistic_write' }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
      if (!paciente.usuarioId) throw new BadRequestException('O paciente precisa ter acesso ao portal antes de receber receitas.');
      const profissionalId = usuario.papel === 'Professional' ? await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario) : undefined;
      if (usuario.papel !== 'SuperAdmin' && paciente.profissionalResponsavelId !== profissionalId) throw new NotFoundException('Paciente nao encontrado.');
      const preferencia = await gerenciador.getRepository(PreferenciaCompartilhamentoReceitaOrm).findOne({ where: { tenantId, pacienteId: paciente.id }, lock: { mode: 'pessimistic_read' } });
      for (const canal of dados.canais.filter((item): item is (typeof CANAIS_EXTERNOS)[number] => CANAIS_EXTERNOS.includes(item as (typeof CANAIS_EXTERNOS)[number]))) {
        if (!this.consentido(preferencia, canal)) throw new ForbiddenException(`O paciente nao autorizou avisos por ${canal}.`);
        if (!this.possuiContato(paciente, canal)) throw new BadRequestException(`O paciente nao possui contato atual para ${canal}.`);
        if (canal === 'push' && !await gerenciador.getRepository(SubscriptionPushPacienteOrm).count({ where: { tenantId, pacienteId: paciente.id, usuarioId: paciente.usuarioId, revogadaEm: IsNull() } })) {
          throw new BadRequestException('O paciente nao possui dispositivo push ativo.');
        }
      }
      const repositorioReceitas = gerenciador.getRepository(ReceitaNutricionalOrm);
      const repositorioShares = gerenciador.getRepository(CompartilhamentoReceitaNutricionalOrm);
      const receitas = await repositorioReceitas.find({ where: { tenantId, id: In([...dados.receitaIds].sort()), arquivadoEm: IsNull() }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      if (receitas.length !== dados.receitaIds.length || receitas.some(r => r.origem === 'pessoal' && r.profissionalId !== profissionalId && usuario.papel !== 'SuperAdmin')) {
        throw new NotFoundException('Uma ou mais receitas nao foram encontradas.');
      }
      // A chave vale para o lote inteiro, inclusive troca completa dos IDs.
      const existentes = await repositorioShares.find({ where: { tenantId, idempotencia: Like(`${dados.chaveIdempotencia}:%`) }, order: { receitaId: 'ASC' } });
      if (existentes.length) return this.repetirCompartilhamento(gerenciador, tenantId, usuario, dados, existentes);
      const agendadoPara = dados.agendadoPara ? new Date(dados.agendadoPara) : new Date();
      if (dados.agendadoPara && agendadoPara.getTime() < Date.now() + 60_000) throw new BadRequestException('O agendamento deve ocorrer pelo menos um minuto no futuro.');
      const versoes = new Map(dados.versoesEsperadas.map(x => [x.receitaId, x.versao]));
      const originais = new Map<string, string>();
      const snapshots = new Map<string, SnapshotCompartilhamentoReceita>();
      for (const receita of receitas) {
        if (versoes.get(receita.id) !== (receita.versaoAtual ?? 1)) throw new ConflictException('Uma receita foi alterada depois da revisao. Atualize a biblioteca e confirme novamente.');
        if (!receita.categoria) throw new BadRequestException('Classifique a receita antes de compartilhar.');
        let conteudoReceita: ReturnType<typeof lerConteudoReceita>;
        try { conteudoReceita = lerConteudoReceita(JSON.parse(this.criptografia.descriptografar(receita.conteudoCriptografado))); }
        catch { throw new BadRequestException('Não foi possível ler a receita.'); }
        const idsCatalogo = resumirAlimentosDaReceita(conteudoReceita);
        if (!idsCatalogo.length && !dados.confirmacaoRevisaoManual) throw new BadRequestException('Confirme a revisao profissional do conteudo manual antes de compartilhar.');
        const p = dados.porcionamentos?.find(x => x.receitaId === receita.id);
        const conteudo = projetarConteudoReceitaPaciente(conteudoReceita);
        const snapshot: SnapshotCompartilhamentoReceita = { nome: this.criptografia.descriptografar(receita.nomeCriptografado), conteudo, versao: receita.versaoAtual ?? 1 };
        if (p) {
          const previa = await this.porcionamento.preverNaTransacao(gerenciador, tenantId, receita.id, usuario, { versaoEsperada: snapshot.versao, porcoesDesejadas: p.porcoesDesejadas });
          if (previa.estado !== 'calculavel' || previa.fingerprint !== p.fingerprintPrevia) throw new ConflictException('A prévia foi alterada ou não está disponível. Confira novamente antes de enviar.');
          const instrucaoOriginal = normalizarInstrucoesReceita(conteudoReceita.instrucoes ?? '');
          originais.set(receita.id, instrucaoOriginal);
          snapshot.conteudo = { ...conteudo, itens: previa.itens, instrucoes: p.instrucoesPersonalizadas ?? instrucaoOriginal };
          snapshot.contextoCompartilhamento = { schemaVersao: 1, hashPedidoCompartilhamento: '', instrucaoOriginal,
            porcionamento: { algoritmo: 'porcionamento-receita-v1', baseQuantidades: previa.baseQuantidades,
              ...(previa.rendimentoOriginalPorcoes === undefined ? {} : { rendimentoOriginalPorcoes: previa.rendimentoOriginalPorcoes }),
              porcoesDesejadas: previa.porcoesDesejadas, fatorExato: previa.fatorExato, fingerprint: previa.fingerprint,
              originais: quantidadesOriginaisReceita(conteudoReceita.itens), fontes: previa.fontes } };
        } else if (idsCatalogo.length) {
          const alimentos = await gerenciador.getRepository(AlimentoComposicaoOrm).find({ where: { id: In(idsCatalogo) } });
          const fontes = alimentos.length ? await gerenciador.getRepository(FonteComposicaoAlimentoOrm).find({ where: { id: In([...new Set(alimentos.map(x => x.fonteId))]), situacao: 'ativa', direitoUsoStatus: 'aprovado' } }) : [];
          const ativos = new Set(alimentos.filter(x => fontes.some(f => f.id === x.fonteId)).map(x => x.id));
          if (idsCatalogo.some(id => !ativos.has(id))) throw new BadRequestException('Revise os alimentos indisponiveis antes de compartilhar.');
        }
        snapshots.set(receita.id, snapshot);
      }
      const hash = hashPedidoCompartilhamento(dados, originais, usuario.usuarioId);
      const shares: CompartilhamentoReceitaNutricionalOrm[] = [];
      const repositorioEntregas = gerenciador.getRepository(EntregaCompartilhamentoReceitaOrm);
      for (const receita of receitas) {
        const snapshot = snapshots.get(receita.id)!;
        snapshot.contextoCompartilhamento ??= { schemaVersao: 1, hashPedidoCompartilhamento: hash };
        snapshot.contextoCompartilhamento.hashPedidoCompartilhamento = hash;
        try { lerSnapshotCompartilhamentoReceita(snapshot); } catch { throw new BadRequestException('Não foi possível preparar a receita para envio.'); }
        if (!dados.agendadoPara) {
          await gerenciador.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`receita-share:${tenantId}:${paciente.id}:${receita.id}`]);
          await repositorioShares.update({ tenantId, pacienteId: paciente.id, receitaId: receita.id, status: 'ativo' }, { status: 'substituido', atualizadoEm: new Date() });
        }
        const salvo = await repositorioShares.save(repositorioShares.create({ tenantId, receitaId: receita.id,
          idempotencia: `${dados.chaveIdempotencia}:${receita.id}`, pacienteId: paciente.id, enviadoPorUsuarioId: usuario.usuarioId,
          versaoOrigem: snapshot.versao, snapshotCriptografado: this.criptografia.criptografar(JSON.stringify(snapshot)),
          status: dados.agendadoPara ? 'agendado' : 'ativo', agendadoPara: dados.agendadoPara ? agendadoPara : null,
          enviadoEm: dados.agendadoPara ? null : new Date() }));
        const canaisEntrega = [...new Set<CanalEntregaReceita>(['portal', ...dados.canais])];
        await repositorioEntregas.save(canaisEntrega.map(canal => repositorioEntregas.create({ tenantId, compartilhamentoId: salvo.id, canal,
          status: canal === 'portal' && !dados.agendadoPara ? 'enviado' : 'pendente', agendadoPara,
          confirmadoEm: canal === 'portal' && !dados.agendadoPara ? new Date() : null, idempotencia: `receita:${salvo.id}:${canal}` })));
        shares.push(salvo);
      }
      await registrarAuditoriaNaTransacao(gerenciador, { tenantId, usuarioId: usuario.usuarioId, acao: 'planos_alimentares.receita_compartilhar',
        recursoTipo: 'compartilhamento_receita', recursoId: paciente.id, metadados: { quantidade: shares.length, canais: dados.canais, agendado: Boolean(dados.agendadoPara) } });
      return { quantidade: shares.length, agendadoPara: dados.agendadoPara ? agendadoPara : null, itens: shares.map(s => ({ id: s.id, receitaId: s.receitaId, status: s.status })) };
    });
  }

  private async repetirCompartilhamento(g: EntityManager, tenantId: string, usuario: UsuarioAutenticado, dados: CompartilharReceitasNutricionaisDto, existentes: CompartilhamentoReceitaNutricionalOrm[]) {
    const conflito = () => new ConflictException('A chave de envio ja foi usada para outra acao.');
    if (existentes.length !== dados.receitaIds.length || existentes.some(s => s.pacienteId !== dados.pacienteId || !dados.receitaIds.includes(s.receitaId))) throw conflito();
    const snapshots = existentes.map(s => this.lerSnapshot(s));
    const contextos = snapshots.map(s => s.contextoCompartilhamento);
    if (contextos.some(Boolean)) {
      const originais = new Map(existentes.map((s, i) => [s.receitaId, contextos[i]?.instrucaoOriginal ?? '']));
      const hash = hashPedidoCompartilhamento(dados, originais, usuario.usuarioId);
      if (contextos.some(c => !c || c.hashPedidoCompartilhamento !== hash)) throw conflito();
    } else {
      if (dados.porcionamentos?.length || existentes.some(s => dados.versoesEsperadas.find(x => x.receitaId === s.receitaId)?.versao !== s.versaoOrigem ||
        (dados.agendadoPara ? s.agendadoPara?.getTime() !== new Date(dados.agendadoPara).getTime() : Boolean(s.agendadoPara)))) throw conflito();
      const entregas = await g.getRepository(EntregaCompartilhamentoReceitaOrm).find({ where: { tenantId, compartilhamentoId: In(existentes.map(s => s.id)) } });
      const canais = [...new Set(['portal', ...dados.canais])].sort().join(',');
      if (existentes.some(s => [...new Set(entregas.filter(e => e.compartilhamentoId === s.id).map(e => e.canal))].sort().join(',') !== canais)) throw conflito();
    }
    return { quantidade: existentes.length, agendadoPara: existentes[0].agendadoPara ?? null, itens: existentes.map(s => ({ id: s.id, receitaId: s.receitaId, status: s.status })) };
  }

  async obterConsentimentoParaEnvio(tenantId: string, usuario: UsuarioAutenticado, pacienteId: string) {
    this.garantirProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, id: pacienteId, arquivadoEm: IsNull() } });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
      const profissionalId = usuario.papel === 'Professional' ? await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario) : undefined;
      if (usuario.papel !== 'SuperAdmin' && paciente.profissionalResponsavelId !== profissionalId) throw new NotFoundException('Paciente nao encontrado.');
      const preferencia = await gerenciador.getRepository(PreferenciaCompartilhamentoReceitaOrm).findOne({ where: { tenantId, pacienteId } });
      return {
        email: preferencia?.emailAtivo === true && Boolean(preferencia.emailConsentidoEm),
        whatsapp: preferencia?.whatsappAtivo === true && Boolean(preferencia.whatsappConsentidoEm),
        push: preferencia?.pushAtivo === true && Boolean(preferencia.pushConsentidoEm)
      };
    });
  }

  async listarEnviosProfissional(tenantId: string, usuario: UsuarioAutenticado, pacienteId: string) {
    this.garantirProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, id: pacienteId, arquivadoEm: IsNull() } });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
      const profissionalId = usuario.papel === 'Professional' ? await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario) : undefined;
      if (usuario.papel !== 'SuperAdmin' && paciente.profissionalResponsavelId !== profissionalId) throw new NotFoundException('Paciente nao encontrado.');
      const compartilhamentos = await gerenciador.getRepository(CompartilhamentoReceitaNutricionalOrm).find({
        where: { tenantId, pacienteId }, order: { criadoEm: 'DESC', id: 'DESC' }, take: 100
      });
      const entregas = compartilhamentos.length ? await gerenciador.getRepository(EntregaCompartilhamentoReceitaOrm).find({
        where: { tenantId, compartilhamentoId: In(compartilhamentos.map((share) => share.id)) }, order: { canal: 'ASC' }
      }) : [];
      const entregasPorShare = new Map<string, EntregaCompartilhamentoReceitaOrm[]>();
      for (const entrega of entregas) entregasPorShare.set(entrega.compartilhamentoId, [...(entregasPorShare.get(entrega.compartilhamentoId) ?? []), entrega]);
      return compartilhamentos.map((share) => {
        const snapshot = this.lerSnapshot(share);
        return {
          id: share.id, receitaId: share.receitaId, nome: snapshot.nome, versao: share.versaoOrigem,
          status: share.status, agendadoPara: share.agendadoPara ?? null, enviadoEm: share.enviadoEm ?? null,
          retiradoEm: share.retiradoEm ?? null, visualizadoEm: share.visualizadoEm ?? null,
          entregas: (entregasPorShare.get(share.id) ?? []).map((entrega) => ({ canal: entrega.canal, status: entrega.status, agendadoPara: entrega.agendadoPara, confirmadoEm: entrega.confirmadoEm ?? null }))
        };
      });
    });
  }

  async atualizarConsentimento(tenantId: string, usuario: UsuarioAutenticado, dados: AtualizarConsentimentoReceitasDto) {
    this.garantirPaciente(usuario);
    if (dados.push && (!process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || !process.env.WEB_PUSH_VAPID_SUBJECT?.trim())) {
      throw new BadRequestException('Avisos push nao estao configurados para este servico.');
    }
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.pacienteDoUsuario(gerenciador, tenantId, usuario.usuarioId, true);
      const repo = gerenciador.getRepository(PreferenciaCompartilhamentoReceitaOrm);
      let preferencias = await repo.findOne({ where: { tenantId, pacienteId: paciente.id } });
      const agora = new Date();
      preferencias ??= repo.create({ tenantId, pacienteId: paciente.id });
      for (const canal of CANAIS_EXTERNOS) {
        const campo = `${canal}Ativo` as 'emailAtivo' | 'whatsappAtivo' | 'pushAtivo';
        const consentido = `${canal}ConsentidoEm` as 'emailConsentidoEm' | 'whatsappConsentidoEm' | 'pushConsentidoEm';
        const revogado = `${canal}RevogadoEm` as 'emailRevogadoEm' | 'whatsappRevogadoEm' | 'pushRevogadoEm';
        if (dados[canal] && !preferencias[campo]) preferencias[consentido] = agora;
        if (!dados[canal] && preferencias[campo]) preferencias[revogado] = agora;
        preferencias[campo] = dados[canal];
      }
      await repo.save(preferencias);
      if (!dados.push) await gerenciador.getRepository(SubscriptionPushPacienteOrm).update({ tenantId, pacienteId: paciente.id, revogadaEm: IsNull() }, { revogadaEm: agora });
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId, usuarioId: usuario.usuarioId, acao: 'portal.paciente.receita_compartilhada.consentimento_atualizar',
        recursoTipo: 'preferencia_compartilhamento_receita', recursoId: paciente.id,
        metadados: { email: dados.email, whatsapp: dados.whatsapp, push: dados.push }
      });
      return { email: preferencias.emailAtivo, whatsapp: preferencias.whatsappAtivo, push: preferencias.pushAtivo };
    });
  }

  async obterConsentimento(tenantId: string, usuario: UsuarioAutenticado) {
    this.garantirPaciente(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.pacienteDoUsuario(gerenciador, tenantId, usuario.usuarioId);
      const row = await gerenciador.getRepository(PreferenciaCompartilhamentoReceitaOrm).findOne({ where: { tenantId, pacienteId: paciente.id } });
      return { email: row?.emailAtivo ?? false, whatsapp: row?.whatsappAtivo ?? false, push: row?.pushAtivo ?? false };
    });
  }

  async registrarSubscriptionPush(tenantId: string, usuario: UsuarioAutenticado, dados: CriarSubscriptionPushDto) {
    this.garantirPaciente(usuario);
    const subscription = dados.subscription;
    let endpoint: URL | undefined;
    try { endpoint = new URL(subscription?.endpoint ?? ''); } catch { endpoint = undefined; }
    const hostPushConhecido = endpoint && [
      'fcm.googleapis.com', 'push.apple.com', 'notify.windows.com', 'push.services.mozilla.com'
    ].some((host) => endpoint!.hostname === host || endpoint!.hostname.endsWith(`.${host}`));
    if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048 ||
        !endpoint || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
        (endpoint.port && endpoint.port !== '443') || !hostPushConhecido || typeof subscription.keys?.p256dh !== 'string' ||
        typeof subscription.keys?.auth !== 'string' || subscription.keys.p256dh.length > 256 || subscription.keys.auth.length > 256) {
      throw new BadRequestException('Subscription push invalida.');
    }
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.pacienteDoUsuario(gerenciador, tenantId, usuario.usuarioId);
      if (dados.pacienteId !== paciente.id) throw new NotFoundException('Paciente nao encontrado.');
      const preferencias = await gerenciador.getRepository(PreferenciaCompartilhamentoReceitaOrm).findOne({ where: { tenantId, pacienteId: paciente.id } });
      if (!preferencias?.pushAtivo) throw new ForbiddenException('Ative o consentimento de avisos push antes de registrar o dispositivo.');
      const endpointHash = createHash('sha256').update(subscription.endpoint).digest('hex');
      const repo = gerenciador.getRepository(SubscriptionPushPacienteOrm);
      await repo.update({ tenantId, endpointHash, revogadaEm: IsNull() }, { revogadaEm: new Date() });
      const salva = await repo.save(repo.create({ tenantId, pacienteId: paciente.id, usuarioId: usuario.usuarioId, endpointHash, endpointCriptografado: this.criptografia.criptografar(JSON.stringify(subscription)) }));
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId, usuarioId: usuario.usuarioId, acao: 'portal.paciente.receita_compartilhada.push_registrar',
        recursoTipo: 'subscription_push_paciente', recursoId: salva.id, metadados: { canal: 'push' }
      });
      return { id: salva.id };
    });
  }

  async revogarSubscriptionPush(tenantId: string, usuario: UsuarioAutenticado, dados: RevogarSubscriptionPushDto) {
    this.garantirPaciente(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.pacienteDoUsuario(gerenciador, tenantId, usuario.usuarioId);
      const repo = gerenciador.getRepository(SubscriptionPushPacienteOrm);
      const filtro = { tenantId, pacienteId: paciente.id, usuarioId: usuario.usuarioId, revogadaEm: IsNull() };
      const resultado = dados.endpoint
        ? await repo.update({ ...filtro, endpointHash: createHash('sha256').update(dados.endpoint).digest('hex') }, { revogadaEm: new Date() })
        : await repo.update(filtro, { revogadaEm: new Date() });
      if (resultado.affected) await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId, usuarioId: usuario.usuarioId, acao: 'portal.paciente.receita_compartilhada.push_revogar',
        recursoTipo: 'subscription_push_paciente', recursoId: paciente.id, metadados: { canal: 'push' }
      });
      return { revogado: Boolean(resultado.affected) };
    });
  }

  async listarPortal(tenantId: string, usuario: UsuarioAutenticado) {
    this.garantirPaciente(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.pacienteDoUsuario(gerenciador, tenantId, usuario.usuarioId);
      const shares = await gerenciador.getRepository(CompartilhamentoReceitaNutricionalOrm).find({ where: { tenantId, pacienteId: paciente.id, status: 'ativo' }, order: { enviadoEm: 'DESC', criadoEm: 'DESC' }, take: 100 });
      return shares.map((share) => {
        const snapshot = this.lerSnapshot(share);
        return { id: share.id, nome: snapshot.nome, enviadoEm: share.enviadoEm, visualizadoEm: share.visualizadoEm };
      });
    });
  }

  async obterPortal(tenantId: string, usuario: UsuarioAutenticado, shareId: string) {
    this.garantirPaciente(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.pacienteDoUsuario(gerenciador, tenantId, usuario.usuarioId);
      const repo = gerenciador.getRepository(CompartilhamentoReceitaNutricionalOrm);
      const share = await repo.findOne({ where: { tenantId, pacienteId: paciente.id, id: shareId, status: 'ativo' }, lock: { mode: 'pessimistic_write' } });
      if (!share) throw new NotFoundException('Receita compartilhada nao encontrada.');
      const snapshot = this.snapshotPaciente(share);
      if (!share.visualizadoEm) {
        share.visualizadoEm = new Date();
        await repo.save(share);
        await registrarAuditoriaNaTransacao(gerenciador, {
          tenantId, usuarioId: usuario.usuarioId, acao: 'portal.paciente.receita_compartilhada.visualizar',
          recursoTipo: 'compartilhamento_receita', recursoId: share.id, metadados: { primeiraLeitura: true }
        });
      }
      return { id: share.id, enviadoEm: share.enviadoEm, receita: snapshot };
    });
  }

  async retirar(tenantId: string, usuario: UsuarioAutenticado, shareId: string) {
    this.garantirProfissional(usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repo = gerenciador.getRepository(CompartilhamentoReceitaNutricionalOrm);
      // Descobrir o vínculo sem bloquear share; adquirir paciente antes de share,
      // como no envio, e reler o recurso após revalidar a carteira.
      const referencia = await repo.findOne({ where: { tenantId, id: shareId, status: In(['ativo', 'agendado']) as never }, select: { id: true, pacienteId: true } });
      if (!referencia) throw new NotFoundException('Compartilhamento nao encontrado.');
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, id: referencia.pacienteId }, lock: { mode: 'pessimistic_write' } });
      const profissionalId = usuario.papel === 'Professional' ? await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario) : undefined;
      if (!paciente || (usuario.papel !== 'SuperAdmin' && paciente.profissionalResponsavelId !== profissionalId)) throw new NotFoundException('Compartilhamento nao encontrado.');
      const share = await repo.findOne({ where: { tenantId, id: shareId, pacienteId: paciente.id, status: In(['ativo', 'agendado']) as never }, lock: { mode: 'pessimistic_write' } });
      if (!share) throw new NotFoundException('Compartilhamento nao encontrado.');
      share.status = 'retirado';
      share.retiradoEm = new Date();
      await repo.save(share);
      await gerenciador.getRepository(EntregaCompartilhamentoReceitaOrm).update(
        { tenantId, compartilhamentoId: share.id, status: 'pendente' },
        { status: 'cancelado' }
      );
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId, usuarioId: usuario.usuarioId, acao: 'planos_alimentares.receita_retirar_compartilhamento',
        recursoTipo: 'compartilhamento_receita', recursoId: paciente!.id, metadados: { quantidade: 1 }
      });
      return { id: share.id, status: share.status, retiradoEm: share.retiradoEm };
    });
  }

  chavePublicaPush(): { chavePublica: string | null } {
    const configurado = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() && process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
    return { chavePublica: configurado ? process.env.WEB_PUSH_VAPID_PUBLIC_KEY!.trim() : null };
  }

  private lerSnapshot(share: CompartilhamentoReceitaNutricionalOrm) {
    try { return lerSnapshotCompartilhamentoReceita(JSON.parse(this.criptografia.descriptografar(share.snapshotCriptografado))); }
    catch { throw new BadRequestException('Não foi possível ler a receita compartilhada.'); }
  }

  private snapshotPaciente(share: CompartilhamentoReceitaNutricionalOrm) {
    return projetarSnapshotCompartilhamentoPaciente(this.lerSnapshot(share));
  }

  private async pacienteDoUsuario(gerenciador: EntityManager, tenantId: string, usuarioId: string, bloquear = false) {
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, usuarioId, arquivadoEm: IsNull() }, ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');
    return paciente;
  }

  private consentido(preferencias: PreferenciaCompartilhamentoReceitaOrm | null, canal: CanalEntregaReceita) {
    if (canal === 'email') return preferencias?.emailAtivo === true && Boolean(preferencias.emailConsentidoEm);
    if (canal === 'whatsapp') return preferencias?.whatsappAtivo === true && Boolean(preferencias.whatsappConsentidoEm);
    if (canal === 'push') return preferencias?.pushAtivo === true && Boolean(preferencias.pushConsentidoEm);
    return canal === 'portal';
  }

  private possuiContato(paciente: PacienteOrm, canal: CanalEntregaReceita) {
    if (canal === 'push') return Boolean(paciente.usuarioId);
    if (!paciente.contatoCriptografado) return false;
    try {
      const valor = this.criptografia.descriptografar(paciente.contatoCriptografado);
      const contato = JSON.parse(valor) as Record<string, unknown>;
      return typeof contato[canal] === 'string' && Boolean((contato[canal] as string).trim());
    } catch {
      return canal === 'email' && paciente.contatoCriptografado.length > 0;
    }
  }

  private garantirProfissional(usuario: UsuarioAutenticado) {
    if (!['Professional', 'SuperAdmin'].includes(usuario.papel) || (usuario.papel === 'Professional' && !usuario.permissoes.includes('planos_alimentares.gerenciar'))) {
      throw new ForbiddenException('Usuario sem permissao para compartilhar receitas.');
    }
  }

  private garantirPaciente(usuario: UsuarioAutenticado) {
    if (usuario.papel !== 'Patient') throw new ForbiddenException('Acesso exclusivo ao portal do paciente.');
  }

}
