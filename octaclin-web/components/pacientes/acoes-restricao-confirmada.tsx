'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Rotulo, Selecao } from '@/components/ui/campo';
import { Modal } from '@/components/ui/modal';
import { formularioCorrecao, type RestricaoProntuario } from '@/lib/restricoes-prontuario';
import { confirmarRestricaoProntuario, inativarRestricaoProntuario } from '@/lib/restricoes-prontuario-api';
import { OPCOES_MOTIVO_INATIVACAO, TEXTOS_RESTRICOES_PRONTUARIO as T, formatarDataProntuario, rotuloGravidade } from '@/lib/textos-restricoes-prontuario';
import { FormularioRegistro, falhaDe, mensagemFalhaProntuario } from './formulario-registro-restricao';

/** Uma restrição confirmada que pode receber ações protegidas: ativa ou em reavaliação, nunca inativa nem rejeitada. */
export const aceitaAcaoProtegida = (i: RestricaoProntuario) => i.confirmacao === 'confirmada' && i.estado !== 'inativa' && i.conteudo.natureza !== 'preferencia';
/** R4 (BAIXA): só texto livre é corrigido pelo formulário; item de catálogo perderia o vínculo. */
export const aceitaCorrecao = (i: RestricaoProntuario) => aceitaAcaoProtegida(i) && i.conteudo.alvo.tipo === 'nao_catalogado';
const SEM_CONTROLE = /^[^\p{C}]*$/u;

/**
 * Inativação em dois passos (Q3): 1) motivo e justificativa; 2) frase com tipo e alimento e o botão "Inativar {tipo}".
 * O texto digitado fica só no estado do componente. Se o envio falhar, volta ao passo 1 com o texto preservado.
 */
