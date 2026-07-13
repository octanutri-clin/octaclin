'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Inbox, Mail, MessageCircle, Plus, RefreshCcw, Reply, Save, Send } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  CanalNotificacaoApi,
  MensagemNotificacaoApi,
  TemplateMensagemApi,
  TipoCanalNotificacao,
  carregarBootstrapComunicacoes,
  criarCanal,
  criarTemplate,
  dispararMensagem
} from '@/lib/comunicacoes-api';
import { PacienteResumo, RespostaPaginada } from '@/lib/cadastros-api';

interface UltimoStatusMeta {
  status?: string;
  timestamp?: string;
  recipientId?: string;
  errors?: unknown[];
}

interface FormularioCanal {
  tipo: TipoCanalNotificacao;
  nome: string;
  identificador: string;
  ativo: boolean;
}

interface FormularioTemplate {
  canal: TipoCanalNotificacao;
  codigoExterno: string;
  nome: string;
  assunto: string;
  corpo: string;
  aprovado: boolean;
}

interface FormularioMensagem {
  pacienteId: string;
  canalId: string;
  templateId: string;
  destino: string;
  observacao: string;
}

interface ConversaWhatsapp {
  id: string;
  titulo: string;
  contato: string;
  pacienteId?: string;
  ultimaMensagem: string;
  ultimaData?: string;
  total: number;
  recebidas: number;
  enviadas: number;
  pendentes: number;
  mensagens: MensagemNotificacaoApi[];
}

const canalInicial: FormularioCanal = {
  tipo: 'email',
  nome: 'Email transacional',
  identificador: 'OctaClin <octaclinsys@gmail.com>',
  ativo: true
};

const templateInicial: FormularioTemplate = {
  canal: 'email',
  codigoExterno: '',
  nome: 'Lembrete de check-in',
  assunto: 'Seu check-in OctaClin',
  corpo: 'Ola {{nome}}, seu check-in esta disponivel.',
  aprovado: true
};

const mensagemInicial: FormularioMensagem = {
  pacienteId: '',
  canalId: '',
  templateId: '',
  destino: 'octaclinsys@gmail.com',
  observacao: 'Disparo manual pelo console OctaClin.'
};

function iconeCanal(tipo: TipoCanalNotificacao) {
  if (tipo === 'whatsapp') return MessageCircle;
  if (tipo === 'push') return Bell;
  return Mail;
}

function montarConfiguracao(formulario: FormularioCanal): Record<string, unknown> {
  if (formulario.tipo === 'whatsapp') return { phoneNumberId: formulario.identificador };
  if (formulario.tipo === 'push') return { appId: formulario.identificador };
  return { remetente: formulario.identificador };
}

function montarConteudo(formulario: FormularioTemplate): Record<string, unknown> {
  if (formulario.canal === 'email') return { assunto: formulario.assunto, corpo: formulario.corpo };
  return { corpo: formulario.corpo };
}

function pacientePorId(pacientes: PacienteResumo[], id: string) {
  return pacientes.find((paciente) => paciente.id === id);
}

function obterTextoPayload(payload: Record<string, unknown>, chave: string) {
  const valor = payload[chave];
  return typeof valor === 'string' && valor.trim() ? valor : undefined;
}

function obterUltimoStatusMeta(payload: Record<string, unknown>): UltimoStatusMeta | undefined {
  const status = payload.ultimoStatusMeta;
  if (!status || typeof status !== 'object' || Array.isArray(status)) return undefined;
  return status as UltimoStatusMeta;
}

function obterDirecaoMensagem(mensagem: MensagemNotificacaoApi) {
  return obterTextoPayload(mensagem.payload, 'direcao') ?? (mensagem.status === 'recebido' ? 'recebida' : 'enviada');
}

function formatarStatusMeta(status?: string) {
  if (!status) return 'Aguardando Meta';

  const mapa: Record<string, string> = {
    accepted: 'Aceito',
    sent: 'Enviado',
    delivered: 'Entregue',
    read: 'Lido',
    failed: 'Falhou'
  };

  return mapa[status] ?? status;
}

function formatarDataIso(data?: string) {
  if (!data) return undefined;
  const dataFormatada = new Date(data);
  if (Number.isNaN(dataFormatada.getTime())) return undefined;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dataFormatada);
}

