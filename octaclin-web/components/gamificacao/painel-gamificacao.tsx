'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Award, CheckCircle2, MessageSquare, RefreshCcw, Save, Trophy, UsersRound } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  BadgeApi,
  CirculoPacientesApi,
  DesafioApi,
  ParticipacaoDesafioApi,
  carregarBootstrapGamificacao,
  carregarRankingDesafio,
  concederBadge,
  criarBadge,
  criarCirculo,
  criarDesafio,
  criarPost,
  entrarCirculo,
  atualizarProgressoDesafio
} from '@/lib/gamificacao-api';
import { PacienteResumo, ProfissionalResumo, RespostaPaginada } from '@/lib/cadastros-api';

interface FormularioCirculo {
  profissionalId: string;
  pacienteId: string;
  nome: string;
  objetivo: string;
  privado: boolean;
}

interface FormularioPost {
  circuloId: string;
  pacienteId: string;
  conteudo: string;
}

interface FormularioDesafio {
  profissionalId: string;
  pacienteId: string;
  titulo: string;
  descricao: string;
  pontos: string;
}

interface FormularioBadge {
  pacienteId: string;
  nome: string;
  descricao: string;
  iconeSvg: string;
}

const circuloInicial: FormularioCirculo = {
  profissionalId: '',
  pacienteId: '',
  nome: 'Grupo de adesao semanal',
  objetivo: 'Acompanhar consistencia alimentar e rotina de check-ins.',
  privado: true
};

const postInicial: FormularioPost = {
  circuloId: '',
  pacienteId: '',
  conteudo: 'Completei meu check-in e mantive meu plano alimentar hoje.'
};

const desafioInicial: FormularioDesafio = {
  profissionalId: '',
  pacienteId: '',
  titulo: '7 dias de check-in',
  descricao: 'Pontuar pacientes por check-ins consecutivos.',
  pontos: '25'
};

const badgeInicial: FormularioBadge = {
  pacienteId: '',
  nome: 'Consistencia inicial',
  descricao: 'Primeira conquista de adesao no OctaClin.',
  iconeSvg: 'award'
};

function dataIsoDias(delta: number) {
  const data = new Date();
  data.setDate(data.getDate() + delta);
  return data.toISOString();
}

function nomePaciente(pacientes: PacienteResumo[], id: string) {
  return pacientes.find((paciente) => paciente.id === id)?.nome ?? id;
}

function resumirJson(valor: unknown) {
  return JSON.stringify(valor);
}

