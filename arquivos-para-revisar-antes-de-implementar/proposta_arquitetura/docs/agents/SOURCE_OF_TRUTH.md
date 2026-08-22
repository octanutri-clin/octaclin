# OctaClin — Source of Truth

> Status: ativo  
> Fonte de verdade para: precedência de documentação e resolução de conflitos

## 1. Objetivo

Evitar que Claude Code, Codex ou desenvolvedores executem corretamente uma instrução antiga que já não representa o estado real do OctaClin.

## 2. Precedência

Quando fontes divergirem, use a seguinte ordem:

1. **Código, migrations e configuração efetivamente em uso**
2. **Evidência do ambiente alvo**, quando a afirmação for sobre runtime/produção
3. `RESUMO_FASES_CONCLUIDAS.md` para capacidades consolidadas
4. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` para fase/próximos trabalhos
5. `DECISOES_ARQUITETURA.md` e ADRs ainda marcados como vigentes
6. `RUNBOOK_PRODUCAO.md` / `VARIAVEIS_AMBIENTE.md` para operação
7. documentos de fase recentes diretamente relacionados
8. documentos de coordenação/onboarding
9. documentos históricos

A posição superior não autoriza mudança silenciosa: conflito material deve ser registrado e corrigido.

## 3. Regra de conflito

Ao encontrar divergência:

1. não escolha silenciosamente;
2. identifique as fontes conflitantes;
3. verifique código/configuração/migration/ambiente;
4. determine qual representa o estado atual;
5. corrija a fonte canônica;
6. marque a fonte antiga como histórica ou substituída;
7. cite a decisão no commit/PR/documento da fase.

## 4. Documentos vivos

Documentos operacionais que mudam com frequência devem começar com:

```md
> Status: ativo
> Última revisão: YYYY-MM-DD
> Fonte de verdade para: <assunto>
> Substitui: <documento anterior, se aplicável>
```

## 5. Documentos históricos

Use:

```md
> Status: histórico
> Não utilizar como fonte de verdade operacional.
> Consulte: <fonte atual>
```

Não apague histórico útil apenas para evitar conflito.

## 6. ADRs

Uma decisão arquitetural substituída deve permanecer versionada, mas receber:

```md
> Status: SUPERSEDED
> Substituído por: ADR-XXX
```

Um ADR superseded não pode ser usado como justificativa para nova implementação.

## 7. Estado mutável não deve ficar no `AGENTS.md`

Evite colocar no guia raiz:

- número atual de migrations;
- último PR;
- SHA de merge;
- fase atual detalhada;
- quantidade de PRs abertos;
- versão operacional temporária;
- incidente momentâneo;
- status de um rollout específico.

Esses dados envelhecem e devem permanecer nas fontes próprias.

## 8. Evidência de ambiente

Quando a afirmação for sobre produção, staging, integração, banco ou serviço externo:

> a documentação descreve a intenção; o ambiente prova o estado.

Exemplo:

- runbook diz que uma variável deve estar `false`;
- painel/ambiente mostra `true`;
- a realidade operacional vence para diagnóstico;
- a divergência deve ser corrigida antes de encerrar a tarefa.

## 9. Verificação automatizada desejada

Evoluir para um script/gate que detecte:

- documento obrigatório inexistente;
- link interno quebrado;
- ADR superseded tratado como ativo;
- fase atual divergente entre documentos vivos;
- documento vivo sem cabeçalho de status/freshness;
- referências a arquivos removidos.

## 10. Regra final

> Documentação é uma interface de controle para humanos e agentes. Se duas interfaces dão comandos diferentes, o projeto está em estado inseguro até a divergência ser resolvida.
