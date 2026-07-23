'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  History,
  LogOut,
  MailCheck,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { obterSessao, sair } from '@/lib/auth-api';
import {
  AtualizarConfiguracoesClienteEntrada,
  AtualizarPerfilEmpresaClienteEntrada,
  ConfiguracoesPortalClienteApi,
  PerfilEmpresaClienteApi,
  RespostaConvitesUsuarioClienteApi,
  RespostaHistoricoConvitesUsuarioClienteApi,
  PapelUsuarioClienteCriavelApi,
  PlanoSaasIdApi,
  RecursoLimitavelSaasApi,
  RespostaUsuariosClienteApi,
  ResumoPortalClienteApi,
  atualizarConfiguracoesCliente,
  atualizarPerfilEmpresaCliente,
  criarUsuarioCliente,
  desativarUsuarioCliente,
  obterConfiguracoesCliente,
  obterPerfilEmpresaCliente,
  listarConvitesUsuariosCliente,
  listarHistoricoConvitesUsuariosCliente,
  listarUsuariosCliente,
  obterResumoPortalCliente,
  reenviarConviteUsuarioCliente,
  revogarConviteUsuarioCliente,
  solicitarAjusteAssinaturaCliente
} from '@/lib/cliente-api';

const navegacao = [
  { href: '#conta', rotulo: 'Conta', permissao: 'cliente.acessar' },
  { href: '#assinatura', rotulo: 'Assinatura', permissao: 'cliente.assinatura.ler' },
  { href: '#usuarios', rotulo: 'Usuarios', permissao: 'cliente.usuarios.ler' },
  { href: '#configuracoes', rotulo: 'Configuracoes', permissao: 'cliente.configuracoes.gerenciar' },
  { href: '#perfil-fiscal', rotulo: 'Perfil fiscal', permissao: 'cliente.configuracoes.gerenciar' }
] as const;

function formatarQuantidade(valor: number, singular: string, plural: string) {
  return `${valor} ${valor === 1 ? singular : plural}`;
}

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }).format(data);
}

const recursosSaas: { chave: RecursoLimitavelSaasApi; rotulo: string }[] = [
  { chave: 'usuariosAdministrativos', rotulo: 'Usuarios administrativos' },
  { chave: 'pacientes', rotulo: 'Pacientes' },
  { chave: 'mensagensMes', rotulo: 'Mensagens no mes' },
  { chave: 'formulariosAtivos', rotulo: 'Formularios ativos' },
  { chave: 'armazenamentoMb', rotulo: 'Armazenamento' }
];

function formatarLimiteSaas(uso: number, limite: number | null, recurso: RecursoLimitavelSaasApi) {
  const sufixo = recurso === 'armazenamentoMb' ? ' MB' : '';
  if (limite === null) return `${uso}${sufixo} / ilimitado`;
  return `${uso}${sufixo} / ${limite}${sufixo}`;
}

function calcularPercentualSaas(uso: number, limite: number | null) {
  if (limite === null || limite <= 0) return 0;
  return Math.min(Math.round((uso / limite) * 100), 100);
}

function descreverAlertaSaas(status: 'atencao' | 'excedido') {
  return status === 'excedido' ? 'Limite atingido' : 'Perto do limite';
}

function assinaturaBloqueada(status?: string) {
  return status === 'suspensa' || status === 'cancelada';
}

const proximosPlanos: Record<PlanoSaasIdApi, { id?: PlanoSaasIdApi; nome: string; detalhe: string }> = {
  gratuito: { id: 'profissional', nome: 'Profissional', detalhe: 'Mais pacientes, formularios e mensagens para operacao individual.' },
  profissional: { id: 'clinica', nome: 'Clinica', detalhe: 'Mais usuarios administrativos e margem para crescer a operacao.' },
  clinica: { id: 'enterprise', nome: 'Enterprise', detalhe: 'Limites sob medida para operacoes maiores ou multiunidade.' },
  enterprise: { nome: 'Plano atual sob medida', detalhe: 'Solicite revisao comercial quando precisar ajustar contrato ou capacidade.' }
};

function obterProximoPlano(planoId: PlanoSaasIdApi) {
  return proximosPlanos[planoId];
}

function descreverHistoricoConvite(item: {
  status: string;
  criadoPorUsuarioId?: string;
  reenviadoPorUsuarioId?: string;
  revogadoPorUsuarioId?: string;
  usadoEm?: string;
  revogadoEm?: string;
}) {
  if (item.status === 'usado' && item.usadoEm) return `Usado em ${formatarData(item.usadoEm)}`;
  if (item.status === 'revogado' && item.revogadoPorUsuarioId) return `Revogado por ${item.revogadoPorUsuarioId}`;
  if (item.reenviadoPorUsuarioId) return `Reenviado por ${item.reenviadoPorUsuarioId}`;
  if (item.criadoPorUsuarioId) return `Criado por ${item.criadoPorUsuarioId}`;
  return 'Evento registrado';
}

const formularioUsuarioInicial = {
  email: '',
  role: 'Collaborator' as PapelUsuarioClienteCriavelApi
};

const formularioConfiguracoesInicial: AtualizarConfiguracoesClienteEntrada = {
  nome: '',
  timezone: 'America/Sao_Paulo',
  idioma: 'pt-BR',
  canaisPadrao: {
    email: true,
    whatsapp: true,
    googleCalendar: true
  },
  marca: {
    nomeExibido: '',
    emailRemetente: '',
    corPrimaria: '#197d8f'
  }
};

