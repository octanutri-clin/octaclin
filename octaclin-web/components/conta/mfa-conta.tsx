'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  confirmarConfiguracaoMfa,
  iniciarConfiguracaoMfa,
  obterStatusMfa,
  regenerarCodigosMfa,
  removerMfa,
  type ConfiguracaoMfaPublica
} from '@/lib/auth-api';
import { ModalReautenticacao } from '@/components/auth/modal-reautenticacao';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoSubtitulo, CartaoTitulo } from '@/components/ui/cartao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso, EsqueletoPagina } from '@/components/ui/feedback';

type Acao = 'configurar' | 'codigos' | 'remover';

export function MfaConta() {
  const router = useRouter();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof obterStatusMfa>>>();
  const [acao, setAcao] = useState<Acao>();
  const [configuracao, setConfiguracao] = useState<ConfiguracaoMfaPublica>();
  const [codigo, setCodigo] = useState('');
  const [codigos, setCodigos] = useState<string[]>([]);
  const [erro, setErro] = useState<string>();
  const [sucesso, setSucesso] = useState<string>();
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    obterStatusMfa().then(setStatus).catch((falha) => setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar o MFA.'));
  }, []);

  async function executarAposReautenticacao() {
    const atual = acao;
    setAcao(undefined);
    setErro(undefined);
    if (atual === 'configurar') {
      setConfiguracao(await iniciarConfiguracaoMfa());
      return;
    }
    if (atual === 'codigos') {
      const resultado = await regenerarCodigosMfa();
      setCodigos(resultado.codigosRecuperacao);
      setSucesso('Novos códigos gerados. Os anteriores não funcionam mais.');
      return;
    }
    if (atual === 'remover') {
      await removerMfa();
      router.replace('/login');
      router.refresh();
    }
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setProcessando(true);
    setErro(undefined);
    try {
      const resultado = await confirmarConfiguracaoMfa(codigo);
      setCodigos(resultado.codigosRecuperacao);
      setConfiguracao(undefined);
      setSucesso('Autenticação multifator configurada. Entre novamente após guardar os códigos.');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível confirmar o código.');
    } finally {
      setProcessando(false);
    }
  }

  if (!status && !erro) return <EsqueletoPagina rotulo="Carregando autenticação multifator" />;

  return (
    <>
      <Cartao>
        <CartaoCabecalho>
          <div className="min-w-0">
            <CartaoTitulo icone={<ShieldCheck size={16} />}>Autenticação multifator</CartaoTitulo>
            <CartaoSubtitulo>
              {status?.habilitado ? 'Sua conta exige senha e um código temporário para entrar.' : 'Adicione uma segunda etapa de verificação à sua conta.'}
            </CartaoSubtitulo>
          </div>
          {status ? (
            <span className="text-sm font-medium text-tinta">{status.habilitado ? 'Ativa' : status.obrigatorio ? 'Obrigatória' : 'Opcional'}</span>
          ) : null}
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-4">
          {erro ? <AlertaOperacional mensagem={erro} /> : null}
          {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
          {status ? <p className="text-sm text-texto-suave">Códigos de recuperação disponíveis: {status.codigosRecuperacaoDisponiveis}</p> : null}

          {configuracao ? (
            <form className="grid gap-3 rounded-md border border-linha p-3" onSubmit={confirmar}>
              <p className="text-sm text-tinta">Adicione esta chave ao aplicativo autenticador:</p>
              <code className="break-all rounded bg-superficie p-2 text-sm font-semibold">{configuracao.segredo}</code>
              <Botao type="button" tamanho="sm" variante="secundario" onClick={() => void navigator.clipboard.writeText(configuracao.segredo)}>
                <Copy size={14} aria-hidden="true" /> Copiar chave
              </Botao>
              <div className="grid gap-1.5">
                <Rotulo htmlFor="codigo-configuracao-mfa">Código gerado</Rotulo>
                <Campo id="codigo-configuracao-mfa" value={codigo} onChange={(evento) => setCodigo(evento.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
              </div>
              <Botao type="submit" variante="primario" carregando={processando}>Confirmar configuração</Botao>
            </form>
          ) : null}

          {codigos.length ? (
            <div className="grid gap-2 rounded-md border border-aviso-borda bg-aviso-suave p-3">
              <p className="text-sm font-medium text-tinta">Guarde estes códigos agora. Eles não serão exibidos novamente.</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Novos códigos de recuperação">
                {codigos.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <Botao type="button" tamanho="sm" variante="secundario" onClick={() => void navigator.clipboard.writeText(codigos.join('\n'))}>
                <Copy size={14} aria-hidden="true" /> Copiar códigos
              </Botao>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Botao type="button" variante="secundario" onClick={() => setAcao('configurar')}>
              <KeyRound size={16} aria-hidden="true" /> {status?.habilitado ? 'Trocar aplicativo' : 'Configurar MFA'}
            </Botao>
            {status?.habilitado ? (
              <>
                <Botao type="button" variante="secundario" onClick={() => setAcao('codigos')}>Gerar novos códigos</Botao>
                <Botao type="button" variante="perigo" onClick={() => setAcao('remover')}>
                  <ShieldOff size={16} aria-hidden="true" /> Remover MFA
                </Botao>
              </>
            ) : null}
          </div>
        </CartaoConteudo>
      </Cartao>

      <ModalReautenticacao
        aberto={Boolean(acao)}
        titulo="Confirme sua identidade"
        descricao="Esta alteração afeta a segurança da sua conta. Confirme sua senha para continuar."
        rotuloConfirmar="Confirmar"
        aoCancelar={() => setAcao(undefined)}
        aoConfirmar={executarAposReautenticacao}
      />
    </>
  );
}
