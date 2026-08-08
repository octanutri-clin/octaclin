'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { obterSessao } from '@/lib/auth-api';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import {
  ConfiguracoesPortalClienteApi,
  PapelUsuarioClienteCriavelApi,
  PerfilEmpresaClienteApi,
  PlanoSaasIdApi,
  RespostaConvitesUsuarioClienteApi,
  RespostaHistoricoConvitesUsuarioClienteApi,
  RespostaUsuariosClienteApi,
  ResumoPortalClienteApi,
  atualizarConfiguracoesCliente,
  atualizarPapelUsuarioCliente,
  atualizarPerfilEmpresaCliente,
  criarUsuarioCliente,
  desativarUsuarioCliente,
  listarConvitesUsuariosCliente,
  listarHistoricoConvitesUsuariosCliente,
  listarUsuariosCliente,
  obterConfiguracoesCliente,
  obterPerfilEmpresaCliente,
  obterResumoPortalCliente,
  reenviarConviteUsuarioCliente,
  revogarConviteUsuarioCliente,
  solicitarAjusteAssinaturaCliente
} from '@/lib/cliente-api';
import {
  AreaPortalCliente,
  assinaturaBloqueada,
  formatarQuantidade,
  formularioConfiguracoesInicial,
  formularioPerfilEmpresaInicial,
  formularioUsuarioInicial,
  obterProximoPlano
} from './portal-cliente-dominio';