const formularioPerfilEmpresaInicial: AtualizarPerfilEmpresaClienteEntrada = {
  tipoPessoa: 'pj',
  documento: '',
  nomeLegal: '',
  nomeFantasia: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  responsavel: {
    nome: '',
    email: '',
    telefone: '',
    cargo: ''
  },
  endereco: {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    pais: 'BR'
  },
  contatos: {
    emailFinanceiro: '',
    telefoneFinanceiro: '',
    whatsappAtendimento: '',
    emailAtendimento: ''
  },
  fiscal: {
    prepararRecibos: true,
    observacoes: ''
  }
};

export function PortalCliente() {
  const router = useRouter();
  const [resumo, setResumo] = useState<ResumoPortalClienteApi | null>(null);
  const [usuarios, setUsuarios] = useState<RespostaUsuariosClienteApi | null>(null);
  const [convites, setConvites] = useState<RespostaConvitesUsuarioClienteApi | null>(null);
  const [historicoConvites, setHistoricoConvites] = useState<RespostaHistoricoConvitesUsuarioClienteApi | null>(null);
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesPortalClienteApi | null>(null);
  const [perfilEmpresa, setPerfilEmpresa] = useState<PerfilEmpresaClienteApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null);
  const [erroConfiguracoes, setErroConfiguracoes] = useState<string | null>(null);
  const [erroPerfilEmpresa, setErroPerfilEmpresa] = useState<string | null>(null);
  const [sucessoUsuarios, setSucessoUsuarios] = useState<string | null>(null);
  const [sucessoAssinatura, setSucessoAssinatura] = useState<string | null>(null);
  const [erroAssinatura, setErroAssinatura] = useState<string | null>(null);
  const [sucessoConfiguracoes, setSucessoConfiguracoes] = useState<string | null>(null);
  const [sucessoPerfilEmpresa, setSucessoPerfilEmpresa] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [carregandoConvites, setCarregandoConvites] = useState(true);
  const [carregandoHistoricoConvites, setCarregandoHistoricoConvites] = useState(true);
  const [carregandoConfiguracoes, setCarregandoConfiguracoes] = useState(true);
  const [carregandoPerfilEmpresa, setCarregandoPerfilEmpresa] = useState(true);
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState<'upgrade' | 'revisao_limite' | null>(null);
  const [salvandoConfiguracoes, setSalvandoConfiguracoes] = useState(false);
  const [salvandoPerfilEmpresa, setSalvandoPerfilEmpresa] = useState(false);
  const [desativandoUsuarioId, setDesativandoUsuarioId] = useState<string | null>(null);
  const [acaoConviteUsuarioId, setAcaoConviteUsuarioId] = useState<string | null>(null);
  const [formularioUsuario, setFormularioUsuario] = useState(formularioUsuarioInicial);
  const [formularioConfiguracoes, setFormularioConfiguracoes] = useState(formularioConfiguracoesInicial);
  const [formularioPerfilEmpresa, setFormularioPerfilEmpresa] = useState(formularioPerfilEmpresaInicial);
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [permissoesCarregadas, setPermissoesCarregadas] = useState(false);

  useEffect(() => {
    let ativo = true;

    void obterSessao()
      .then((sessao) => {
        if (!ativo) return;
        setPermissoes(sessao?.permissoes ?? []);
      })
      .catch(() => {
        if (ativo) setPermissoes([]);
      })
      .finally(() => {
        if (ativo) setPermissoesCarregadas(true);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const possuiPermissao = (permissao: string) => permissoes.includes(permissao);
  const podeLerUsuarios = possuiPermissao('cliente.usuarios.ler');
  const podeConvidarUsuarios = possuiPermissao('cliente.usuarios.convidar');
  const podeDesativarUsuarios = possuiPermissao('cliente.usuarios.desativar');
  const podeGerenciarConvites = possuiPermissao('cliente.convites.gerenciar');
  const podeGerenciarConfiguracoes = possuiPermissao('cliente.configuracoes.gerenciar');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    void obterResumoPortalCliente()
      .then((dados) => {
        if (!ativo) return;
        setResumo(dados);
      })
      .catch((erroAtual) => {
        if (!ativo) return;
        setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar conta.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const carregarUsuarios = useCallback(async () => {
    setCarregandoUsuarios(true);
    setErroUsuarios(null);

    try {
      setUsuarios(await listarUsuariosCliente());
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar usuarios da conta.');
    } finally {
      setCarregandoUsuarios(false);
    }
  }, []);

  const carregarConvites = useCallback(async () => {
    setCarregandoConvites(true);
    setErroUsuarios(null);

    try {
      setConvites(await listarConvitesUsuariosCliente());
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar convites administrativos.');
    } finally {
      setCarregandoConvites(false);
    }
  }, []);

  const carregarHistoricoConvites = useCallback(async () => {
    setCarregandoHistoricoConvites(true);
    setErroUsuarios(null);

    try {
      setHistoricoConvites(await listarHistoricoConvitesUsuariosCliente());
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar historico de convites.');
    } finally {
      setCarregandoHistoricoConvites(false);
    }
  }, []);

  const carregarConfiguracoes = useCallback(async () => {
    setCarregandoConfiguracoes(true);
    setErroConfiguracoes(null);

    try {
      const dados = await obterConfiguracoesCliente();
      setConfiguracoes(dados);
      setFormularioConfiguracoes({
        nome: dados.nome,
        timezone: dados.timezone,
        idioma: dados.idioma,
        canaisPadrao: dados.canaisPadrao,
        marca: dados.marca
      });
    } catch (erroAtual) {
      setErroConfiguracoes(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar configuracoes da conta.');
    } finally {
      setCarregandoConfiguracoes(false);
    }
  }, []);

  const carregarPerfilEmpresa = useCallback(async () => {
    setCarregandoPerfilEmpresa(true);
    setErroPerfilEmpresa(null);

    try {
      const dados = await obterPerfilEmpresaCliente();
      setPerfilEmpresa(dados);
      setFormularioPerfilEmpresa({
        tipoPessoa: dados.tipoPessoa,
        documento: dados.documento,
        nomeLegal: dados.nomeLegal,
        nomeFantasia: dados.nomeFantasia,
        inscricaoEstadual: dados.inscricaoEstadual,
        inscricaoMunicipal: dados.inscricaoMunicipal,
        responsavel: dados.responsavel,
        endereco: dados.endereco,
        contatos: dados.contatos,
        fiscal: dados.fiscal
      });
    } catch (erroAtual) {
      setErroPerfilEmpresa(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar perfil fiscal.');
    } finally {
      setCarregandoPerfilEmpresa(false);
    }
  }, []);

  async function convidarUsuario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoUsuario(true);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await criarUsuarioCliente({
        email: formularioUsuario.email.trim(),
        role: formularioUsuario.role
      });
      setFormularioUsuario(formularioUsuarioInicial);
      await carregarUsuarios();
      await carregarConvites();
      await carregarHistoricoConvites();
      setSucessoUsuarios('Convite enviado por email.');
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao convidar usuario.');
    } finally {
      setSalvandoUsuario(false);
    }
  }

  async function desativarUsuario(id: string, email: string) {
    const confirmado = window.confirm(`Desativar o acesso de ${email}?`);
    if (!confirmado) return;

    setDesativandoUsuarioId(id);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await desativarUsuarioCliente(id);
      await carregarUsuarios();
      await carregarConvites();
      await carregarHistoricoConvites();
      setSucessoUsuarios('Usuario desativado.');
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao desativar usuario.');
    } finally {
      setDesativandoUsuarioId(null);
    }
  }

  async function reenviarConvite(usuarioId: string, email: string) {
    setAcaoConviteUsuarioId(usuarioId);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await reenviarConviteUsuarioCliente(usuarioId);
      await carregarConvites();
      await carregarHistoricoConvites();
      setSucessoUsuarios(`Convite reenviado para ${email}.`);
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reenviar convite.');
    } finally {
      setAcaoConviteUsuarioId(null);
    }
  }

  async function revogarConvite(usuarioId: string, email: string) {
    const confirmado = window.confirm(`Revogar o convite de ${email}?`);
    if (!confirmado) return;

    setAcaoConviteUsuarioId(usuarioId);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await revogarConviteUsuarioCliente(usuarioId);
      await carregarUsuarios();
      await carregarConvites();
      await carregarHistoricoConvites();
      setSucessoUsuarios(`Convite revogado para ${email}.`);
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao revogar convite.');
    } finally {
      setAcaoConviteUsuarioId(null);
    }
  }

  async function solicitarAjusteAssinatura(acao: 'upgrade' | 'revisao_limite', planoDesejado?: PlanoSaasIdApi) {
    setEnviandoAssinatura(acao);
    setErroAssinatura(null);
    setSucessoAssinatura(null);

    try {
      await solicitarAjusteAssinaturaCliente({
        acao,
        ...(planoDesejado ? { planoDesejado } : {}),
        observacao: 'Solicitacao feita pelo portal do cliente.'
      });
      setSucessoAssinatura(acao === 'upgrade' ? 'Solicitacao de upgrade enviada.' : 'Solicitacao de revisao enviada.');
    } catch (erroAtual) {
      setErroAssinatura(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar solicitacao de assinatura.');
    } finally {
      setEnviandoAssinatura(null);
    }
  }

  async function salvarConfiguracoes(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoConfiguracoes(true);
    setErroConfiguracoes(null);
    setSucessoConfiguracoes(null);

    try {
      const atualizadas = await atualizarConfiguracoesCliente({
        ...formularioConfiguracoes,
        nome: formularioConfiguracoes.nome.trim(),
        timezone: formularioConfiguracoes.timezone.trim(),
        marca: {
          ...formularioConfiguracoes.marca,
          nomeExibido: formularioConfiguracoes.marca.nomeExibido.trim(),
          emailRemetente: formularioConfiguracoes.marca.emailRemetente.trim(),
          corPrimaria: formularioConfiguracoes.marca.corPrimaria.trim()
        }
      });
      setConfiguracoes(atualizadas);
      setFormularioConfiguracoes({
        nome: atualizadas.nome,
        timezone: atualizadas.timezone,
        idioma: atualizadas.idioma,
        canaisPadrao: atualizadas.canaisPadrao,
        marca: atualizadas.marca
      });
      setSucessoConfiguracoes('Configuracoes salvas.');
    } catch (erroAtual) {
      setErroConfiguracoes(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar configuracoes.');
    } finally {
      setSalvandoConfiguracoes(false);
    }
  }

  async function salvarPerfilEmpresa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoPerfilEmpresa(true);
    setErroPerfilEmpresa(null);
    setSucessoPerfilEmpresa(null);

    try {
      const atualizado = await atualizarPerfilEmpresaCliente({
        ...formularioPerfilEmpresa,
        documento: formularioPerfilEmpresa.documento.trim(),
        nomeLegal: formularioPerfilEmpresa.nomeLegal.trim(),
        nomeFantasia: formularioPerfilEmpresa.nomeFantasia.trim(),
        inscricaoEstadual: formularioPerfilEmpresa.inscricaoEstadual.trim(),
        inscricaoMunicipal: formularioPerfilEmpresa.inscricaoMunicipal.trim(),
        responsavel: {
          nome: formularioPerfilEmpresa.responsavel.nome.trim(),
          email: formularioPerfilEmpresa.responsavel.email.trim(),
          telefone: formularioPerfilEmpresa.responsavel.telefone.trim(),
          cargo: formularioPerfilEmpresa.responsavel.cargo.trim()
        },
        endereco: {
          cep: formularioPerfilEmpresa.endereco.cep.trim(),
          logradouro: formularioPerfilEmpresa.endereco.logradouro.trim(),
          numero: formularioPerfilEmpresa.endereco.numero.trim(),
          complemento: formularioPerfilEmpresa.endereco.complemento.trim(),
          bairro: formularioPerfilEmpresa.endereco.bairro.trim(),
          cidade: formularioPerfilEmpresa.endereco.cidade.trim(),
          uf: formularioPerfilEmpresa.endereco.uf.trim().toUpperCase(),
          pais: formularioPerfilEmpresa.endereco.pais.trim().toUpperCase() || 'BR'
        },
        contatos: {
          emailFinanceiro: formularioPerfilEmpresa.contatos.emailFinanceiro.trim(),
          telefoneFinanceiro: formularioPerfilEmpresa.contatos.telefoneFinanceiro.trim(),
          whatsappAtendimento: formularioPerfilEmpresa.contatos.whatsappAtendimento.trim(),
          emailAtendimento: formularioPerfilEmpresa.contatos.emailAtendimento.trim()
        },
        fiscal: {
          prepararRecibos: formularioPerfilEmpresa.fiscal.prepararRecibos,
          observacoes: formularioPerfilEmpresa.fiscal.observacoes.trim()
        }
      });
      setPerfilEmpresa(atualizado);
      setFormularioPerfilEmpresa({
        tipoPessoa: atualizado.tipoPessoa,
        documento: atualizado.documento,
        nomeLegal: atualizado.nomeLegal,
        nomeFantasia: atualizado.nomeFantasia,
        inscricaoEstadual: atualizado.inscricaoEstadual,
        inscricaoMunicipal: atualizado.inscricaoMunicipal,
        responsavel: atualizado.responsavel,
        endereco: atualizado.endereco,
        contatos: atualizado.contatos,
        fiscal: atualizado.fiscal
      });
      setSucessoPerfilEmpresa('Perfil fiscal salvo.');
    } catch (erroAtual) {
      setErroPerfilEmpresa(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar perfil fiscal.');
    } finally {
      setSalvandoPerfilEmpresa(false);
    }
  }

  useEffect(() => {
    if (!permissoesCarregadas) return;

    if (podeLerUsuarios) {
      void carregarUsuarios();
    } else {
      setCarregandoUsuarios(false);
    }

    if (podeGerenciarConvites) {
      void carregarConvites();
      void carregarHistoricoConvites();
    } else {
      setCarregandoConvites(false);
      setCarregandoHistoricoConvites(false);
    }

    if (podeGerenciarConfiguracoes) {
      void carregarConfiguracoes();
      void carregarPerfilEmpresa();
    } else {
      setCarregandoConfiguracoes(false);
      setCarregandoPerfilEmpresa(false);
    }
  }, [
    permissoesCarregadas,
    podeLerUsuarios,
    podeGerenciarConvites,
    podeGerenciarConfiguracoes,
    carregarUsuarios,
    carregarConvites,
    carregarHistoricoConvites,
    carregarConfiguracoes,
    carregarPerfilEmpresa
  ]);

  const indicadores = useMemo(
    () => [
      {
        rotulo: 'Unidade ativa',
        valor: resumo?.conta.nome ?? 'Carregando conta',
        detalhe: resumo ? resumo.conta.slug : 'Atualizando dados da conta'
      },
      {
        rotulo: 'Plano atual',
        valor: resumo?.assinatura.plano ?? 'Carregando plano',
        detalhe: resumo ? `Status ${resumo.assinatura.status}` : 'Validando assinatura'
      },
      {
        rotulo: 'Usuarios ativos',
        valor: resumo ? formatarQuantidade(resumo.usuarios.totalAtivos, 'usuario ativo', 'usuarios ativos') : 'Carregando usuarios',
        detalhe: resumo
          ? `${formatarQuantidade(resumo.usuarios.clientes, 'cliente', 'clientes')} na conta`
          : 'Separando perfis'
      }
    ],
    [resumo]
  );
  const navegacaoVisivel = useMemo(
    () => navegacao.filter((item) => permissoes.includes(item.permissao)),
    [permissoes]
  );
  const podeVerGestaoUsuarios = podeLerUsuarios || podeConvidarUsuarios || podeGerenciarConvites;
  const alertasAssinatura = resumo?.assinatura.alertas ?? [];
  const planoRecomendado = resumo ? obterProximoPlano(resumo.assinatura.planoId) : null;
  const bloqueioAssinatura = assinaturaBloqueada(resumo?.assinatura.status);

  async function encerrarSessao() {
    await sair();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-fundo text-tinta">
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#596273]">Conta OctaClin</p>
            <h1 className="text-xl font-semibold">Portal do cliente</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#596273]">
              Area administrativa da conta, separada das rotinas assistenciais e dos acessos dos pacientes.
            </p>
            {resumo ? <p className="mt-2 break-words text-sm font-medium text-[#343c4b]">{resumo.conta.nome}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-linha bg-[#f8fafb] px-3 py-2 text-sm font-medium text-[#343c4b]">
              <ShieldCheck className="h-4 w-4 text-primaria" />
              Acesso profissional separado
            </div>
            <Botao type="button" variante="fantasma" onClick={encerrarSessao}>
              <LogOut className="h-4 w-4" />
              Sair
            </Botao>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-4 lg:px-6">
          <nav aria-label="Navegacao do cliente" className="flex gap-1 overflow-x-auto rounded-lg border border-linha bg-[#f8fafb] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navegacaoVisivel.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium text-[#596273] hover:bg-white hover:text-tinta"
              >
                {item.rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1180px] gap-4 px-4 py-5 lg:px-6" aria-busy={carregando}>
        {erro ? (
          <section className="flex items-start gap-3 rounded-lg border border-[#efb8ad] bg-white p-4" aria-live="polite">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fff4f1] text-perigo">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Conta indisponivel</h2>
              <p className="mt-1 break-words text-sm text-[#596273]">{erro}</p>
            </div>
          </section>
        ) : null}

        <section id="conta" className="scroll-mt-4 rounded-lg border border-linha bg-white">
          <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <Building2 className="h-4 w-4 text-[#596273]" />
            <h2 className="text-sm font-semibold">Resumo da conta</h2>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {indicadores.map((indicador) => (
              <article key={indicador.rotulo} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">{indicador.rotulo}</p>
                <p className="mt-1 break-words text-base font-semibold">{indicador.valor}</p>
                <p className="mt-1 text-xs text-[#596273]">{indicador.detalhe}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section id="assinatura" className="scroll-mt-4 rounded-lg border border-linha bg-white">
            <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
              <CreditCard className="h-4 w-4 text-[#596273]" />
              <h2 className="text-sm font-semibold">Assinatura</h2>
            </div>
            <div className="grid gap-3 p-4">
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Status</p>
                <p className="mt-1 text-base font-semibold">{resumo?.assinatura.plano ?? 'Carregando plano'}</p>
                <p className="mt-1 text-sm text-[#596273]">
                  {resumo ? `Assinatura ${resumo.assinatura.status} com origem ${resumo.assinatura.origem}.` : 'Atualizando assinatura da conta.'}
                </p>
                {resumo?.assinatura.renovacaoEm ? (
                  <p className="mt-1 text-xs font-medium text-[#343c4b]">Renova em {formatarData(resumo.assinatura.renovacaoEm)}</p>
                ) : null}
                {bloqueioAssinatura ? (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-[#efb8ad] bg-white px-3 py-2 text-sm text-perigo">
                    <Ban size={16} className="mt-0.5 shrink-0" />
                    <span>Novas acoes estao bloqueadas, mas os dados existentes continuam disponiveis.</span>
                  </div>
                ) : null}
              </article>
              <div className="grid gap-2">
                {recursosSaas.map((recurso) => {
                  const uso = resumo?.assinatura.uso[recurso.chave] ?? 0;
                  const limite = resumo?.assinatura.limites[recurso.chave] ?? null;
                  const percentual = calcularPercentualSaas(uso, limite);
                  const alerta = alertasAssinatura.find((item) => item.recurso === recurso.chave);

                  return (
                    <article key={recurso.chave} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold">{recurso.rotulo}</p>
                          {alerta ? (
                            <p className={`mt-1 text-xs font-medium ${alerta.status === 'excedido' ? 'text-perigo' : 'text-[#8a5a00]'}`}>
                              {descreverAlertaSaas(alerta.status)}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-[#596273]">Dentro do limite</p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-semibold">{formatarLimiteSaas(uso, limite, recurso.chave)}</p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${alerta?.status === 'excedido' ? 'bg-perigo' : 'bg-primaria'}`}
                          style={{ width: `${percentual}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Plano recomendado</p>
                <p className="mt-1 text-base font-semibold">{planoRecomendado?.nome ?? 'Carregando recomendacao'}</p>
                <p className="mt-1 text-sm text-[#596273]">
                  {planoRecomendado?.detalhe ?? 'Avaliando uso atual da conta.'}
                </p>
                {erroAssinatura ? (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-[#efb8ad] bg-white px-3 py-2 text-sm text-perigo">
                    <AlertTriangle size={16} />
                    {erroAssinatura}
                  </div>
                ) : null}
                {sucessoAssinatura ? (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-[#b8dfc1] bg-white px-3 py-2 text-sm text-[#245b33]">
                    <CheckCircle2 size={16} />
                    {sucessoAssinatura}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {planoRecomendado?.id ? (
                    <Botao
                      type="button"
                      variante="primario"
                      disabled={Boolean(enviandoAssinatura)}
                      onClick={() => solicitarAjusteAssinatura('upgrade', planoRecomendado.id)}
                      aria-label={`Solicitar upgrade para ${planoRecomendado.nome}`}
                    >
                      <Send size={16} />
                      {enviandoAssinatura === 'upgrade' ? 'Enviando' : `Solicitar upgrade para ${planoRecomendado.nome}`}
                    </Botao>
                  ) : null}
                  <Botao
                    type="button"
                    variante="secundario"
                    disabled={Boolean(enviandoAssinatura)}
                    onClick={() => solicitarAjusteAssinatura('revisao_limite')}
                  >
                    <RefreshCcw size={16} />
                    {enviandoAssinatura === 'revisao_limite' ? 'Enviando' : 'Pedir revisao de limite'}
                  </Botao>
                </div>
              </article>
            </div>
          </section>

          <section id="usuarios" className="scroll-mt-4 rounded-lg border border-linha bg-white">
            <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
              <UsersRound className="h-4 w-4 text-[#596273]" />
              <h2 className="text-sm font-semibold">Usuarios</h2>
            </div>
            <div className="grid gap-3 p-4">
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Gestor da conta</p>
                <p className="mt-1 break-words text-base font-semibold">{resumo?.acesso.usuarioId ?? 'Carregando usuario'}</p>
                <p className="mt-1 text-sm text-[#596273]">
                  {resumo ? `${resumo.acesso.papel} com escopo ${resumo.acesso.escopoDados}.` : 'Validando escopo da sessao.'}
                </p>
              </article>
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Separacao de acesso</p>
                <p className="mt-1 text-sm font-semibold">
                  {resumo
                    ? `${formatarQuantidade(resumo.usuarios.profissionais, 'profissional', 'profissionais')} e ${formatarQuantidade(
                        resumo.usuarios.pacientes,
                        'paciente',
                        'pacientes'
                      )}`
                    : 'Profissionais e pacientes usam areas isoladas.'}
                </p>
              </article>
            </div>
          </section>
        </div>

        {podeVerGestaoUsuarios ? (
        <section id="gestao-usuarios" className="scroll-mt-4 rounded-lg border border-linha bg-white" aria-busy={carregandoUsuarios}>
          <div className="flex flex-col gap-3 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Gerenciar usuarios</h2>
              <p className="mt-1 text-sm text-[#596273]">
                {usuarios ? `${usuarios.total} acessos administrativos` : 'Carregando acessos administrativos'}
              </p>
            </div>
            {podeLerUsuarios ? (
              <Botao type="button" onClick={() => void carregarUsuarios()} disabled={carregandoUsuarios}>
                <RefreshCcw size={16} />
                {carregandoUsuarios ? 'Atualizando' : 'Atualizar'}
              </Botao>
            ) : null}
          </div>

          <div className="grid gap-4 p-4">
            {erroUsuarios ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
                <AlertTriangle size={16} />
                {erroUsuarios}
              </div>
            ) : null}
            {sucessoUsuarios ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
                <CheckCircle2 size={16} />
                {sucessoUsuarios}
              </div>
            ) : null}

            {podeConvidarUsuarios ? (
            <form onSubmit={convidarUsuario} className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 lg:grid-cols-[1fr_180px_auto]">
              <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                Email
                <input
                  className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                  type="email"
                  value={formularioUsuario.email}
                  onChange={(evento) => setFormularioUsuario((atual) => ({ ...atual, email: evento.target.value }))}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                Papel
                <select
                  className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                  value={formularioUsuario.role}
                  onChange={(evento) =>
                    setFormularioUsuario((atual) => ({ ...atual, role: evento.target.value as PapelUsuarioClienteCriavelApi }))
                  }
                >
                  <option value="Collaborator">Collaborator</option>
                  <option value="Professional">Professional</option>
                </select>
              </label>
              <div className="flex items-end">
                <Botao type="submit" variante="primario" disabled={salvandoUsuario || bloqueioAssinatura} className="w-full">
                  <UserPlus size={16} />
                  {salvandoUsuario ? 'Convidando' : bloqueioAssinatura ? 'Assinatura bloqueada' : 'Convidar usuario'}
                </Botao>
              </div>
              <p className="text-sm text-[#596273] lg:col-span-3">Link de primeiro acesso enviado por email.</p>
            </form>
            ) : null}

            {podeGerenciarConvites ? (
            <section id="convites-usuarios" className="rounded-md border border-linha bg-[#f8fafb]" aria-busy={carregandoConvites}>
              <div className="flex flex-col gap-2 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <MailCheck size={16} className="text-primaria" />
                  <div>
                    <h3 className="text-sm font-semibold">Convites pendentes</h3>
                    <p className="mt-1 text-xs text-[#596273]">
                      {convites ? `${convites.total} convites aguardando primeiro acesso` : 'Carregando convites'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-linha">
                {convites?.itens.length ? (
                  convites.itens.map((convite) => (
                    <div key={convite.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_150px_160px_180px] lg:items-center">
                      <div className="min-w-0">
                        <p className="break-all font-medium">{convite.email}</p>
                        <p className="mt-1 text-xs text-[#596273]">{convite.role}</p>
                      </div>
                      <span>{convite.status}</span>
                      <span>Expira em {formatarData(convite.expiraEm)}</span>
                      <div className="flex justify-end gap-1">
                        <Botao
                          type="button"
                          variante="fantasma"
                          onClick={() => void reenviarConvite(convite.usuarioId, convite.email)}
                          disabled={acaoConviteUsuarioId === convite.usuarioId}
                          aria-label={`Reenviar convite para ${convite.email}`}
                        >
                          <Send size={16} />
                        </Botao>
                        <Botao
                          type="button"
                          variante="fantasma"
                          onClick={() => void revogarConvite(convite.usuarioId, convite.email)}
                          disabled={acaoConviteUsuarioId === convite.usuarioId}
                          aria-label={`Revogar convite de ${convite.email}`}
                        >
                          <Ban size={16} />
                        </Botao>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-[#596273]">Nenhum convite administrativo pendente.</div>
                )}
              </div>
            </section>
            ) : null}

            {podeGerenciarConvites ? (
            <section id="historico-convites" className="rounded-md border border-linha bg-white" aria-busy={carregandoHistoricoConvites}>
              <div className="flex flex-col gap-3 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#596273]" />
                  <div>
                    <h3 className="text-sm font-semibold">Historico de convites</h3>
                    <p className="mt-1 text-xs text-[#596273]">
                      {historicoConvites
                        ? `${formatarQuantidade(historicoConvites.total, 'evento de convite', 'eventos de convite')}`
                        : 'Carregando historico operacional'}
                    </p>
                  </div>
                </div>
                <a
                  href="/api/cliente/usuarios/convites/historico/exportar.csv"
                  className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-linha bg-[#f8fafb] px-3 text-sm font-medium text-[#343c4b] hover:bg-white"
                >
                  <Download size={16} />
                  Exportar CSV
                </a>
              </div>
              <div className="divide-y divide-linha">
                {historicoConvites?.itens.length ? (
                  historicoConvites.itens.map((convite) => (
                    <div key={convite.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_140px_180px_1fr] lg:items-center">
                      <div className="min-w-0">
                        <p className="break-all font-medium">{convite.email}</p>
                        <p className="mt-1 text-xs text-[#596273]">{convite.role}</p>
                      </div>
                      <span className="w-fit rounded-md border border-linha bg-[#f8fafb] px-2 py-1 text-xs font-semibold uppercase text-[#596273]">
                        {convite.status}
                      </span>
                      <span>{descreverHistoricoConvite(convite)}</span>
                      <span className="text-xs text-[#596273]">
                        Criado em {formatarData(convite.criadoEm)}
                        {convite.motivoRevogacao ? ` · Motivo: ${convite.motivoRevogacao}` : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-[#596273]">Nenhum historico de convite registrado.</div>
                )}
              </div>
            </section>
            ) : null}

            {podeLerUsuarios ? (
            <div className="overflow-x-auto rounded-md border border-linha bg-white">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1.4fr_160px_120px_140px_96px] gap-3 border-b border-linha px-4 py-3 text-xs font-semibold uppercase text-[#596273]">
                  <span>Email</span>
                  <span>Papel</span>
                  <span>Status</span>
                  <span>Ultimo login</span>
                  <span>Acoes</span>
                </div>
                <div className="divide-y divide-linha">
                  {usuarios?.itens.length ? (
                    usuarios.itens.map((usuario) => (
                      <div key={usuario.id} className="grid grid-cols-[1.4fr_160px_120px_140px_96px] gap-3 px-4 py-3 text-sm">
                        <span className="break-all font-medium">{usuario.email}</span>
                        <span>{usuario.role}</span>
                        <span>{usuario.ativo ? 'Ativo' : 'Inativo'}</span>
                        <span>{formatarData(usuario.ultimoLoginEm)}</span>
                        <div className="flex justify-end">
                          <Botao
                            type="button"
                            variante="fantasma"
                            onClick={() => void desativarUsuario(usuario.id, usuario.email)}
                            disabled={!podeDesativarUsuarios || !usuario.ativo || usuario.role === 'Client' || desativandoUsuarioId === usuario.id}
                            aria-label={`Desativar ${usuario.email}`}
                          >
                            <Trash2 size={16} />
                          </Botao>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-sm text-[#596273]">Nenhum usuario administrativo carregado.</div>
                  )}
                </div>
              </div>
            </div>
            ) : null}
          </div>
        </section>
        ) : null}

        {podeGerenciarConfiguracoes ? (
          <section id="configuracoes" className="scroll-mt-4 rounded-lg border border-linha bg-white" aria-busy={carregandoConfiguracoes}>
            <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
              <ShieldCheck className="h-4 w-4 text-[#596273]" />
              <div>
                <h2 className="text-sm font-semibold">Configuracoes da conta</h2>
                <p className="mt-1 text-sm text-[#596273]">
                  {configuracoes ? `Atualizado em ${formatarData(configuracoes.atualizadoEm)}` : 'Carregando preferencias da conta'}
                </p>
              </div>
            </div>
            <form onSubmit={salvarConfiguracoes} className="grid gap-4 p-4">
              {erroConfiguracoes ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
                  <AlertTriangle size={16} />
                  {erroConfiguracoes}
                </div>
              ) : null}
              {sucessoConfiguracoes ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
                  <CheckCircle2 size={16} />
                  {sucessoConfiguracoes}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Nome da clinica
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.nome}
                    onChange={(evento) => setFormularioConfiguracoes((atual) => ({ ...atual, nome: evento.target.value }))}
                    required
                    maxLength={160}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Nome exibido
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.marca.nomeExibido}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        marca: { ...atual.marca, nomeExibido: evento.target.value }
                      }))
                    }
                    required
                    maxLength={120}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Timezone
                  <select
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.timezone}
                    onChange={(evento) => setFormularioConfiguracoes((atual) => ({ ...atual, timezone: evento.target.value }))}
                  >
                    <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                    <option value="America/Fortaleza">America/Fortaleza</option>
                    <option value="America/Manaus">America/Manaus</option>
                    <option value="America/Recife">America/Recife</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Idioma
                  <select
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.idioma}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        idioma: evento.target.value as AtualizarConfiguracoesClienteEntrada['idioma']
                      }))
                    }
                  >
                    <option value="pt-BR">pt-BR</option>
                    <option value="en-US">en-US</option>
                    <option value="es">es</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Email remetente
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="email"
                    value={formularioConfiguracoes.marca.emailRemetente}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        marca: { ...atual.marca, emailRemetente: evento.target.value }
                      }))
                    }
                    maxLength={180}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Cor primaria
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="color"
                    value={formularioConfiguracoes.marca.corPrimaria}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        marca: { ...atual.marca, corPrimaria: evento.target.value }
                      }))
                    }
                  />
                </label>
              </div>

              <fieldset className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <legend className="px-1 text-xs font-semibold text-[#596273]">Canais padrao</legend>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {[
                    ['email', 'Email'],
                    ['whatsapp', 'WhatsApp'],
                    ['googleCalendar', 'Google Calendar']
                  ].map(([chave, rotulo]) => (
                    <label key={chave} className="inline-flex h-10 items-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={formularioConfiguracoes.canaisPadrao[chave as keyof AtualizarConfiguracoesClienteEntrada['canaisPadrao']]}
                        onChange={(evento) =>
                          setFormularioConfiguracoes((atual) => ({
                            ...atual,
                            canaisPadrao: {
                              ...atual.canaisPadrao,
                              [chave]: evento.target.checked
                            }
                          }))
                        }
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex justify-end">
                <Botao type="submit" variante="primario" disabled={salvandoConfiguracoes || carregandoConfiguracoes}>
                  <Save size={16} />
                  {salvandoConfiguracoes ? 'Salvando' : 'Salvar configuracoes'}
                </Botao>
              </div>
            </form>
          </section>
        ) : null}

        {podeGerenciarConfiguracoes ? (
          <section id="perfil-fiscal" className="scroll-mt-4 rounded-lg border border-linha bg-white" aria-busy={carregandoPerfilEmpresa}>
            <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
              <FileText className="h-4 w-4 text-[#596273]" />
              <div>
                <h2 className="text-sm font-semibold">Perfil fiscal</h2>
                <p className="mt-1 text-sm text-[#596273]">
                  {perfilEmpresa ? `Atualizado em ${formatarData(perfilEmpresa.atualizadoEm)}` : 'Carregando dados fiscais da conta'}
                </p>
              </div>
            </div>
            <form onSubmit={salvarPerfilEmpresa} className="grid gap-4 p-4">
              {erroPerfilEmpresa ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
                  <AlertTriangle size={16} />
                  {erroPerfilEmpresa}
                </div>
              ) : null}
              {sucessoPerfilEmpresa ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
                  <CheckCircle2 size={16} />
                  {sucessoPerfilEmpresa}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Tipo de pessoa
                  <select
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.tipoPessoa}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        tipoPessoa: evento.target.value as AtualizarPerfilEmpresaClienteEntrada['tipoPessoa']
                      }))
                    }
                  >
                    <option value="pj">Pessoa juridica</option>
                    <option value="pf">Pessoa fisica</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Documento fiscal
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.documento}
                    onChange={(evento) => setFormularioPerfilEmpresa((atual) => ({ ...atual, documento: evento.target.value }))}
                    maxLength={32}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Nome legal
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.nomeLegal}
                    onChange={(evento) => setFormularioPerfilEmpresa((atual) => ({ ...atual, nomeLegal: evento.target.value }))}
                    required
                    maxLength={180}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Nome fantasia
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.nomeFantasia}
                    onChange={(evento) => setFormularioPerfilEmpresa((atual) => ({ ...atual, nomeFantasia: evento.target.value }))}
                    maxLength={180}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Inscricao estadual
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.inscricaoEstadual}
                    onChange={(evento) => setFormularioPerfilEmpresa((atual) => ({ ...atual, inscricaoEstadual: evento.target.value }))}
                    maxLength={40}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Inscricao municipal
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.inscricaoMunicipal}
                    onChange={(evento) => setFormularioPerfilEmpresa((atual) => ({ ...atual, inscricaoMunicipal: evento.target.value }))}
                    maxLength={40}
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Responsavel
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.responsavel.nome}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        responsavel: { ...atual.responsavel, nome: evento.target.value }
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Email do responsavel
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="email"
                    value={formularioPerfilEmpresa.responsavel.email}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        responsavel: { ...atual.responsavel, email: evento.target.value }
                      }))
                    }
                    maxLength={180}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Telefone do responsavel
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.responsavel.telefone}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        responsavel: { ...atual.responsavel, telefone: evento.target.value }
                      }))
                    }
                    maxLength={40}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Cargo
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.responsavel.cargo}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        responsavel: { ...atual.responsavel, cargo: evento.target.value }
                      }))
                    }
                    maxLength={80}
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 md:grid-cols-4">
                <label className="grid gap-1 text-xs font-semibold text-[#596273] md:col-span-1">
                  CEP
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.endereco.cep}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, cep: evento.target.value }
                      }))
                    }
                    maxLength={20}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273] md:col-span-2">
                  Logradouro
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.endereco.logradouro}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, logradouro: evento.target.value }
                      }))
                    }
                    maxLength={160}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Numero
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.endereco.numero}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, numero: evento.target.value }
                      }))
                    }
                    maxLength={30}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273] md:col-span-2">
                  Complemento
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.endereco.complemento}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, complemento: evento.target.value }
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Bairro
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.endereco.bairro}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, bairro: evento.target.value }
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Cidade
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.endereco.cidade}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, cidade: evento.target.value }
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  UF
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal uppercase text-tinta"
                    value={formularioPerfilEmpresa.endereco.uf}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, uf: evento.target.value.toUpperCase() }
                      }))
                    }
                    maxLength={2}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Pais
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal uppercase text-tinta"
                    value={formularioPerfilEmpresa.endereco.pais}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        endereco: { ...atual.endereco, pais: evento.target.value.toUpperCase() }
                      }))
                    }
                    maxLength={2}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Email financeiro
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="email"
                    value={formularioPerfilEmpresa.contatos.emailFinanceiro}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        contatos: { ...atual.contatos, emailFinanceiro: evento.target.value }
                      }))
                    }
                    maxLength={180}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Telefone financeiro
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.contatos.telefoneFinanceiro}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        contatos: { ...atual.contatos, telefoneFinanceiro: evento.target.value }
                      }))
                    }
                    maxLength={40}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  WhatsApp atendimento
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.contatos.whatsappAtendimento}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        contatos: { ...atual.contatos, whatsappAtendimento: evento.target.value }
                      }))
                    }
                    maxLength={40}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Email atendimento
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="email"
                    value={formularioPerfilEmpresa.contatos.emailAtendimento}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        contatos: { ...atual.contatos, emailAtendimento: evento.target.value }
                      }))
                    }
                    maxLength={180}
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3">
                <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={formularioPerfilEmpresa.fiscal.prepararRecibos}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        fiscal: { ...atual.fiscal, prepararRecibos: evento.target.checked }
                      }))
                    }
                  />
                  Preparar base para recibos
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                  Observacoes fiscais
                  <textarea
                    className="min-h-24 rounded-md border border-linha bg-white px-3 py-2 text-sm font-normal text-tinta"
                    value={formularioPerfilEmpresa.fiscal.observacoes}
                    onChange={(evento) =>
                      setFormularioPerfilEmpresa((atual) => ({
                        ...atual,
                        fiscal: { ...atual.fiscal, observacoes: evento.target.value }
                      }))
                    }
                    maxLength={500}
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <Botao type="submit" variante="primario" disabled={salvandoPerfilEmpresa || carregandoPerfilEmpresa}>
                  <Save size={16} />
                  {salvandoPerfilEmpresa ? 'Salvando' : 'Salvar perfil fiscal'}
                </Botao>
              </div>
            </form>
          </section>
        ) : null}
      </section>
    </main>
  );
}
