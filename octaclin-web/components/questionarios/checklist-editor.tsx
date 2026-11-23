'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { conferirQuestionario, consultarVersaoEditor, type ValidacaoEditorApi } from '@/lib/questionarios-api';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

const mensagens: Record<string, string> = {
  titulo_ausente: 'Informe o título do questionário.', enunciado_ausente: 'Informe o enunciado da pergunta.',
  configuracao_invalida: 'Revise os limites e a configuração desta pergunta.',
  opcoes_insuficientes: 'Cadastre pelo menos duas opções para a pergunta de múltipla escolha.',
  dados_invalidos: 'Revise os campos e os valores desta pergunta.'
};
const campos: Record<string, string> = { titulo: 'título', enunciado: 'enunciado', peso: 'peso', categoriaId: 'categoria', tipo: 'tipo', configuracao: 'configuração', opcoes: 'opções', dados: 'campos' };
export function ChecklistEditor({ workspace: w }: { workspace: WorkspaceQuestionarios }) {
  // Identidade por geração editorial: A→B→A não recupera prévia/erro antigos.
  const contexto = useMemo(() => ({ questionario: w.questionarioAtual, titulo: w.titulo, perguntas: w.perguntas,
    pendentes: w.perguntasPendentes, salvando: w.salvando, carregando: w.carregandoPerguntas }),
  [w.questionarioAtual, w.titulo, w.perguntas, w.perguntasPendentes, w.salvando, w.carregandoPerguntas]);
  const atual = useRef(contexto), montado = useRef(false), emVoo = useRef(false);
  const [estado, setEstado] = useState<{ contexto: typeof contexto; dados?: ValidacaoEditorApi; erro?: boolean; carregando?: boolean } | null>(null);
  const [foco, setFoco] = useState<{ campo: string; sequencia: number } | null>(null);
  useLayoutEffect(() => { atual.current = contexto; });
  useLayoutEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    if (!foco) return;
    const id = ({ enunciado: 'enunciado', peso: 'peso', categoriaId: 'categoria', tipo: 'tipo', configuracao: 'configuracao-pergunta', opcoes: 'configuracao-pergunta', dados: 'enunciado' } as Record<string, string>)[foco.campo];
    document.getElementById(id)?.focus();
  }, [foco, w.selecionadaId]);
  const visivel = estado?.contexto === contexto ? estado : null;
  async function conferir(versaoAtual = false) {
    const q = w.questionarioAtual;
    if (!q || emVoo.current || w.salvando || w.carregandoPerguntas) return;
    emVoo.current = true; setEstado({ contexto, carregando: true });
    try {
      const versao = versaoAtual ? (await consultarVersaoEditor(q.id)).versao : q.versao;
      const dados = await conferirQuestionario(q.id, {
        versaoEsperada: versao, titulo: w.titulo,
        perguntas: w.perguntas.filter(p => w.perguntasPendentes.includes(p.id)).map(p => ({ id: p.id, dados: {
          categoriaId: p.categoriaId, tipo: p.tipo, enunciado: p.enunciado, peso: p.peso, obrigatoria: p.obrigatoria,
          configuracao: p.configuracao, chaveClinica: p.chaveClinica, visivelBiblioteca: p.visivelBiblioteca,
          opcoes: p.tipo === 'multipla_escolha' ? p.opcoes.map(o => ({ rotulo: o.rotulo, valor: o.valor, imagemUrl: o.imagemUrl })) : []
        } }))
      });
      if (montado.current && atual.current === contexto) setEstado({ contexto, dados });
    } catch { if (montado.current && atual.current === contexto) setEstado({ contexto, erro: true }); }
    finally { emVoo.current = false; }
  }
  return <div data-qst10-checklist className="space-y-3 border-b border-linha p-4">
    <Botao onClick={() => void conferir()} disabled={!w.questionarioAtual || w.salvando || w.carregandoPerguntas || visivel?.carregando}>Conferir questionário</Botao>
    {visivel && <section role="region" aria-label="Checklist do questionário" className="space-y-2 rounded-md border border-linha p-3 text-sm text-tinta">
      <p className="font-semibold">Checklist do questionário</p>
      <p>Conferência sem salvar. Inclui as edições locais pendentes; não substitui as validações ao salvar ou enviar.</p>
      {visivel.carregando && <p role="status">Conferindo as regras do questionário...</p>}
      {visivel.erro && <><p role="alert">Não foi possível concluir a conferência. O acesso ou a versão pode ter mudado. Suas edições locais foram preservadas.</p><p>A ação abaixo apenas refaz a conferência; não substitui nem salva suas edições.</p><Botao onClick={() => void conferir(true)}>Conferir com a versão salva atual</Botao></>}
      {visivel.dados && <><p>Versão salva utilizada: {visivel.dados.versao}, com as edições locais ainda não salvas.</p>
        {!visivel.dados.problemas.length ? <p role="status">Nenhuma pendência nas regras verificadas. Isso não garante a adequação clínica do formulário.</p> : <ul className="space-y-2">{visivel.dados.problemas.map((p, i) => {
          const indice = w.perguntas.findIndex(pergunta => pergunta.id === p.perguntaId);
          return <li key={`${p.perguntaId ?? 'titulo'}-${p.campo}-${i}`}><p>{mensagens[p.codigo] ?? 'Revise os campos desta pergunta.'}</p><Botao aria-label={p.perguntaId ? `Corrigir pergunta ${indice + 1}: ${campos[p.campo] ?? 'campos'}` : 'Corrigir título'} onClick={() => {
            if (!p.perguntaId) { w.setAreaAtiva('formularios'); requestAnimationFrame(() => document.getElementById('titulo')?.focus()); return; }
            w.setSelecionadaId(p.perguntaId); setFoco(anterior => ({ campo: p.campo, sequencia: (anterior?.sequencia ?? 0) + 1 }));
          }}>Corrigir {p.perguntaId ? `pergunta ${indice + 1}` : 'título'}</Botao></li>;
        })}</ul>}</>}
    </section>}
  </div>;
}