export function usePortalCliente() {
  const [areaAtiva, setAreaAtiva] = useState<AreaPortalCliente>('ativacao');
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
  const [confirmacaoUsuario, setConfirmacaoUsuario] = useState<
    { tipo: 'desativar' | 'revogar'; id: string; email: string } | null
  >(null);
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
  const [ajustandoUsuarioId, setAjustandoUsuarioId] = useState<string | null>(null);
  const [papeisUsuarios, setPapeisUsuarios] = useState<Record<string, PapelUsuarioClienteCriavelApi>>({});
  const [nomesProfissionais, setNomesProfissionais] = useState<Record<string, string>>({});
  const [acaoConviteUsuarioId, setAcaoConviteUsuarioId] = useState<string | null>(null);
  const [formularioUsuario, setFormularioUsuario] = useState(formularioUsuarioInicial);
  const [formularioConfiguracoes, setFormularioConfiguracoes] = useState(formularioConfiguracoesInicial);
  const [formularioPerfilEmpresa, setFormularioPerfilEmpresa] = useState(formularioPerfilEmpresaInicial);
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [permissoesCarregadas, setPermissoesCarregadas] = useState(false);

  const iniciarRequisicaoUsuarios = useRequisicaoCancelavel();
  const iniciarRequisicaoConvites = useRequisicaoCancelavel();
  const iniciarRequisicaoHistoricoConvites = useRequisicaoCancelavel();
  const iniciarRequisicaoConfiguracoes = useRequisicaoCancelavel();
  const iniciarRequisicaoPerfilEmpresa = useRequisicaoCancelavel();

  useEffect(() => {
    let ativo = true;

    void obterSessao()
      .then((sessao) => {
        if (ativo) setPermissoes(sessao?.permissoes ?? []);
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
  const podeAjustarUsuarios = possuiPermissao('cliente.usuarios.gerenciar');
  const podeGerenciarConvites = possuiPermissao('cliente.convites.gerenciar');
  const podeGerenciarConfiguracoes = possuiPermissao('cliente.configuracoes.gerenciar');
  const podeLerFinanceiro = possuiPermissao('agenda.financeiro.ler');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    void obterResumoPortalCliente()
      .then((dados) => {
        if (ativo) setResumo(dados);
      })
      .catch((erroAtual) => {
        if (ativo) setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar conta.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const carregarUsuarios = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicaoUsuarios();
    setCarregandoUsuarios(true);
    setErroUsuarios(null);

    try {
      const dados = await listarUsuariosCliente({ signal });
      if (ehAtual()) setUsuarios(dados);
    } catch (erroAtual) {
      if (signal.aborted || !ehAtual()) return;
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar usuarios da conta.');
    } finally {
      if (ehAtual()) setCarregandoUsuarios(false);
    }
  }, [iniciarRequisicaoUsuarios]);

  const carregarConvites = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicaoConvites();
    setCarregandoConvites(true);
    setErroUsuarios(null);

    try {
      const dados = await listarConvitesUsuariosCliente({ signal });
      if (ehAtual()) setConvites(dados);
    } catch (erroAtual) {
      if (signal.aborted || !ehAtual()) return;
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar convites administrativos.');
    } finally {
      if (ehAtual()) setCarregandoConvites(false);
    }
  }, [iniciarRequisicaoConvites]);

  const carregarHistoricoConvites = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicaoHistoricoConvites();
    setCarregandoHistoricoConvites(true);
    setErroUsuarios(null);

    try {
      const dados = await listarHistoricoConvitesUsuariosCliente({ signal });
      if (ehAtual()) setHistoricoConvites(dados);
    } catch (erroAtual) {
      if (signal.aborted || !ehAtual()) return;
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar historico de convites.');
    } finally {
      if (ehAtual()) setCarregandoHistoricoConvites(false);
    }
  }, [iniciarRequisicaoHistoricoConvites]);

  const carregarConfiguracoes = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicaoConfiguracoes();
    setCarregandoConfiguracoes(true);
    setErroConfiguracoes(null);

    try {
      const dados = await obterConfiguracoesCliente({ signal });
      if (!ehAtual()) return;
      setConfiguracoes(dados);
      setFormularioConfiguracoes({
        nome: dados.nome,
        timezone: dados.timezone,
        idioma: dados.idioma,
        canaisPadrao: dados.canaisPadrao,
        marca: dados.marca
      });
    } catch (erroAtual) {
      if (signal.aborted || !ehAtual()) return;
      setErroConfiguracoes(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar configuracoes da conta.');
    } finally {
      if (ehAtual()) setCarregandoConfiguracoes(false);
    }
  }, [iniciarRequisicaoConfiguracoes]);

  const carregarPerfilEmpresa = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicaoPerfilEmpresa();
    setCarregandoPerfilEmpresa(true);
    setErroPerfilEmpresa(null);

    try {
      const dados = await obterPerfilEmpresaCliente({ signal });
      if (!ehAtual()) return;
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
      if (signal.aborted || !ehAtual()) return;
      setErroPerfilEmpresa(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar perfil fiscal.');
    } finally {
      if (ehAtual()) setCarregandoPerfilEmpresa(false);
    }
  }, [iniciarRequisicaoPerfilEmpresa]);

  async function convidarUsuario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoUsuario(true);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await criarUsuarioCliente({
        email: formularioUsuario.email.trim(),
        role: formularioUsuario.role,
        ...(formularioUsuario.role === 'Professional'
          ? {
              nomeProfissional: formularioUsuario.nomeProfissional.trim(),
              registroProfissional: formularioUsuario.registroProfissional.trim() || undefined,
              especialidade: formularioUsuario.especialidade.trim() || undefined
            }
          : {})
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

  async function desativarUsuario(id: string) {
    setDesativandoUsuarioId(id);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await desativarUsuarioCliente(id);
      await carregarUsuarios();
      await carregarConvites();
      await carregarHistoricoConvites();
      setSucessoUsuarios('Usuario desativado.');
      setConfirmacaoUsuario(null);
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao desativar usuario.');
    } finally {
      setDesativandoUsuarioId(null);
    }
  }

  async function ajustarPapelUsuario(id: string, papelAtual: string) {
    const role = papeisUsuarios[id] ?? papelAtual;
    if (role !== 'Professional' && role !== 'Collaborator') return;
    setAjustandoUsuarioId(id);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await atualizarPapelUsuarioCliente(id, {
        role,
        ...(role === 'Professional' ? { nomeProfissional: nomesProfissionais[id]?.trim() || undefined } : {})
      });
      await carregarUsuarios();
      setSucessoUsuarios('Permissoes do usuario atualizadas. O novo acesso vale no proximo login.');
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao atualizar permissoes do usuario.');
    } finally {
      setAjustandoUsuarioId(null);
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
    setAcaoConviteUsuarioId(usuarioId);
    setErroUsuarios(null);
    setSucessoUsuarios(null);

    try {
      await revogarConviteUsuarioCliente(usuarioId);
      await carregarUsuarios();
      await carregarConvites();
      await carregarHistoricoConvites();
      setSucessoUsuarios(`Convite revogado para ${email}.`);
      setConfirmacaoUsuario(null);
    } catch (erroAtual) {
      setErroUsuarios(erroAtual instanceof Error ? erroAtual.message : 'Falha ao revogar convite.');
    } finally {
      setAcaoConviteUsuarioId(null);
    }
  }

  async function confirmarAcaoUsuario() {
    if (!confirmacaoUsuario) return;
    if (confirmacaoUsuario.tipo === 'desativar') {
      await desativarUsuario(confirmacaoUsuario.id);
    } else {
      await revogarConvite(confirmacaoUsuario.id, confirmacaoUsuario.email);
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

    if (podeLerUsuarios) void carregarUsuarios();
    else setCarregandoUsuarios(false);

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
        detalhe: resumo ? 'Dados principais da clinica' : 'Atualizando dados da conta'
      },
      {
        rotulo: 'Plano atual',
        valor: resumo?.assinatura.plano ?? 'Carregando plano',
        detalhe: resumo ? `Status ${resumo.assinatura.status}` : 'Validando assinatura'
      },
      {
        rotulo: 'Usuarios ativos',
        valor: resumo
          ? formatarQuantidade(resumo.usuarios.totalAtivos, 'usuario ativo', 'usuarios ativos')
          : 'Carregando usuarios',
        detalhe: resumo
          ? `${formatarQuantidade(resumo.usuarios.clientes, 'cliente', 'clientes')} na conta`
          : 'Separando perfis'
      }
    ],
    [resumo]
  );
  const podeVerGestaoUsuarios = podeLerUsuarios || podeConvidarUsuarios || podeGerenciarConvites;
  const alertasAssinatura = resumo?.assinatura.alertas ?? [];
  const planoRecomendado = resumo ? obterProximoPlano(resumo.assinatura.planoId) : null;
  const bloqueioAssinatura = assinaturaBloqueada(resumo?.assinatura.status);
  const etapasAtivacao = [
    { rotulo: 'Dados da clinica', concluida: Boolean(resumo?.conta.nome) },
    { rotulo: 'Equipe com acesso', concluida: Boolean(usuarios?.total) },
    {
      rotulo: 'Comunicacoes definidas',
      concluida: Boolean(configuracoes && Object.values(configuracoes.canaisPadrao).some(Boolean))
    },
    { rotulo: 'Dados fiscais', concluida: Boolean(perfilEmpresa?.nomeLegal) }
  ];
  const etapasConcluidas = etapasAtivacao.filter((etapa) => etapa.concluida).length;

  return {
    areaAtiva,
    setAreaAtiva,
    resumo,
    usuarios,
    convites,
    historicoConvites,
    configuracoes,
    perfilEmpresa,
    erro,
    erroUsuarios,
    erroConfiguracoes,
    erroPerfilEmpresa,
    sucessoUsuarios,
    sucessoAssinatura,
    erroAssinatura,
    sucessoConfiguracoes,
    sucessoPerfilEmpresa,
    carregando,
    carregandoUsuarios,
    carregandoConvites,
    carregandoHistoricoConvites,
    carregandoConfiguracoes,
    carregandoPerfilEmpresa,
    salvandoUsuario,
    enviandoAssinatura,
    salvandoConfiguracoes,
    salvandoPerfilEmpresa,
    desativandoUsuarioId,
    ajustandoUsuarioId,
    papeisUsuarios,
    setPapeisUsuarios,
    nomesProfissionais,
    setNomesProfissionais,
    acaoConviteUsuarioId,
    formularioUsuario,
    setFormularioUsuario,
    formularioConfiguracoes,
    setFormularioConfiguracoes,
    formularioPerfilEmpresa,
    setFormularioPerfilEmpresa,
    confirmacaoUsuario,
    setConfirmacaoUsuario,
    podeLerUsuarios,
    podeConvidarUsuarios,
    podeDesativarUsuarios,
    podeAjustarUsuarios,
    podeGerenciarConvites,
    podeGerenciarConfiguracoes,
    podeLerFinanceiro,
    podeVerGestaoUsuarios,
    indicadores,
    alertasAssinatura,
    planoRecomendado,
    bloqueioAssinatura,
    etapasAtivacao,
    etapasConcluidas,
    carregarUsuarios,
    convidarUsuario,
    ajustarPapelUsuario,
    reenviarConvite,
    confirmarAcaoUsuario,
    solicitarAjusteAssinatura,
    salvarConfiguracoes,
    salvarPerfilEmpresa
  };
}

export type PortalClienteController = ReturnType<typeof usePortalCliente>;
