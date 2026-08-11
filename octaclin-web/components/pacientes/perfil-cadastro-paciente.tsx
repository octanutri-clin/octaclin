'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, ContactRound, Save } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { obterSessao } from '@/lib/auth-api';
import {
  FiscalCadastroPacienteApi,
  PerfilCadastroPacienteApi,
  obterFiscalCadastroPaciente,
  obterPerfilCadastroPaciente,
  salvarSecaoCadastroPaciente
} from '@/lib/perfil-cadastro-paciente-api';

interface Props { pacienteId: string; }

const vazio: PerfilCadastroPacienteApi = { identificacao: {}, contato: {}, operacao: {} };

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : 'Nao foi possivel salvar esta secao.';
}

export function PerfilCadastroPaciente({ pacienteId }: Props) {
  const [aberto, setAberto] = useState(false);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [podeVerFiscal, setPodeVerFiscal] = useState(false);
  const [perfil, setPerfil] = useState<PerfilCadastroPacienteApi>(vazio);
  const [fiscal, setFiscal] = useState<FiscalCadastroPacienteApi>({});
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

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
  }

  async function salvar(secao: 'identificacao' | 'contato' | 'operacao' | 'fiscal') {
    setSalvando(secao);
    setErro(null);
    setSucesso(null);
    try {
      if (secao === 'identificacao') await salvarSecaoCadastroPaciente(pacienteId, secao, perfil.identificacao ?? {});
      if (secao === 'contato') await salvarSecaoCadastroPaciente(pacienteId, secao, perfil.contato ?? {});
      if (secao === 'operacao') await salvarSecaoCadastroPaciente(pacienteId, secao, perfil.operacao ?? {});
      if (secao === 'fiscal') await salvarSecaoCadastroPaciente(pacienteId, secao, fiscal);
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
            <Secao titulo="Identificacao complementar" descricao="Nome de uso e preferencias de identificacao no atendimento.">
              <Campo rotulo="Nome de uso">
                <input className="campo" value={perfil.identificacao?.nomeUso ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { nomeUso: evento.target.value } }))} />
              </Campo>
              <SalvarSecao carregando={salvando === 'identificacao'} aoSalvar={() => void salvar('identificacao')} />
            </Secao>

            <Secao titulo="Contato e endereco" descricao="Canal usado para comunicacoes. Telefone deve incluir DDI, por exemplo +5511999999999.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="E-mail"><input className="campo" type="email" value={perfil.contato?.email ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, email: evento.target.value } }))} /></Campo>
                <Campo rotulo="Telefone"><input className="campo" inputMode="tel" value={perfil.contato?.telefone ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, telefone: evento.target.value } }))} /></Campo>
              </div>
              <Campo rotulo="Canal preferido">
                <select className="campo" value={perfil.contato?.canalPreferido ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, canalPreferido: evento.target.value as 'email' | 'whatsapp' | 'telefone' } }))}>
                  <option value="">Nao definido</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option>
                </select>
              </Campo>
              <div className="grid gap-3 md:grid-cols-3">
                <Campo rotulo="CEP"><input className="campo" value={perfil.contato?.endereco?.cep ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, cep: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Cidade"><input className="campo" value={perfil.contato?.endereco?.cidade ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, cidade: evento.target.value } } }))} /></Campo>
                <Campo rotulo="UF"><input className="campo" maxLength={2} value={perfil.contato?.endereco?.estado ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, estado: evento.target.value.toUpperCase() } } }))} /></Campo>
              </div>
              <SalvarSecao carregando={salvando === 'contato'} aoSalvar={() => void salvar('contato')} />
            </Secao>

            <Secao titulo="Operacao e responsavel" descricao="Origem, etiquetas internas e pessoa responsavel quando aplicavel.">
              <div className="grid gap-3 md:grid-cols-2">
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

            {podeVerFiscal ? <Secao titulo="Dados fiscais opcionais" descricao="Visivel apenas para quem tem permissao financeira.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Nome do pagador"><input className="campo" value={fiscal.nomePagador ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, nomePagador: evento.target.value }))} /></Campo>
                <Campo rotulo="CPF ou CNPJ"><input className="campo" value={fiscal.documentoPagador ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, documentoPagador: evento.target.value }))} /></Campo>
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