export function InativacaoEmDoisPassos({ tipo, alimento, erro, enviando, motivoInicial = '', justificativaInicial = '', aoInativar, aoCancelar,
  detalhe = '', avisoPortal = T.avisoPortalInativar, rotuloCancelar = T.manter, invalidaConferencia = false }: {
  tipo: string; alimento: string; erro: string; enviando: boolean; motivoInicial?: string; justificativaInicial?: string;
  detalhe?: string; avisoPortal?: string; rotuloCancelar?: string; invalidaConferencia?: boolean;
  aoInativar: (motivo: string, justificativa: string) => Promise<boolean>; aoCancelar: () => void;
}) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [motivo, setMotivo] = useState(motivoInicial);
  const [justificativa, setJustificativa] = useState(justificativaInicial);
  const [erros, setErros] = useState<{ motivo?: boolean; justificativa?: boolean; caracteres?: boolean }>({});
  const [avisoQuebra, setAvisoQuebra] = useState(false);
  const ids = { motivo: useId(), justificativa: useId(), ajuda: useId() };
  const campoMotivo = useRef<HTMLSelectElement>(null);
  const campoJustificativa = useRef<HTMLTextAreaElement>(null);
  const frase = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (passo === 2) frase.current?.focus();
  }, [passo]);

  function continuar() {
    const novos = { motivo: !motivo, justificativa: !justificativa.trim(), caracteres: !SEM_CONTROLE.test(justificativa) };
    setErros(novos);
    if (novos.motivo) return campoMotivo.current?.focus();
    if (novos.justificativa || novos.caracteres) return campoJustificativa.current?.focus();
    setPasso(2);
  }

  async function inativar() {
    const ok = await aoInativar(motivo, justificativa);
    if (!ok) {
      setPasso(1);
      window.setTimeout(() => campoMotivo.current?.focus(), 0);
    }
  }

  if (passo === 2) {
    return (
      <div className="grid gap-3">
        <p ref={frase} tabIndex={-1} className="text-sm font-medium text-tinta">{T.inativarConfirmacao(tipo, alimento)}</p>
        {detalhe ? <p className="text-sm text-tinta">{detalhe}</p> : null}
        <p className="text-sm text-texto-suave">{T.motivoEscolhido(OPCOES_MOTIVO_INATIVACAO.find((o) => o.valor === motivo)?.rotulo ?? '')}</p>
        <p className="text-sm text-texto-suave">{avisoPortal}</p>
        {invalidaConferencia ? <p className="text-sm text-texto-suave">{T.avisoConferenciaGeral}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao type="button" variante="secundario" disabled={enviando} onClick={() => setPasso(1)}>{T.manter}</Botao>
          <Botao type="button" variante="perigo" disabled={enviando} onClick={() => void inativar()}>{enviando ? 'Processando' : T.botaoInativarTipo(tipo)}</Botao>
        </div>
      </div>
    );
  }
  return (
    <form className="grid gap-2" noValidate onSubmit={(e) => { e.preventDefault(); continuar(); }}>
      <p className="text-sm text-texto-suave">{T.ajudaInativar}</p>
      {erro ? <p role="alert" className="rounded-md border border-linha px-3 py-2 text-sm text-tinta">{erro}</p> : null}
      <Rotulo htmlFor={ids.motivo}>{T.rotuloMotivo}</Rotulo>
      <Selecao ref={campoMotivo} id={ids.motivo} value={motivo} aria-invalid={erros.motivo || undefined}
        onChange={(e) => { setMotivo(e.target.value); setErros((x) => ({ ...x, motivo: false })); }}>
        <option value="">{T.escolhaMotivo}</option>
        {OPCOES_MOTIVO_INATIVACAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </Selecao>
      {erros.motivo ? <p className="text-xs text-tinta">{T.erroMotivo}</p> : null}
      <Rotulo htmlFor={ids.justificativa}>{T.rotuloJustificativaInativar}</Rotulo>
      <AreaTexto ref={campoJustificativa} id={ids.justificativa} value={justificativa} maxLength={1000} rows={4} aria-describedby={ids.ajuda}
        aria-invalid={erros.justificativa || erros.caracteres || undefined}
        onChange={(e) => {
          const bruto = e.target.value;
          const limpo = bruto.replace(/[\r\n\t]+/g, ' ');
          if (limpo !== bruto) setAvisoQuebra(true);
          setJustificativa(limpo);
          if (limpo.trim()) setErros((x) => ({ ...x, justificativa: false, caracteres: false }));
        }} />
      <p id={ids.ajuda} className="text-xs text-texto-suave">
        {erros.justificativa ? `${T.erroJustificativa} ` : ''}{erros.caracteres ? `${T.erroCaracteres} ` : ''}{avisoQuebra ? `${T.avisoQuebraLinha} ` : ''}{T.ajudaJustificativaInativar}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao type="button" variante="secundario" disabled={enviando} onClick={aoCancelar}>{rotuloCancelar}</Botao>
        <Botao type="submit" variante="primario" disabled={enviando}>{T.botaoContinuar}</Botao>
      </div>
    </form>
  );
}

type Passo =
  | { n: 1 }
  | { n: 2; nova: { id: string; revisao: number } }
  | { n: 3; nova: { id: string } };

/**
 * "Corrigir registro" (NUX-01, Q-I): 1) registra a corrigida; 2) confirma a corrigida; 3) inativa a anterior em dois
 * passos. Cada passo é um clique explícito. A anterior só é inativada depois de a nova estar confirmada; se algo falha,
 * a tela diz em que passo parou e o que continua valendo. Depois de cada passo a lista é recarregada.
 */
export function DialogoCorrecao({ pacienteId, antiga, tipoAntiga, descricaoAntiga, recarregar, aoFechar, invalidaConferencia = false }: {
  pacienteId: string; antiga: RestricaoProntuario; tipoAntiga: string; descricaoAntiga: string; invalidaConferencia?: boolean;
  recarregar: () => Promise<RestricaoProntuario[] | null>; aoFechar: (aviso: string) => void;
}) {
  const [passo, setPasso] = useState<Passo>({ n: 1 });
  const [alvoAntigo, setAlvoAntigo] = useState(antiga);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const tituloPasso = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    tituloPasso.current?.focus();
  }, [passo.n]);

  const parouEm = () => (passo.n === 1 ? T.correcaoParouRegistro : passo.n === 2 ? T.correcaoParouConfirmacao : T.correcaoParouInativacao);
  const fechar = () => { if (!enviando && !registrando) aoFechar(parouEm()); };

  async function confirmarNova() {
    if (passo.n !== 2) return;
    setEnviando(true);
    setErro('');
    try {
      await confirmarRestricaoProntuario(pacienteId, passo.nova.id, passo.nova.revisao);
      await recarregar();
      setPasso({ n: 3, nova: { id: passo.nova.id } });
    } catch (falha) {
      // Incerto ou 409: a versão atual decide. Já confirmada → segue; ainda pendente → repetir com a revisão atual.
      const texto = mensagemFalhaProntuario(falhaDe(falha));
      const itens = await recarregar();
      const atual = itens?.find((x) => x.id === passo.nova.id);
      if (atual?.confirmacao === 'confirmada' && atual.estado !== 'inativa') setPasso({ n: 3, nova: { id: atual.id } });
      else if (atual?.confirmacao === 'pendente' && atual.estado === 'ativa') { setPasso({ n: 2, nova: { id: atual.id, revisao: atual.revisao } }); setErro(`${T.correcaoParouConfirmacao} ${texto}`); }
      else aoFechar(`${T.correcaoParouConfirmacao} ${texto}`);
    } finally {
      setEnviando(false);
    }
  }

  /** R4 (MÉDIA): a corrigida pode ter mudado em outra aba; só segue (e só declara concluída) com ela confirmada e ativa. */
  const novaValendo = (itens: RestricaoProntuario[] | null) => {
    if (passo.n !== 3) return false;
    const nova = itens?.find((x) => x.id === passo.nova.id);
    return !!nova && aceitaAcaoProtegida(nova);
  };

  async function inativarAntiga(motivo: string, justificativa: string): Promise<boolean> {
    setEnviando(true);
    setErro('');
    const antes = await recarregar();
    if (!novaValendo(antes)) {
      setEnviando(false);
      aoFechar(T.correcaoNovaIndisponivel);
      return true;
    }
    const fim = (itens: RestricaoProntuario[] | null) => aoFechar(novaValendo(itens) ? T.correcaoConcluida(descricaoAntiga) : T.correcaoSemNova);
    const atualAntes = antes?.find((x) => x.id === alvoAntigo.id) ?? alvoAntigo;
    try {
      await inativarRestricaoProntuario(pacienteId, alvoAntigo.id, atualAntes.revisao, motivo, justificativa);
      fim(await recarregar());
      return true;
    } catch (falha) {
      const texto = mensagemFalhaProntuario(falhaDe(falha));
      const itens = await recarregar();
      const atual = itens?.find((x) => x.id === alvoAntigo.id);
      if (atual?.estado === 'inativa') { fim(itens); return true; }
      if (atual && aceitaAcaoProtegida(atual)) { setAlvoAntigo(atual); setErro(`${T.correcaoParouInativacao} ${texto}`); return false; }
      aoFechar(`${T.correcaoParouInativacao} ${texto}`);
      return true;
    } finally {
      setEnviando(false);
    }
  }

  const nomes = [T.passoRegistrarNova, T.passoConfirmarNova, T.passoInativarAntiga];
  return (
    <Modal aberto aoFechar={fechar} titulo={T.corrigirTitulo(descricaoAntiga)}>
      <div className="grid gap-3">
        <p className="text-sm text-texto-suave">{T.ajudaCorrigir}</p>
        <ol aria-label="Passos da correção" className="grid gap-1 text-sm">
          {nomes.map((nome, i) => (
            <li key={nome} aria-current={passo.n === i + 1 ? 'step' : undefined} className={passo.n === i + 1 ? 'font-semibold text-tinta' : 'text-texto-suave'}>
              {T.passoCorrecao(i + 1)}: {nome}{passo.n > i + 1 ? ' (feito)' : ''}
            </li>
          ))}
        </ol>
        <h3 ref={tituloPasso} tabIndex={-1} className="text-sm font-semibold text-tinta">{T.passoCorrecao(passo.n)}: {nomes[passo.n - 1]}</h3>
        {passo.n === 1 ? (
          <FormularioRegistro pacienteId={pacienteId} colaborador={false} inicial={formularioCorrecao(antiga)} titulo=""
            ajuda={T.ajudaRegistrar} rotuloBotao={T.botaoRegistrarNova} prefixoFalha={T.correcaoParouRegistro}
            aoMudarEnvio={setRegistrando} aoConcluir={(_, criada) => { void recarregar(); setPasso({ n: 2, nova: criada }); }} />
        ) : null}
        {passo.n === 1 ? (
          <div className="flex justify-end">
            <Botao type="button" variante="secundario" disabled={registrando} onClick={fechar}>{T.fecharCorrecao}</Botao>
          </div>
        ) : null}
        {passo.n === 2 ? (
          <div className="grid gap-2">
            <p role="status" className="text-sm text-tinta">{T.novaRegistrada}</p>
            {erro ? <p role="alert" className="rounded-md border border-linha px-3 py-2 text-sm text-tinta">{erro}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Botao type="button" variante="secundario" disabled={enviando} onClick={fechar}>{T.fecharCorrecao}</Botao>
              <Botao type="button" variante="primario" disabled={enviando} onClick={() => void confirmarNova()}>{enviando ? 'Processando' : T.botaoConfirmarNova}</Botao>
            </div>
          </div>
        ) : null}
        {passo.n === 3 ? (
          <div className="grid gap-2">
            <p role="status" className="text-sm text-tinta">{T.novaConfirmada}</p>
            <InativacaoEmDoisPassos tipo={tipoAntiga} alimento={antiga.conteudo.alvoDeclarado ?? T.semNomeCatalogo} erro={erro} enviando={enviando}
              motivoInicial="registro_incorreto" justificativaInicial={T.justificativaCorrecao(descricaoAntiga)}
              aoInativar={inativarAntiga} aoCancelar={fechar} rotuloCancelar={T.fecharCorrecao} avisoPortal={T.avisoPortalCorrecao} invalidaConferencia={invalidaConferencia}
              detalhe={T.detalheAnterior(antiga.conteudo.natureza === 'clinica' ? rotuloGravidade(antiga.conteudo.gravidade) : null, formatarDataProntuario(antiga.criadoEm))} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
