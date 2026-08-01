'use client';

import { useEffect } from 'react';
import { Abas } from '@/components/ui/abas';
import { AlertaOperacional, AlertaSucesso } from '@/components/ui/feedback';
import { AreaBiblioteca } from './area-biblioteca';
import { AreaDistribuicao } from './area-distribuicao';
import { AreaEditor } from './area-editor';
import { AreaFormularios } from './area-formularios';
import { AreaRespostas } from './area-respostas';
import { useWorkspaceQuestionarios } from './usar-workspace-questionarios';

type AreaQuestionarios = 'formularios' | 'editor' | 'biblioteca' | 'distribuicao' | 'respostas';

const areasQuestionarios: { id: AreaQuestionarios; rotulo: string }[] = [
  { id: 'formularios', rotulo: 'Formularios' },
  { id: 'editor', rotulo: 'Editor' },
  { id: 'biblioteca', rotulo: 'Biblioteca' },
  { id: 'distribuicao', rotulo: 'Distribuicoes' },
  { id: 'respostas', rotulo: 'Respostas' }
];

export function EditorQuestionario() {
  const workspace = useWorkspaceQuestionarios();
  const { erro, sucesso, alteracoesQuestionarioPendentes, alteracoesPerguntaPendentes, areaAtiva, setAreaAtiva, carregar } = workspace;

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="grid gap-4">
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}

      {alteracoesQuestionarioPendentes || alteracoesPerguntaPendentes ? (
        <p className="text-sm text-alerta-forte" role="status">
          Alteracoes pendentes: {alteracoesQuestionarioPendentes ? 'formulario' : ''}
          {alteracoesQuestionarioPendentes && alteracoesPerguntaPendentes ? ' e ' : ''}
          {alteracoesPerguntaPendentes ? 'pergunta selecionada' : ''}. Confirme antes de trocar de formulario.
        </p>
      ) : null}

      <Abas identificador="questionarios" abas={areasQuestionarios} ativaId={areaAtiva} aoMudar={(id) => setAreaAtiva(id as AreaQuestionarios)} rotulo="Areas de trabalho dos questionarios" />

      <div id={`questionarios-${areaAtiva}-painel`} role="tabpanel" aria-labelledby={`questionarios-${areaAtiva}-aba`}>
        {areaAtiva === 'formularios' ? <AreaFormularios workspace={workspace} /> : null}
        {areaAtiva === 'editor' ? <AreaEditor workspace={workspace} /> : null}
        {areaAtiva === 'biblioteca' ? <AreaBiblioteca workspace={workspace} /> : null}
        {areaAtiva === 'distribuicao' ? <AreaDistribuicao workspace={workspace} /> : null}
        {areaAtiva === 'respostas' ? <AreaRespostas workspace={workspace} /> : null}
      </div>
    </section>
  );
}
