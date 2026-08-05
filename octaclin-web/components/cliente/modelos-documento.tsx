'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import {
  AtualizarModelosDocumentoEntrada,
  ModeloDocumentoClienteApi,
  atualizarModelosDocumentoCliente,
  obterModelosDocumentoCliente
} from '@/lib/cliente-api';

const ROTULO_TIPO: Record<string, string> = {
  declaracao_comparecimento: 'Declaracao de comparecimento',
  relatorio_alta: 'Relatorio de alta'
};

export function ModelosDocumentoCliente() {
  const [modelos, setModelos] = useState<ModeloDocumentoClienteApi[]>([]);
  const [rascunho, setRascunho] = useState<AtualizarModelosDocumentoEntrada>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const iniciarRequisicao = useRequisicaoCancelavel();

  const carregar = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicao();
    setCarregando(true);
    try {
      const dados = await obterModelosDocumentoCliente({ signal });
      if (!ehAtual()) return;
      setModelos(dados.modelos);
      setRascunho(
        Object.fromEntries(dados.modelos.map((modelo) => [modelo.tipo, { titulo: modelo.titulo, corpo: modelo.corpo }]))
      );
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar modelos.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }, [iniciarRequisicao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvando(true);
    try {
      const dados = await atualizarModelosDocumentoCliente(rascunho);
      setModelos(dados.modelos);
      setSucesso('Modelos salvos. Documentos ja emitidos nao mudam.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar modelos.');
    } finally {
      setSalvando(false);
    }
  }

  function restaurarPadrao(tipo: string) {
    setRascunho((atual) => ({ ...atual, [tipo]: { titulo: '', corpo: '' } }));
  }

  return (
    <Cartao aria-busy={carregando}>
      <CartaoCabecalho className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CartaoTitulo>Modelos de documento</CartaoTitulo>
          <p className="mt-1 text-sm text-texto-suave">
            O texto sai como esta escrito aqui, com as variaveis substituidas na emissao. Campo em branco volta ao
            modelo padrao do OctaClin.
          </p>
        </div>
        <BarraCarregamento visivel={carregando} rotulo="Carregando modelos" />
      </CartaoCabecalho>
      <CartaoConteudo>
        {erro ? (
          <p role="alert" className="mb-3 rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo-forte">
            {erro}
          </p>
        ) : null}
        {sucesso ? (
          <p role="status" className="mb-3 rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">
            {sucesso}
          </p>
        ) : null}

        <form className="grid gap-6" onSubmit={salvar}>
          {modelos.map((modelo) => (
            <fieldset key={modelo.tipo} className="grid gap-3 rounded-md border border-linha p-4">
              <legend className="px-1 text-sm font-semibold text-tinta">
                {ROTULO_TIPO[modelo.tipo] ?? modelo.tipo}
                {modelo.personalizado ? ' (personalizado)' : ' (padrao)'}
              </legend>

              <label className="grid gap-1">
                <Rotulo>Titulo</Rotulo>
                <Campo
                  value={rascunho[modelo.tipo]?.titulo ?? ''}
                  onChange={(evento) =>
                    setRascunho((atual) => ({
                      ...atual,
                      [modelo.tipo]: { ...atual[modelo.tipo], titulo: evento.target.value }
                    }))
                  }
                />
              </label>

              <label className="grid gap-1">
                <Rotulo>Corpo</Rotulo>
                <AreaTexto
                  rows={10}
                  className="font-mono text-xs"
                  aria-describedby={`variaveis-${modelo.tipo}`}
                  value={rascunho[modelo.tipo]?.corpo ?? ''}
                  onChange={(evento) =>
                    setRascunho((atual) => ({
                      ...atual,
                      [modelo.tipo]: { ...atual[modelo.tipo], corpo: evento.target.value }
                    }))
                  }
                />
              </label>

              <p id={`variaveis-${modelo.tipo}`} className="text-xs text-texto-suave">
                Variaveis aceitas: {modelo.variaveis.map((variavel) => `{{${variavel}}}`).join(', ')}. Variavel
                fora desta lista faz o salvamento falhar.
              </p>

              <div>
                <Botao type="button" tamanho="sm" onClick={() => restaurarPadrao(modelo.tipo)}>
                  Voltar ao padrao
                </Botao>
              </div>
            </fieldset>
          ))}

          <div>
            <Botao type="submit" variante="primario" carregando={salvando} disabled={salvando || carregando}>
              Salvar modelos
            </Botao>
          </div>
        </form>
      </CartaoConteudo>
    </Cartao>
  );
}
