# OctaClin - Coordenacao de desenvolvimento com IA

Este documento define como Codex, Claude Code, Cursor, desenvolvedores humanos e outros agentes devem cooperar sem perder contexto ou criar conflitos.

## Regra principal

Trabalhar uma fase por vez, mesmo quando o mesmo desenvolvedor for avancar varias fases em sequencia. Se um desenvolvedor estiver implementando uma fase, os demais devem aguardar, revisar ou preparar contexto, mas nao commitar alteracoes concorrentes na mesma area.

## Estado atual

- Ultima fase concluida: Fase 105.
- Proxima fase planejada: Fase 106 - Planos de acompanhamento e tarefas do paciente.
- Pacote multifase: `PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md`.
- Fonte de verdade: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

## Antes de iniciar trabalho

1. Sincronizar com `main`.
2. Verificar `git status --short`.
3. Ler `AGENTS.md`.
4. Ler a fase atual no checklist.
5. Confirmar se existe algum trabalho em andamento por outro agente.

## Durante o trabalho

- Manter escopo fechado na fase.
- Fazer commits pequenos e objetivos.
- Evitar refatoracoes fora do caminho critico.
- Se uma decisao de produto surgir, registrar no arquivo da fase ou em `DECISOES_ARQUITETURA.md`.
- Se criar rota, permissao ou papel, atualizar `MAPA_ROTAS_PERMISSOES.md`.
- Se tocar env/secrets, atualizar `VARIAVEIS_AMBIENTE.md`, nunca valores reais.

## Ao finalizar uma fase

1. Rodar validacoes proporcionais ao risco.
2. Atualizar documentos obrigatorios.
3. Rodar `git diff --check`.
4. Rodar varredura simples de secrets conforme o comando documentado em `TESTES_E_VALIDACOES.md`.

5. Commitar.
6. Fazer push.
7. Informar commit, validacoes e proxima fase.

## Se for continuar para outra fase

Antes de iniciar a fase seguinte:

1. Confirmar que o push anterior foi concluido.
2. Confirmar `git status --short` limpo.
3. Reabrir `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
4. Conferir se a fase seguinte depende de acesso externo.
5. Registrar no chat/time: `Iniciando Fase XXX - nome`.

## Quando pausar para economizar tokens

Se o limite semanal de tokens estiver alto ou proximo do fim:

- Parar apos concluir uma fase.
- Garantir que tudo esteja commitado e enviado.
- Atualizar `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Registrar pendencias no arquivo `fase-XXX-*.md`.
- Nao deixar servidor, teste ou processo em background sem avisar.

## Handoff rapido para outro agente

Mensagem recomendada:

```text
Voce esta no projeto OctaClin. Leia AGENTS.md, STATUS_ATUAL_PROJETO.md,
CHECKLIST_FASES_FUTURAS_PRODUCAO.md, RESUMO_FASES_CONCLUIDAS.md,
HANDOFF-TECNICO-OCTACLIN.md e os arquivos fase-*.md recentes.

Ultima fase concluida: Fase 105.
Proxima fase: Fase 106 - Planos de acompanhamento e tarefas do paciente.
Pode avancar por varias fases, mas feche uma fase por commit antes de seguir.
Trabalhe por TDD, atualize a documentacao viva ao final, rode validacoes,
commite e faca push.
```