function obterTimestamp(data?: string) {
  if (!data) return 0;
  const timestamp = new Date(data).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function nomeCanal(canais: CanalNotificacaoApi[], mensagem: MensagemNotificacaoApi) {
  return canais.find((canal) => canal.id === mensagem.canalId)?.nome ?? 'Canal removido';
}

function obterCanal(canais: CanalNotificacaoApi[], mensagem: MensagemNotificacaoApi) {
  return canais.find((canal) => canal.id === mensagem.canalId);
}

function nomeTemplate(templates: TemplateMensagemApi[], mensagem: MensagemNotificacaoApi) {
  if (obterDirecaoMensagem(mensagem) === 'recebida') return 'Mensagem recebida';
  return templates.find((template) => template.id === mensagem.templateId)?.nome ?? 'Template removido';
}

function corStatusMensagem(status: MensagemNotificacaoApi['status']) {
  if (status === 'recebido') return 'border-[#c6d8bf] bg-[#f2f8ef] text-[#3d6730]';
  if (status === 'enviado') return 'border-[#b8dfc1] bg-[#eef7f0] text-[#245b33]';
  if (status === 'falhou') return 'border-[#f1b3b3] bg-[#fff0f0] text-[#8c2f2f]';
  if (status === 'processando') return 'border-[#bcd4f6] bg-[#eef5ff] text-[#2d5282]';
  return 'border-linha bg-[#eef3f6] text-[#596273]';
}

function corStatusMeta(status?: string) {
  if (status === 'delivered' || status === 'read') return 'border-[#b8dfc1] bg-[#eef7f0] text-[#245b33]';
  if (status === 'failed') return 'border-[#f1b3b3] bg-[#fff0f0] text-[#8c2f2f]';
  if (status === 'sent' || status === 'accepted') return 'border-[#bcd4f6] bg-[#eef5ff] text-[#2d5282]';
  return 'border-linha bg-white text-[#596273]';
}

function obterContatoMensagem(mensagem: MensagemNotificacaoApi, ultimoStatusMeta?: UltimoStatusMeta) {
  if (obterDirecaoMensagem(mensagem) === 'recebida') {
    return obterTextoPayload(mensagem.payload, 'remetente') ?? 'Remetente nao informado';
  }

  return obterTextoPayload(mensagem.payload, 'destino') ?? ultimoStatusMeta?.recipientId ?? 'Destino nao informado';
}

function resumirMensagem(mensagem: MensagemNotificacaoApi, templates: TemplateMensagemApi[]) {
  if (obterDirecaoMensagem(mensagem) === 'recebida') {
    return obterTextoPayload(mensagem.payload, 'texto') ?? obterTextoPayload(mensagem.payload, 'tipo') ?? 'Mensagem recebida';
  }

  return obterTextoPayload(mensagem.payload, 'observacao') ?? nomeTemplate(templates, mensagem);
}

function nomePaciente(pacientes: PacienteResumo[], pacienteId?: string) {
  return pacientes.find((paciente) => paciente.id === pacienteId)?.nome;
}

function montarConversasWhatsapp(
  mensagens: MensagemNotificacaoApi[],
  canais: CanalNotificacaoApi[],
  templates: TemplateMensagemApi[],
  pacientes: PacienteResumo[]
): ConversaWhatsapp[] {
  const grupos = new Map<string, ConversaWhatsapp & { ultimaOrdenacao: number }>();

  for (const mensagem of mensagens) {
    const canal = obterCanal(canais, mensagem);
    if (canal?.tipo !== 'whatsapp' && mensagem.payload.origem !== 'whatsapp') continue;

    const ultimoStatusMeta = obterUltimoStatusMeta(mensagem.payload);
    const contato = obterContatoMensagem(mensagem, ultimoStatusMeta);
    const chave = mensagem.pacienteId ?? contato;
    const dataOrdenacao = new Date(mensagem.criadoEm).getTime();
    const conversa = grupos.get(chave);
    const recebida = obterDirecaoMensagem(mensagem) === 'recebida';
    const titulo = nomePaciente(pacientes, mensagem.pacienteId) ?? (recebida ? 'Contato WhatsApp' : 'Paciente sem vinculo');

    if (!conversa) {
      grupos.set(chave, {
        id: chave,
        titulo,
        contato,
        pacienteId: mensagem.pacienteId,
        ultimaMensagem: resumirMensagem(mensagem, templates),
        ultimaData: formatarDataIso(mensagem.criadoEm),
        total: 1,
        recebidas: recebida ? 1 : 0,
        enviadas: recebida ? 0 : 1,
        pendentes: mensagem.status === 'falhou' ? 1 : 0,
        mensagens: [mensagem],
        ultimaOrdenacao: dataOrdenacao
      });
      continue;
    }

    conversa.total += 1;
    conversa.recebidas += recebida ? 1 : 0;
    conversa.enviadas += recebida ? 0 : 1;
    conversa.pendentes += mensagem.status === 'falhou' ? 1 : 0;
    conversa.mensagens.push(mensagem);
    if (!conversa.pacienteId && mensagem.pacienteId) conversa.pacienteId = mensagem.pacienteId;
    if (dataOrdenacao > conversa.ultimaOrdenacao) {
      conversa.ultimaMensagem = resumirMensagem(mensagem, templates);
      conversa.ultimaData = formatarDataIso(mensagem.criadoEm);
      conversa.ultimaOrdenacao = dataOrdenacao;
    }
  }

  return [...grupos.values()]
    .sort((a, b) => b.ultimaOrdenacao - a.ultimaOrdenacao)
    .map(({ ultimaOrdenacao: _ultimaOrdenacao, ...conversa }) => ({
      ...conversa,
      mensagens: conversa.mensagens.sort((a, b) => obterTimestamp(a.criadoEm) - obterTimestamp(b.criadoEm))
    }));
}

export function PainelComunicacoes() {
  const [canais, setCanais] = useState<CanalNotificacaoApi[]>([]);
  const [templates, setTemplates] = useState<TemplateMensagemApi[]>([]);
  const [mensagens, setMensagens] = useState<MensagemNotificacaoApi[]>([]);
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [formularioCanal, setFormularioCanal] = useState<FormularioCanal>(canalInicial);
  const [formularioTemplate, setFormularioTemplate] = useState<FormularioTemplate>(templateInicial);
  const [formularioMensagem, setFormularioMensagem] = useState<FormularioMensagem>(mensagemInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState<string | null>(null);
  const [filtroConversas, setFiltroConversas] = useState<'todas' | 'recebidas' | 'falhas'>('todas');

  const templatesCompativeis = useMemo(
    () => templates.filter((template) => template.canal === canais.find((canal) => canal.id === formularioMensagem.canalId)?.tipo),
    [canais, formularioMensagem.canalId, templates]
  );
  const canalMensagemSelecionado = useMemo(
    () => canais.find((canal) => canal.id === formularioMensagem.canalId),
    [canais, formularioMensagem.canalId]
  );
  const templateMensagemSelecionado = useMemo(
    () => templates.find((template) => template.id === formularioMensagem.templateId),
    [formularioMensagem.templateId, templates]
  );
  const conversasWhatsapp = useMemo(
    () => montarConversasWhatsapp(mensagens, canais, templates, pacientes?.itens ?? []),
    [canais, mensagens, pacientes?.itens, templates]
  );
  const conversasFiltradas = useMemo(() => {
    if (filtroConversas === 'recebidas') return conversasWhatsapp.filter((conversa) => conversa.recebidas > 0);
    if (filtroConversas === 'falhas') return conversasWhatsapp.filter((conversa) => conversa.pendentes > 0);
    return conversasWhatsapp;
  }, [conversasWhatsapp, filtroConversas]);
  const conversaSelecionada = useMemo(
    () => conversasWhatsapp.find((conversa) => conversa.id === conversaSelecionadaId) ?? conversasFiltradas[0],
    [conversaSelecionadaId, conversasFiltradas, conversasWhatsapp]
  );

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const bootstrap = await carregarBootstrapComunicacoes();
      setCanais(bootstrap.canais);
      setTemplates(bootstrap.templates);
      setMensagens(bootstrap.mensagens);
      setPacientes(bootstrap.pacientes);
      setFormularioMensagem((atual) => ({
        ...atual,
        pacienteId: atual.pacienteId || bootstrap.pacientes.itens[0]?.id || '',
        canalId: atual.canalId || bootstrap.canais[0]?.id || '',
        templateId: atual.templateId || bootstrap.templates[0]?.id || ''
      }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar comunicacoes.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvarCanal(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarCanal({
        tipo: formularioCanal.tipo,
        nome: formularioCanal.nome.trim(),
        configuracao: montarConfiguracao(formularioCanal),
        ativo: formularioCanal.ativo
      });
      setCanais((atuais) => [criado, ...atuais]);
      setFormularioMensagem((atual) => ({ ...atual, canalId: criado.id, templateId: '' }));
      setSucesso('Canal criado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar canal.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTemplate(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarTemplate({
        canal: formularioTemplate.canal,
        codigoExterno: formularioTemplate.codigoExterno.trim() || undefined,
        nome: formularioTemplate.nome.trim(),
        conteudo: montarConteudo(formularioTemplate),
        aprovado: formularioTemplate.aprovado
      });
      setTemplates((atuais) => [criado, ...atuais]);
      setFormularioMensagem((atual) => ({ ...atual, templateId: criado.id }));
      setSucesso('Template criado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar template.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarMensagem(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const paciente = pacientePorId(pacientes?.itens ?? [], formularioMensagem.pacienteId);
      const mensagem = await dispararMensagem({
        pacienteId: formularioMensagem.pacienteId,
        canalId: formularioMensagem.canalId,
        templateId: formularioMensagem.templateId,
        payload: {
          destino: formularioMensagem.destino.trim(),
          ...(canalMensagemSelecionado?.tipo === 'whatsapp' && typeof templateMensagemSelecionado?.conteudo.idioma === 'string'
            ? { idioma: templateMensagemSelecionado.conteudo.idioma }
            : {}),
          nome: paciente?.nome ?? 'Paciente',
          observacao: formularioMensagem.observacao
        }
      });
      setMensagens((atuais) => [mensagem, ...atuais].slice(0, 200));
      setSucesso(`Mensagem criada com status ${mensagem.status}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao disparar mensagem.');
    } finally {
      setSalvando(false);
    }
  }

  function prepararRespostaWhatsapp(conversa: ConversaWhatsapp) {
    const canalWhatsapp = canais.find((canal) => canal.tipo === 'whatsapp' && canal.ativo);
    const templateWhatsapp =
      templates.find((template) => template.canal === 'whatsapp' && template.aprovado && template.codigoExterno === 'hello_world') ??
      templates.find((template) => template.canal === 'whatsapp' && template.aprovado);
    const pacienteId = conversa.pacienteId ?? formularioMensagem.pacienteId;

    setFormularioMensagem((atual) => ({
      ...atual,
      pacienteId,
      canalId: canalWhatsapp?.id ?? atual.canalId,
      templateId: templateWhatsapp?.id ?? atual.templateId,
      destino: conversa.contato,
      observacao: `Resposta manual para ${conversa.titulo}.`
    }));
    setSucesso('Conversa preparada no disparo manual.');
  }

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    if (!conversaSelecionadaId && conversasWhatsapp[0]) {
      setConversaSelecionadaId(conversasWhatsapp[0].id);
    }
  }, [conversaSelecionadaId, conversasWhatsapp]);

  useEffect(() => {
    if (!templatesCompativeis.some((template) => template.id === formularioMensagem.templateId)) {
      setFormularioMensagem((atual) => ({ ...atual, templateId: templatesCompativeis[0]?.id ?? '' }));
    }
  }, [formularioMensagem.templateId, templatesCompativeis]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Comunicacoes</h2>
          <p className="mt-1 text-sm text-[#596273]">
            {canais.length} canais, {templates.length} templates, {mensagens.length} mensagens persistidas
          </p>
        </div>
        <Botao onClick={carregar} disabled={carregando}>
          <RefreshCcw size={16} />
          {carregando ? 'Atualizando' : 'Atualizar'}
        </Botao>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <BarraCarregamento visivel={carregando} />
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={salvarCanal} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Novo canal</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Rotulo htmlFor="canal-tipo">Tipo</Rotulo>
              <Selecao
                id="canal-tipo"
                value={formularioCanal.tipo}
                onChange={(evento) =>
                  setFormularioCanal((atual) => ({ ...atual, tipo: evento.target.value as TipoCanalNotificacao }))
                }
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="push">Push</option>
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="canal-nome">Nome</Rotulo>
              <Campo
                id="canal-nome"
                value={formularioCanal.nome}
                onChange={(evento) => setFormularioCanal((atual) => ({ ...atual, nome: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="canal-identificador">Identificador</Rotulo>
              <Campo
                id="canal-identificador"
                value={formularioCanal.identificador}
                onChange={(evento) => setFormularioCanal((atual) => ({ ...atual, identificador: evento.target.value }))}
                required
              />
            </div>
          </div>
          <label className="mt-3 flex items-center justify-between rounded-md border border-linha bg-[#f7f8fa] px-3 py-2">
            <span className="text-sm font-medium text-tinta">Ativo</span>
            <input
              type="checkbox"
              checked={formularioCanal.ativo}
              onChange={(evento) => setFormularioCanal((atual) => ({ ...atual, ativo: evento.target.checked }))}
              className="h-5 w-5 accent-primaria"
            />
          </label>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando}>
              <Save size={16} />
              Salvar canal
            </Botao>
          </div>
        </form>

        <form onSubmit={salvarTemplate} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Novo template</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Rotulo htmlFor="template-canal">Canal</Rotulo>
              <Selecao
                id="template-canal"
                value={formularioTemplate.canal}
                onChange={(evento) =>
                  setFormularioTemplate((atual) => ({ ...atual, canal: evento.target.value as TipoCanalNotificacao }))
                }
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="push">Push</option>
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="template-codigo">Codigo externo</Rotulo>
              <Campo
                id="template-codigo"
                value={formularioTemplate.codigoExterno}
                onChange={(evento) => setFormularioTemplate((atual) => ({ ...atual, codigoExterno: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="template-nome">Nome</Rotulo>
              <Campo
                id="template-nome"
                value={formularioTemplate.nome}
                onChange={(evento) => setFormularioTemplate((atual) => ({ ...atual, nome: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="template-assunto">Assunto</Rotulo>
              <Campo
                id="template-assunto"
                value={formularioTemplate.assunto}
                onChange={(evento) => setFormularioTemplate((atual) => ({ ...atual, assunto: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="template-corpo">Corpo</Rotulo>
              <AreaTexto
                id="template-corpo"
                value={formularioTemplate.corpo}
                onChange={(evento) => setFormularioTemplate((atual) => ({ ...atual, corpo: evento.target.value }))}
                required
              />
            </div>
          </div>
          <label className="mt-3 flex items-center justify-between rounded-md border border-linha bg-[#f7f8fa] px-3 py-2">
            <span className="text-sm font-medium text-tinta">Aprovado para envio</span>
            <input
              type="checkbox"
              checked={formularioTemplate.aprovado}
              onChange={(evento) => setFormularioTemplate((atual) => ({ ...atual, aprovado: evento.target.checked }))}
              className="h-5 w-5 accent-primaria"
            />
          </label>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando}>
              <Save size={16} />
              Salvar template
            </Botao>
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <form onSubmit={enviarMensagem} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Send size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Disparo manual</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="mensagem-paciente">Paciente</Rotulo>
              <Selecao
                id="mensagem-paciente"
                value={formularioMensagem.pacienteId}
                onChange={(evento) => setFormularioMensagem((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {pacientes?.itens.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mensagem-canal">Canal</Rotulo>
              <Selecao
                id="mensagem-canal"
                value={formularioMensagem.canalId}
                onChange={(evento) => setFormularioMensagem((atual) => ({ ...atual, canalId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {canais
                  .filter((canal) => canal.ativo)
                  .map((canal) => (
                    <option key={canal.id} value={canal.id}>
                      {canal.nome}
                    </option>
                  ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mensagem-template">Template</Rotulo>
              <Selecao
                id="mensagem-template"
                value={formularioMensagem.templateId}
                onChange={(evento) => setFormularioMensagem((atual) => ({ ...atual, templateId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {templatesCompativeis.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Rotulo htmlFor="mensagem-destino">{canalMensagemSelecionado?.tipo === 'whatsapp' ? 'WhatsApp de destino' : 'Email de destino'}</Rotulo>
              <Campo
                id="mensagem-destino"
                type={canalMensagemSelecionado?.tipo === 'email' ? 'email' : 'text'}
                value={formularioMensagem.destino}
                onChange={(evento) => setFormularioMensagem((atual) => ({ ...atual, destino: evento.target.value }))}
                placeholder={canalMensagemSelecionado?.tipo === 'whatsapp' ? '5511999999999' : undefined}
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Rotulo htmlFor="mensagem-observacao">Observacao</Rotulo>
              <AreaTexto
                id="mensagem-observacao"
                value={formularioMensagem.observacao}
                onChange={(evento) => setFormularioMensagem((atual) => ({ ...atual, observacao: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !formularioMensagem.templateId || !formularioMensagem.destino.trim()}>
              <Send size={16} />
              Disparar
            </Botao>
          </div>
        </form>

        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h3 className="text-sm font-semibold">Inventario ativo</h3>
          </div>
          <div className="max-h-[420px] divide-y divide-linha overflow-auto">
            {canais.length ? (
              canais.map((canal) => {
                const Icone = iconeCanal(canal.tipo);
                return (
                  <div key={canal.id} className="grid gap-2 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-semibold">
                        <Icone size={16} className="shrink-0 text-primaria" />
                        <span className="truncate">{canal.nome}</span>
                      </span>
                      <span className="rounded-sm bg-[#eef3f6] px-2 py-1 text-xs font-semibold text-[#596273]">{canal.tipo}</span>
                    </div>
                    <p className="text-xs text-[#596273]">{canal.ativo ? 'Ativo' : 'Inativo'}</p>
                    <div className="grid gap-1">
                      {templates
                        .filter((template) => template.canal === canal.tipo)
                        .slice(0, 3)
                        .map((template) => (
                          <p key={template.id} className="truncate text-xs text-[#596273]">
                            {template.aprovado ? 'Aprovado' : 'Rascunho'}: {template.nome}
                          </p>
                        ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <EstadoVazio titulo="Nenhum canal carregado." />
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-linha bg-white">
        <div className="flex flex-col gap-3 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-primaria" />
            <div>
              <h3 className="text-sm font-semibold">Inbox WhatsApp</h3>
              <p className="text-xs text-[#596273]">
                {conversasWhatsapp.length} conversas, {mensagens.filter((mensagem) => obterDirecaoMensagem(mensagem) === 'recebida').length} entradas
              </p>
            </div>
          </div>
          <div className="flex rounded-md border border-linha bg-[#f7f8fa] p-1 text-xs font-semibold text-[#596273]">
            {(['todas', 'recebidas', 'falhas'] as const).map((filtro) => (
              <button
                key={filtro}
                type="button"
                onClick={() => setFiltroConversas(filtro)}
                className={`rounded px-3 py-1.5 ${filtroConversas === filtro ? 'bg-white text-tinta shadow-sm' : ''}`}
              >
                {filtro === 'todas' ? 'Todas' : filtro === 'recebidas' ? 'Com entrada' : 'Com falha'}
              </button>
            ))}
          </div>
        </div>
        {conversasFiltradas.length ? (
          <div className="grid min-h-[420px] lg:grid-cols-[360px_1fr]">
            <div className="divide-y divide-linha border-b border-linha lg:border-b-0 lg:border-r">
              {conversasFiltradas.map((conversa) => {
                const selecionada = conversaSelecionada?.id === conversa.id;
                return (
                  <button
                    key={conversa.id}
                    type="button"
                    onClick={() => setConversaSelecionadaId(conversa.id)}
                    className={`grid w-full gap-2 px-4 py-3 text-left text-sm ${selecionada ? 'bg-[#eef7f0]' : 'bg-white hover:bg-[#f7f8fa]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate">{conversa.titulo}</strong>
                        <p className="mt-1 truncate text-xs text-[#596273]">{conversa.contato}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-[#596273]">{conversa.ultimaData ?? 'sem data'}</span>
                    </div>
                    <p className="truncate text-xs text-[#596273]">{conversa.ultimaMensagem}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-sm border border-[#c6d8bf] bg-[#f2f8ef] px-2 py-1 text-xs font-semibold text-[#3d6730]">
                        {conversa.recebidas} recebidas
                      </span>
                      <span className="rounded-sm border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                        {conversa.enviadas} enviadas
                      </span>
                      {conversa.pendentes ? (
                        <span className="rounded-sm border border-[#f1b3b3] bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#8c2f2f]">
                          {conversa.pendentes} falhas
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid min-h-[420px] grid-rows-[auto_1fr]">
              {conversaSelecionada ? (
                <>
                  <div className="flex flex-col gap-3 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{conversaSelecionada.titulo}</strong>
                      <p className="mt-1 truncate text-xs text-[#596273]">{conversaSelecionada.contato}</p>
                    </div>
                    <Botao type="button" onClick={() => prepararRespostaWhatsapp(conversaSelecionada)}>
                      <Reply size={16} />
                      Responder
                    </Botao>
                  </div>
                  <div className="max-h-[520px] space-y-3 overflow-auto bg-[#f7f8fa] p-4">
                    {conversaSelecionada.mensagens.map((mensagem) => {
                      const recebida = obterDirecaoMensagem(mensagem) === 'recebida';
                      const ultimoStatusMeta = obterUltimoStatusMeta(mensagem.payload);
                      return (
                        <div key={mensagem.id} className={`flex ${recebida ? 'justify-start' : 'justify-end'}`}>
                          <div
                            className={`max-w-[78%] rounded-lg border px-3 py-2 text-sm shadow-sm ${
                              recebida ? 'border-linha bg-white' : 'border-[#c6d8bf] bg-[#eef7f0]'
                            }`}
                          >
                            <p className="break-words">{resumirMensagem(mensagem, templates)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#596273]">
                              <span>{recebida ? 'Recebida' : 'Enviada'} {formatarDataIso(mensagem.criadoEm) ?? 'sem data'}</span>
                              <span className={`rounded-sm border px-1.5 py-0.5 ${corStatusMensagem(mensagem.status)}`}>{mensagem.status}</span>
                              {!recebida && ultimoStatusMeta?.status ? (
                                <span className={`rounded-sm border px-1.5 py-0.5 ${corStatusMeta(ultimoStatusMeta.status)}`}>
                                  Meta: {formatarStatusMeta(ultimoStatusMeta.status)}
                                </span>
                              ) : null}
                            </div>
                            {mensagem.erro ? <p className="mt-2 break-words text-xs font-medium text-[#8c2f2f]">{mensagem.erro}</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EstadoVazio titulo="Selecione uma conversa WhatsApp." />
              )}
            </div>
          </div>
        ) : (
          <EstadoVazio titulo="Nenhuma conversa WhatsApp carregada." />
        )}
      </section>

      <section className="rounded-lg border border-linha bg-white">
        <div className="border-b border-linha px-4 py-3">
          <h3 className="text-sm font-semibold">Mensagens recentes</h3>
        </div>
        <div className="max-h-[420px] divide-y divide-linha overflow-auto">
          {mensagens.length ? (
            mensagens.map((mensagem) => {
              const canalMensagem = obterCanal(canais, mensagem);
              const ultimoStatusMeta = obterUltimoStatusMeta(mensagem.payload);
              const direcao = obterDirecaoMensagem(mensagem);
              const destino = obterContatoMensagem(mensagem, ultimoStatusMeta);
              const criadoEm = formatarDataIso(mensagem.criadoEm);
              const enviadoEm = formatarDataIso(mensagem.enviadoEm);

              return (
                <div key={mensagem.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_160px_170px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate">{canalMensagem?.nome ?? nomeCanal(canais, mensagem)}</strong>
                      <span className="rounded-sm bg-[#eef3f6] px-2 py-1 text-xs font-semibold text-[#596273]">
                        {nomeTemplate(templates, mensagem)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[#596273]">{destino}</p>
                    <p className="mt-1 truncate text-xs text-[#596273]">
                      {direcao === 'recebida' ? 'Recebida' : 'Criada'} {criadoEm ?? 'sem data'}{enviadoEm ? `, enviada ${enviadoEm}` : ''}
                    </p>
                    {direcao === 'recebida' ? (
                      <p className="mt-1 break-words text-xs text-[#596273]">{resumirMensagem(mensagem, templates)}</p>
                    ) : null}
                    {mensagem.erro ? <p className="mt-1 break-words text-xs font-medium text-[#8c2f2f]">{mensagem.erro}</p> : null}
                  </div>
                  <span
                    className={`w-fit rounded-sm border px-2 py-1 text-xs font-semibold ${corStatusMensagem(mensagem.status)}`}
                  >
                    {mensagem.status}
                  </span>
                  {canalMensagem?.tipo === 'whatsapp' && direcao !== 'recebida' ? (
                    <span
                      className={`w-fit rounded-sm border px-2 py-1 text-xs font-semibold ${corStatusMeta(ultimoStatusMeta?.status)}`}
                    >
                      Meta: {formatarStatusMeta(ultimoStatusMeta?.status)}
                    </span>
                  ) : direcao === 'recebida' ? (
                    <span className="w-fit rounded-sm border border-[#c6d8bf] bg-[#f2f8ef] px-2 py-1 text-xs font-semibold text-[#3d6730]">
                      Entrada
                    </span>
                  ) : (
                    <span className="w-fit rounded-sm border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                      {canalMensagem?.tipo ?? 'canal'}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <EstadoVazio titulo="Nenhuma mensagem persistida." />
          )}
        </div>
      </section>
    </section>
  );
}
