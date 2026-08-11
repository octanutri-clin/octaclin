'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, ContactRound, KeyRound, Link2, Save } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { obterSessao } from '@/lib/auth-api';
import { criarConvitePaciente } from '@/lib/convites-paciente-api';
import {
  FiscalCadastroPacienteApi,
  PerfilCadastroPacienteApi,
  atualizarDadosBasicosPaciente,
  obterFiscalCadastroPaciente,
  obterPerfilCadastroPaciente,
  salvarSecaoCadastroPaciente
} from '@/lib/perfil-cadastro-paciente-api';

interface Props {
  pacienteId: string;
  nomeCompleto: string;
  dataNascimento?: string;
  aoAtualizarFicha: () => void;
}

const vazio: PerfilCadastroPacienteApi = { identificacao: {}, contato: {}, operacao: {} };

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : 'Nao foi possivel salvar esta secao.';
}

function removerCamposVazios<T extends object>(valor: T): T {
  const resultado = Object.entries(valor).reduce<Record<string, unknown>>((acumulado, [chave, campo]) => {
    if (typeof campo === 'string') {
      if (campo.trim()) acumulado[chave] = campo.trim();
      return acumulado;
    }
    if (Array.isArray(campo)) {
      if (campo.length) acumulado[chave] = campo;
      return acumulado;
    }
    if (campo && typeof campo === 'object') {
      const objeto = removerCamposVazios(campo as object);
      if (Object.keys(objeto).length) acumulado[chave] = objeto;
      return acumulado;
    }
    if (campo !== undefined && campo !== null) acumulado[chave] = campo;
    return acumulado;
  }, {});
  return resultado as T;
}