export function PainelGamificacao() {
  const [profissionais, setProfissionais] = useState<RespostaPaginada<ProfissionalResumo> | null>(null);
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [circulos, setCirculos] = useState<CirculoPacientesApi[]>([]);
  const [desafios, setDesafios] = useState<DesafioApi[]>([]);
  const [badges, setBadges] = useState<BadgeApi[]>([]);
  const [ranking, setRanking] = useState<ParticipacaoDesafioApi[]>([]);
  const [circulo, setCirculo] = useState<FormularioCirculo>(circuloInicial);
  const [post, setPost] = useState<FormularioPost>(postInicial);
  const [desafio, setDesafio] = useState<FormularioDesafio>(desafioInicial);
  const [badge, setBadge] = useState<FormularioBadge>(badgeInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const bootstrap = await carregarBootstrapGamificacao();
      const profissionalId = bootstrap.profissionais.itens[0]?.id ?? '';
      const pacienteId = bootstrap.pacientes.itens[0]?.id ?? '';
      setProfissionais(bootstrap.profissionais);
      setPacientes(bootstrap.pacientes);
      setCirculos(bootstrap.circulos);
      setDesafios(bootstrap.desafios);
      setBadges(bootstrap.badges);
      setCirculo((atual) => ({ ...atual, profissionalId: atual.profissionalId || profissionalId, pacienteId: atual.pacienteId || pacienteId }));
      setPost((atual) => ({ ...atual, circuloId: atual.circuloId || bootstrap.circulos[0]?.id || '', pacienteId: atual.pacienteId || pacienteId }));
      setDesafio((atual) => ({ ...atual, profissionalId: atual.profissionalId || profissionalId, pacienteId: atual.pacienteId || pacienteId }));
      setBadge((atual) => ({ ...atual, pacienteId: atual.pacienteId || pacienteId }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar gamificacao.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvarCirculo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarCirculo({
        profissionalId: circulo.profissionalId,
        nome: circulo.nome,
        objetivo: circulo.objetivo,
        privado: circulo.privado
      });
      await entrarCirculo(criado.id, { pacienteId: circulo.pacienteId });
      setCirculos((atuais) => [criado, ...atuais]);
      setPost((atual) => ({ ...atual, circuloId: criado.id, pacienteId: circulo.pacienteId }));
      setSucesso('Circulo criado e paciente adicionado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar circulo.');
    } finally {
      setSalvando(false);
    }
  }

  async function publicarPost(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarPost({
        circuloId: post.circuloId,
        pacienteId: post.pacienteId,
        conteudo: post.conteudo
      });
      setSucesso(`Post criado com status ${criado.status}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar post.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarDesafio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarDesafio({
        profissionalId: desafio.profissionalId,
        titulo: desafio.titulo,
        descricao: desafio.descricao,
        regraPontuacao: { evento: 'checkin', pontosPorEvento: 10 },
        iniciaEm: dataIsoDias(0),
        terminaEm: dataIsoDias(7)
      });
      const participacao = await atualizarProgressoDesafio({
        desafioId: criado.id,
        pacienteId: desafio.pacienteId,
        pontos: Number(desafio.pontos || 0),
        progresso: { checkins: Number(desafio.pontos || 0) / 10 }
      });
      setDesafios((atuais) => [criado, ...atuais]);
      setRanking([participacao]);
      setSucesso('Desafio criado e progresso atualizado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar desafio.');
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarRanking(desafioId: string) {
    setErro(null);
    setSucesso(null);
    try {
      setRanking(await carregarRankingDesafio(desafioId));
      setSucesso('Ranking atualizado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar ranking.');
    }
  }

  async function salvarBadge(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarBadge({
        nome: badge.nome,
        descricao: badge.descricao,
        iconeSvg: badge.iconeSvg,
        regraConquista: { tipo: 'manual' }
      });
      await concederBadge({ pacienteId: badge.pacienteId, badgeId: criado.id });
      setBadges((atuais) => [criado, ...atuais]);
      setSucesso('Badge criado e concedido.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao conceder badge.');
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const listaProfissionais = profissionais?.itens ?? [];
  const listaPacientes = pacientes?.itens ?? [];

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Gamificacao</h2>
          <p className="mt-1 text-sm text-texto-suave">
            {circulos.length} circulos, {desafios.length} desafios, {badges.length} badges persistidos
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
        <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={salvarCirculo} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <UsersRound size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Circulo</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-circulo-profissional">Profissional</Rotulo>
              <Selecao
                id="gamificacao-circulo-profissional"
                value={circulo.profissionalId}
                onChange={(evento) => setCirculo((atual) => ({ ...atual, profissionalId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {listaProfissionais.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-circulo-paciente">Paciente inicial</Rotulo>
              <Selecao
                id="gamificacao-circulo-paciente"
                value={circulo.pacienteId}
                onChange={(evento) => setCirculo((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {listaPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="gamificacao-circulo-nome">Nome</Rotulo>
              <Campo
                id="gamificacao-circulo-nome"
                value={circulo.nome}
                onChange={(evento) => setCirculo((atual) => ({ ...atual, nome: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="gamificacao-circulo-objetivo">Objetivo</Rotulo>
              <AreaTexto
                id="gamificacao-circulo-objetivo"
                value={circulo.objetivo}
                onChange={(evento) => setCirculo((atual) => ({ ...atual, objetivo: evento.target.value }))}
                required
              />
            </div>
          </div>
          <label className="mt-3 flex items-center justify-between rounded-md border border-linha bg-fundo px-3 py-2">
            <span className="text-sm font-medium text-tinta">Privado</span>
            <input
              type="checkbox"
              checked={circulo.privado}
              onChange={(evento) => setCirculo((atual) => ({ ...atual, privado: evento.target.checked }))}
              className="h-5 w-5 accent-primaria"
            />
          </label>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !circulo.profissionalId || !circulo.pacienteId}>
              <Save size={16} />
              Criar circulo
            </Botao>
          </div>
        </form>

        <form onSubmit={publicarPost} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Post de comunidade</h3>
          </div>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-post-circulo">Circulo</Rotulo>
              <Selecao
                id="gamificacao-post-circulo"
                value={post.circuloId}
                onChange={(evento) => setPost((atual) => ({ ...atual, circuloId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Crie um circulo
                </option>
                {circulos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-post-paciente">Paciente</Rotulo>
              <Selecao
                id="gamificacao-post-paciente"
                value={post.pacienteId}
                onChange={(evento) => setPost((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {listaPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-post-conteudo">Conteudo</Rotulo>
              <AreaTexto
                id="gamificacao-post-conteudo"
                value={post.conteudo}
                onChange={(evento) => setPost((atual) => ({ ...atual, conteudo: evento.target.value }))}
                required
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !post.circuloId || !post.pacienteId}>
              <Save size={16} />
              Publicar
            </Botao>
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={salvarDesafio} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Desafio</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-desafio-profissional">Profissional</Rotulo>
              <Selecao
                id="gamificacao-desafio-profissional"
                value={desafio.profissionalId}
                onChange={(evento) => setDesafio((atual) => ({ ...atual, profissionalId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {listaProfissionais.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-desafio-paciente">Paciente</Rotulo>
              <Selecao
                id="gamificacao-desafio-paciente"
                value={desafio.pacienteId}
                onChange={(evento) => setDesafio((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {listaPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="gamificacao-desafio-titulo">Titulo</Rotulo>
              <Campo
                id="gamificacao-desafio-titulo"
                value={desafio.titulo}
                onChange={(evento) => setDesafio((atual) => ({ ...atual, titulo: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="gamificacao-desafio-descricao">Descricao</Rotulo>
              <AreaTexto
                id="gamificacao-desafio-descricao"
                value={desafio.descricao}
                onChange={(evento) => setDesafio((atual) => ({ ...atual, descricao: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-desafio-pontos">Pontos</Rotulo>
              <Campo
                id="gamificacao-desafio-pontos"
                type="number"
                min={0}
                value={desafio.pontos}
                onChange={(evento) => setDesafio((atual) => ({ ...atual, pontos: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !desafio.profissionalId || !desafio.pacienteId}>
              <Save size={16} />
              Criar desafio
            </Botao>
          </div>
        </form>

        <form onSubmit={salvarBadge} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Award size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Badge</h3>
          </div>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-badge-paciente">Paciente</Rotulo>
              <Selecao
                id="gamificacao-badge-paciente"
                value={badge.pacienteId}
                onChange={(evento) => setBadge((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {listaPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-badge-nome">Nome</Rotulo>
              <Campo
                id="gamificacao-badge-nome"
                value={badge.nome}
                onChange={(evento) => setBadge((atual) => ({ ...atual, nome: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-badge-icone">Icone</Rotulo>
              <Campo
                id="gamificacao-badge-icone"
                value={badge.iconeSvg}
                onChange={(evento) => setBadge((atual) => ({ ...atual, iconeSvg: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="gamificacao-badge-descricao">Descricao</Rotulo>
              <AreaTexto
                id="gamificacao-badge-descricao"
                value={badge.descricao}
                onChange={(evento) => setBadge((atual) => ({ ...atual, descricao: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !badge.pacienteId}>
              <Save size={16} />
              Conceder
            </Botao>
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h3 className="text-sm font-semibold">Ranking</h3>
          </div>
          <div className="max-h-[340px] divide-y divide-linha overflow-auto">
            {ranking.length ? (
              ranking.map((item) => (
                <div key={item.id} className="grid gap-1 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{nomePaciente(listaPacientes, item.pacienteId)}</strong>
                    <span className="font-semibold">{Number(item.pontos).toFixed(1)} pts</span>
                  </div>
                  <p className="break-all text-xs text-texto-suave">{resumirJson(item.progresso)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhum ranking carregado." />
            )}
          </div>
          {desafios[0] ? (
            <div className="border-t border-linha p-3">
              <Botao type="button" onClick={() => void atualizarRanking(desafios[0].id)}>
                <RefreshCcw size={16} />
                Atualizar ranking
              </Botao>
            </div>
          ) : null}
        </aside>

        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h3 className="text-sm font-semibold">Registros persistidos</h3>
          </div>
          <div className="grid gap-3 p-4 text-sm">
            <div className="rounded-md border border-linha bg-fundo p-3">
              <p className="text-xs font-semibold uppercase text-texto-suave">Circulos</p>
              <p className="mt-1 text-tinta">{circulos.map((item) => item.nome).join(', ') || 'Nenhum circulo criado.'}</p>
            </div>
            <div className="rounded-md border border-linha bg-fundo p-3">
              <p className="text-xs font-semibold uppercase text-texto-suave">Desafios</p>
              <p className="mt-1 text-tinta">{desafios.map((item) => item.titulo).join(', ') || 'Nenhum desafio criado.'}</p>
            </div>
            <div className="rounded-md border border-linha bg-fundo p-3">
              <p className="text-xs font-semibold uppercase text-texto-suave">Badges</p>
              <p className="mt-1 text-tinta">{badges.map((item) => item.nome).join(', ') || 'Nenhum badge criado.'}</p>
            </div>
          </div>
        </aside>
      </section>
    </section>
  );
}
