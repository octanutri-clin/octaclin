'use client';

import { useEffect } from 'react';
import { Abas } from '@/components/ui/abas';
import { AlertaOperacional, AlertaSucesso } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { AreaBiblioteca } from './area-biblioteca';
import { AreaDistribuicao } from './area-distribuicao';
import { AreaEditor } from './area-editor';
import { AreaFormularios } from './area-formularios';
import { AreaRespostas } from './area-respostas';
import { useWorkspaceQuestionarios } from './usar-workspace-questionarios';

type AreaQuestionarios = 'formularios' | 'editor' | 'biblioteca' | 'distribuicao' | 'respostas';

const areasQuestionarios: { id: AreaQuestionarios; rotulo: string }[] = [
  { id: 'formularios', rotulo: 'Formulários' },
  { id: 'editor', rotulo: 'Editor' },
  { id: 'biblioteca', rotulo: 'Biblioteca' },
  { id: 'distribuicao', rotulo: 'Distribuicoes' },
  { id: 'respostas', rotulo: 'Respostas' }
];

export function EditorQuestionario() {
  const workspace = useWorkspaceQuestionarios();
  const {
    erro,
    sucesso,
    alteracoesQuestionarioPendentes,
    alteracoesPerguntaPendentes,
    areaAtiva,
    setAreaAtiva,
    carregar,
    confirmacaoTrocaPendente,
    setConfirmacaoTrocaPendente
  } = workspace;

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carregar nao e useCallback; deve rodar apenas na montagem
  }, []);

  return (
    <section className="grid gap-4">
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}

      {alteracoesQuestionarioPendentes || alteracoesPerguntaPendentes ? (
        <p className="text-sm text-alerta-forte" role="status">
          Alterações pendentes: {alteracoesQuestionarioPendentes ? 'formulario' : ''}
          {alteracoesQuestionarioPendentes && alteracoesPerguntaPendentes ? ' e ' : ''}
          {alteracoesPerguntaPendentes ? 'pergunta selecionada' : ''}. Confirme antes de trocar de formulário.
        </p>
      ) : null}

      <Abas identificador="questionarios" abas={areasQuestionarios} ativaId={areaAtiva} aoMudar={(id) => setAreaAtiva(id as AreaQuestionarios)} rotulo="Áreas de trabalho dos questionários" />

      <div id={`questionarios-${areaAtiva}-painel`} role="tabpanel" aria-labelledby={`questionarios-${areaAtiva}-aba`}>
        {areaAtiva === 'formularios' ? <AreaFormularios workspace={workspace} /> : null}
        {areaAtiva === 'editor' ? <AreaEditor workspace={workspace} /> : null}
        {areaAtiva === 'biblioteca' ? <AreaBiblioteca workspace={workspace} /> : null}
        {areaAtiva === 'distribuicao' ? <AreaDistribuicao workspace={workspace} /> : null}
        {areaAtiva === 'respostas' ? <AreaRespostas workspace={workspace} /> : null}
      </div>

      <ModalConfirmacao
        aberto={Boolean(confirmacaoTrocaPendente)}
        titulo="Alterações não salvas"
        mensagem="Você tem alterações não salvas neste formulário ou pergunta. Trocar mesmo assim?"
        rotuloConfirmar="Trocar mesmo assim"
        aoCancelar={() => setConfirmacaoTrocaPendente(null)}
        aoConfirmar={() => {
          const acao = confirmacaoTrocaPendente;
          setConfirmacaoTrocaPendente(null);
          acao?.();
        }}
      />
    </section>
  );
}