export function PerfilCadastroPaciente({ pacienteId, nomeCompleto: nomeInicial, dataNascimento: nascimentoInicial, aoAtualizarFicha }: Props) {
  const [aberto, setAberto] = useState(false);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [podeVerFiscal, setPodeVerFiscal] = useState(false);
  const [perfil, setPerfil] = useState<PerfilCadastroPacienteApi>(vazio);
  const [fiscal, setFiscal] = useState<FiscalCadastroPacienteApi>({});
  const [nomeCompleto, setNomeCompleto] = useState(nomeInicial);
  const [dataNascimento, setDataNascimento] = useState(nascimentoInicial ?? '');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);

  useEffect(() => {
    void obterSessao().then((sessao) => {
      const permissoes = sessao?.permissoes ?? [];
      setPodeGerenciar(permissoes.includes('pacientes.gerenciar'));
      setPodeVerFiscal(permissoes.includes('agenda.financeiro.ler'));
    });
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const perfilAtual = await obterPerfilCadastroPaciente(pacienteId);
      setPerfil({ identificacao: {}, contato: {}, operacao: {}, ...perfilAtual });
      if (podeVerFiscal) setFiscal(await obterFiscalCadastroPaciente(pacienteId));
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      setCarregando(false);
    }
  }, [pacienteId, podeVerFiscal]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  function abrir() {
    setAberto(true);
    setSucesso(null);
    setNomeCompleto(nomeInicial);
    setDataNascimento(nascimentoInicial ?? '');
    setLinkConvite(null);
  }

  async function criarConvitePortal() {
    const email = perfil.contato?.email?.trim();
    if (!email) {
      setErro('Salve um e-mail de contato antes de criar o convite de acesso.');
      return;
    }

    setSalvando('portal');
    setErro(null);
    setSucesso(null);
    setLinkConvite(null);
    try {
      const convite = await criarConvitePaciente(pacienteId, email);
      setLinkConvite(convite.linkAtivacao);
      try {
        await navigator.clipboard.writeText(convite.linkAtivacao);
        setSucesso('Convite criado e link copiado. A emissao anterior, se existia, foi revogada.');
      } catch {
        setSucesso('Convite criado. Copie o link temporario exibido abaixo.');
      }
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      setSalvando(null);
    }
  }

  async function salvarIdentificacao() {
    setSalvando('identificacao');
    setErro(null);
    setSucesso(null);
    try {
      await atualizarDadosBasicosPaciente(pacienteId, {
        nome: nomeCompleto.trim(),
        dataNascimento: dataNascimento || undefined
      });
      await salvarSecaoCadastroPaciente(pacienteId, 'identificacao', removerCamposVazios(perfil.identificacao ?? {}));
      aoAtualizarFicha();
      setSucesso('Identificacao salva com seguranca.');
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      setSalvando(null);
    }
  }

  async function salvar(secao: 'identificacao' | 'contato' | 'operacao' | 'fiscal') {
    setSalvando(secao);
    setErro(null);
    setSucesso(null);
    try {
      if (secao === 'identificacao') await salvarSecaoCadastroPaciente(pacienteId, secao, perfil.identificacao ?? {});
      if (secao === 'contato') await salvarSecaoCadastroPaciente(pacienteId, secao, removerCamposVazios(perfil.contato ?? {}));
      if (secao === 'operacao') await salvarSecaoCadastroPaciente(pacienteId, secao, removerCamposVazios(perfil.operacao ?? {}));
      if (secao === 'fiscal') await salvarSecaoCadastroPaciente(pacienteId, secao, removerCamposVazios(fiscal));
      setSucesso('Secao salva com seguranca.');
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      setSalvando(null);
    }
  }

  if (!podeGerenciar) return null;

  return (
    <>
      <Botao type="button" variante="secundario" onClick={abrir} aria-label="Editar cadastro do paciente">
        <ContactRound size={16} /> Cadastro
      </Botao>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Cadastro do paciente" descricao="Salve cada secao separadamente. Dados clinicos pertencem a avaliacao e anamnese.">
        {carregando ? <BarraCarregamento visivel rotulo="Carregando cadastro" /> : null}
        {erro ? <AlertaOperacional mensagem={erro} className="mb-4" /> : null}
        {sucesso ? <p role="status" className="mb-4 rounded-md border border-sucesso-borda bg-sucesso-suave px-3 py-2 text-sm text-sucesso-forte">{sucesso}</p> : null}
        {!carregando ? (
          <div className="grid max-h-[65vh] gap-6 overflow-y-auto pr-1">
            <Secao titulo="Identificacao" descricao="Dados de identificacao do paciente. A condicao biologica fica restrita ao contexto clinico autorizado.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Nome completo"><input className="campo" autoComplete="name" value={nomeCompleto} onChange={(evento) => setNomeCompleto(evento.target.value)} required /></Campo>
                <Campo rotulo="Apelido ou nome de uso"><input className="campo" value={perfil.identificacao?.nomeUso ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { ...atual.identificacao, nomeUso: evento.target.value } }))} /></Campo>
                <Campo rotulo="Data de nascimento"><input className="campo" type="date" value={dataNascimento} onChange={(evento) => setDataNascimento(evento.target.value)} /></Campo>
                <Campo rotulo="Sexo">
                  <select className="campo" value={perfil.identificacao?.sexo ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { ...atual.identificacao, sexo: evento.target.value as 'feminino' | 'masculino' | 'intersexo' | 'nao_informar' } }))}>
                    <option value="">Nao informado</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="intersexo">Intersexo</option><option value="nao_informar">Prefiro nao informar</option>
                  </select>
                </Campo>
              </div>
              {perfil.identificacao?.sexo === 'feminino' ? <Campo rotulo="Condicao biologica">
                <select className="campo" value={perfil.identificacao?.condicaoBiologica ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { ...atual.identificacao, condicaoBiologica: evento.target.value as 'nao_gestante' | 'gestante' | 'lactante' | 'menopausa' } }))}>
                  <option value="">Nao informado</option><option value="nao_gestante">Nao gestante</option><option value="gestante">Gestante</option><option value="lactante">Lactante</option><option value="menopausa">Menopausa</option>
                </select>
              </Campo> : null}
              <SalvarSecao carregando={salvando === 'identificacao'} aoSalvar={() => void salvarIdentificacao()} />
            </Secao>

            <Secao titulo="Contato e endereco" descricao="Dados usados para comunicacao e localizacao do paciente.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="E-mail"><input className="campo" type="email" value={perfil.contato?.email ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, email: evento.target.value } }))} /></Campo>
                <Campo rotulo="Usuario do Instagram"><input className="campo" value={perfil.contato?.instagram ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, instagram: evento.target.value.replace(/^@/, '') } }))} /></Campo>
                <Campo rotulo="DDI"><input className="campo" inputMode="tel" placeholder="+55" value={perfil.contato?.ddi ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, ddi: evento.target.value } }))} /></Campo>
                <Campo rotulo="Celular com DDD"><input className="campo" inputMode="tel" placeholder="11999999999" value={perfil.contato?.celular ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, celular: evento.target.value.replace(/\D/g, '') } }))} /></Campo>
              </div>
              <Campo rotulo="Canal preferido">
                <select className="campo" value={perfil.contato?.canalPreferido ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, canalPreferido: evento.target.value as 'email' | 'whatsapp' | 'telefone' } }))}>
                  <option value="">Nao definido</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option>
                </select>
              </Campo>
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="CEP"><input className="campo" value={perfil.contato?.endereco?.cep ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, cep: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Endereco"><input className="campo" value={perfil.contato?.endereco?.logradouro ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, logradouro: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Bairro"><input className="campo" value={perfil.contato?.endereco?.bairro ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, bairro: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Cidade"><input className="campo" value={perfil.contato?.endereco?.cidade ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, cidade: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Estado"><input className="campo" maxLength={2} value={perfil.contato?.endereco?.estado ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, estado: evento.target.value.toUpperCase() } } }))} /></Campo>
              </div>
              <SalvarSecao carregando={salvando === 'contato'} aoSalvar={() => void salvar('contato')} />
            </Secao>

            <Secao titulo="Operacao e responsavel" descricao="Categoria, etiquetas internas e pessoa responsavel quando aplicavel.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Categoria do paciente"><input className="campo" value={perfil.operacao?.categoria ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, categoria: evento.target.value } }))} /></Campo>
                <Campo rotulo="Origem"><input className="campo" value={perfil.operacao?.origem ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, origem: evento.target.value } }))} /></Campo>
                <Campo rotulo="Proxima revisao"><input className="campo" type="date" value={perfil.operacao?.proximaRevisaoEm ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, proximaRevisaoEm: evento.target.value } }))} /></Campo>
              </div>
              <Campo rotulo="Etiquetas"><input className="campo" placeholder="Ex.: retorno, esportivo" value={(perfil.operacao?.tags ?? []).join(', ')} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, tags: evento.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) } }))} /></Campo>
              <div className="grid gap-3 md:grid-cols-3">
                <Campo rotulo="Responsavel"><input className="campo" value={perfil.operacao?.responsavel?.nome ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, responsavel: { ...atual.operacao?.responsavel, nome: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Parentesco"><input className="campo" value={perfil.operacao?.responsavel?.parentesco ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, responsavel: { ...atual.operacao?.responsavel, parentesco: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Contato do responsavel"><input className="campo" value={perfil.operacao?.responsavel?.contato ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, responsavel: { ...atual.operacao?.responsavel, contato: evento.target.value } } }))} /></Campo>
              </div>
              <SalvarSecao carregando={salvando === 'operacao'} aoSalvar={() => void salvar('operacao')} />
            </Secao>

            <Secao titulo="Acesso ao portal" descricao="Gere um convite somente apos conferir os dados de contato. O link expira e uma nova emissao invalida o convite pendente anterior.">
              <p className="text-sm text-texto-suave">E-mail de acesso: {perfil.contato?.email || 'Nao informado'}</p>
              <div className="flex flex-wrap justify-end gap-2">
                {linkConvite ? <Botao type="button" variante="secundario" onClick={() => void navigator.clipboard.writeText(linkConvite)}><Link2 size={16} /> Copiar link</Botao> : null}
                <Botao type="button" variante="secundario" onClick={() => void criarConvitePortal()} disabled={salvando === 'portal'}>
                  <KeyRound size={16} /> {salvando === 'portal' ? 'Criando convite' : 'Criar convite seguro'}
                </Botao>
              </div>
              {linkConvite ? <p className="break-all rounded-md border border-linha bg-superficie-hover px-3 py-2 text-xs text-texto-suave">{linkConvite}</p> : null}
            </Secao>

            {podeVerFiscal ? <Secao titulo="Dados fiscais opcionais" descricao="Visivel apenas para quem tem permissao financeira.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Nome do pagador"><input className="campo" value={fiscal.nomePagador ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, nomePagador: evento.target.value }))} /></Campo>
                <Campo rotulo="CPF do paciente"><input className="campo" inputMode="numeric" value={fiscal.cpf ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, cpf: evento.target.value.replace(/\D/g, '') }))} /></Campo>
              </div>
              <Campo rotulo="E-mail para recibo"><input className="campo" type="email" value={fiscal.emailRecibo ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, emailRecibo: evento.target.value }))} /></Campo>
              <SalvarSecao carregando={salvando === 'fiscal'} aoSalvar={() => void salvar('fiscal')} rotulo="Salvar dados fiscais" icone={<BadgeDollarSign size={16} />} />
            </Secao> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return <section className="grid gap-3 border-b border-linha pb-5 last:border-b-0"><div><h3 className="text-sm font-semibold text-tinta">{titulo}</h3><p className="mt-1 text-xs text-texto-suave">{descricao}</p></div>{children}</section>;
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs font-semibold text-texto-suave">{rotulo}{children}</label>;
}

function SalvarSecao({ carregando, aoSalvar, rotulo = 'Salvar secao', icone = <Save size={16} /> }: { carregando: boolean; aoSalvar: () => void; rotulo?: string; icone?: React.ReactNode }) {
  return <div className="flex justify-end"><Botao type="button" variante="secundario" onClick={aoSalvar} disabled={carregando}>{icone}{carregando ? 'Salvando' : rotulo}</Botao></div>;
}
