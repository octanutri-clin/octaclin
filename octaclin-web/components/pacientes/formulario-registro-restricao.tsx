'use client';

import { useId, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { ErroRestricoesProntuario, registrarRestricaoProntuario, type FalhaProntuario } from '@/lib/restricoes-prontuario-api';
import { OPCOES_GRAVIDADE, OPCOES_TIPO_REGISTRO, TEXTOS_RESTRICOES_PRONTUARIO as T } from '@/lib/textos-restricoes-prontuario';

export function mensagemFalhaProntuario(tipo: FalhaProntuario): string {
  switch (tipo) {
    case 'indisponivel': return T.indisponivel;
    case 'sessao': return T.sessao;
    case 'semAcesso': return T.semPermissao;
    case 'mudou': return T.mudou;
    case 'invalida': return T.invalida;
    case 'incerto': return T.incerto;
    default: return T.carregarFalhou;
  }
}
export const falhaDe = (erro: unknown): FalhaProntuario => (erro instanceof ErroRestricoesProntuario ? erro.tipo : 'incerto');
const novaChave = () => crypto.randomUUID();

export interface ValoresRegistro { tipo: string; alimento: string; gravidade: string; observacao: string }
const VAZIO: ValoresRegistro = { tipo: '', alimento: '', gravidade: 'nao_informada', observacao: '' };

/**
 * Registro para conferência. A chave de criação nasce com o formulário e só muda depois de um envio confirmado: repetir
 * depois de um resultado incerto não duplica (o backend é idempotente por chave).
 */
export function FormularioRegistro({ idTipo, pacienteId, colaborador, aoConcluir, inicial = VAZIO, titulo = T.tituloRegistrar, ajuda = T.ajudaRegistrar,
  rotuloBotao = T.botaoRegistrar, prefixoFalha = '', aoMudarEnvio }: {
  idTipo?: string; pacienteId: string; colaborador: boolean; aoConcluir: (texto: string, criada: { id: string; revisao: number }) => void;
  inicial?: ValoresRegistro; titulo?: string; ajuda?: string; rotuloBotao?: string; prefixoFalha?: string; aoMudarEnvio?: (enviando: boolean) => void;
}) {
  const [chave, setChave] = useState(novaChave);
  const [tipo, setTipo] = useState(inicial.tipo);
  const [alimento, setAlimento] = useState(inicial.alimento);
  const [gravidade, setGravidade] = useState(inicial.gravidade);
  const [observacao, setObservacao] = useState(inicial.observacao);
  const [avisoQuebra, setAvisoQuebra] = useState(false);
  const [erros, setErros] = useState<{ tipo?: boolean; alimento?: boolean }>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState('');
  const idTipoProprio = useId();
  const idTitulo = useId();
  const ids = { tipo: idTipo ?? idTipoProprio, alimento: useId(), ajudaAlimento: useId(), gravidade: useId(), observacao: useId(), ajudaObservacao: useId() };
  const campoTipo = useRef<HTMLSelectElement>(null);
  const campoAlimento = useRef<HTMLInputElement>(null);
  const clinico = tipo !== '' && tipo !== 'escolha';

  async function enviar() {
    const novos = { tipo: !tipo, alimento: !alimento.trim() };
    setErros(novos);
    if (novos.tipo) return campoTipo.current?.focus();
    if (novos.alimento) return campoAlimento.current?.focus();
    setEnviando(true);
    aoMudarEnvio?.(true);
    setFalha('');
    const nome = alimento.trim();
    try {
      const criada = await registrarRestricaoProntuario(pacienteId, colaborador, {
        chaveCriacao: chave, tipo, alimento: nome, gravidade: clinico ? gravidade : '', observacao
      });
      setChave(novaChave());
      setTipo(VAZIO.tipo); setAlimento(VAZIO.alimento); setGravidade(VAZIO.gravidade); setObservacao(VAZIO.observacao); setAvisoQuebra(false);
      aoConcluir(T.registrado(nome), { id: criada.id, revisao: criada.revisao });
    } catch (erro) {
      // Incerto: mantém a mesma chave e o texto para repetir sem duplicar.
      setFalha(`${prefixoFalha}${prefixoFalha ? ' ' : ''}${mensagemFalhaProntuario(falhaDe(erro))}`);
    } finally {
      setEnviando(false);
      aoMudarEnvio?.(false);
    }
  }

  return (
    <section aria-labelledby={titulo ? idTitulo : undefined} aria-label={titulo ? undefined : rotuloBotao} className="grid gap-3 rounded-md border border-linha p-3 sm:max-w-xl">
      <div>
        {titulo ? <h3 id={idTitulo} className="text-sm font-semibold text-tinta">{titulo}</h3> : null}
        <p className="text-xs text-texto-suave">{ajuda}</p>
      </div>
      <form className="grid gap-2" noValidate onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <Rotulo htmlFor={ids.tipo}>{T.rotuloTipo}</Rotulo>
        <Selecao ref={campoTipo} id={ids.tipo} value={tipo} aria-invalid={erros.tipo || undefined} onChange={(e) => { setTipo(e.target.value); setErros((x) => ({ ...x, tipo: false })); }}>
          <option value="">Escolha o tipo</option>
          {OPCOES_TIPO_REGISTRO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </Selecao>
        {erros.tipo ? <p className="text-xs text-tinta">{T.erroTipo}</p> : null}
        <Rotulo htmlFor={ids.alimento}>{T.rotuloAlimento}</Rotulo>
        <Campo ref={campoAlimento} id={ids.alimento} value={alimento} maxLength={200} autoComplete="off" aria-describedby={ids.ajudaAlimento}
          aria-invalid={erros.alimento || undefined} onChange={(e) => { setAlimento(e.target.value); setErros((x) => ({ ...x, alimento: false })); }} />
        <p id={ids.ajudaAlimento} className="text-xs text-texto-suave">{erros.alimento ? `${T.erroAlimento} ` : ''}{T.ajudaAlimento}</p>
        {clinico ? (
          <>
            <Rotulo htmlFor={ids.gravidade}>{T.rotuloGravidade}</Rotulo>
            <Selecao id={ids.gravidade} value={gravidade} onChange={(e) => setGravidade(e.target.value)}>
              {OPCOES_GRAVIDADE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </Selecao>
          </>
        ) : null}
        <Rotulo htmlFor={ids.observacao}>{T.rotuloObservacao}</Rotulo>
        <AreaTexto id={ids.observacao} value={observacao} maxLength={1000} rows={3} aria-describedby={ids.ajudaObservacao}
          onChange={(e) => {
            const bruto = e.target.value;
            const limpo = bruto.replace(/[\r\n\t]+/g, ' ');
            if (limpo !== bruto) setAvisoQuebra(true);
            setObservacao(limpo);
          }} />
        <p id={ids.ajudaObservacao} className="text-xs text-texto-suave">{avisoQuebra ? `${T.avisoQuebraLinha} ` : ''}{T.ajudaObservacao}</p>
        {falha ? <p role="alert" className="text-sm text-tinta">{falha}</p> : null}
        <Botao type="submit" variante="primario" disabled={enviando}>{enviando ? 'Registrando' : rotuloBotao}</Botao>
      </form>
    </section>
  );
}
