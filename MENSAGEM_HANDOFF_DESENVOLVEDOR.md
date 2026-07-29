# OctaClin - Mensagem de handoff

Use a mensagem abaixo para iniciar outro agente ou desenvolvedor:

```text
Voce vai trabalhar no repositorio privado octanutri-clin/octaclin.

Antes de editar, leia nesta ordem:
1. AGENTS.md
2. docs/handoffs/ESTADO_ATUAL_AGENTES.md
3. CHECKLIST_FASES_FUTURAS_PRODUCAO.md
4. RESUMO_FASES_CONCLUIDAS.md
5. STATUS_ATUAL_PROJETO.md
6. O documento da fase e os runbooks pertinentes.

O handoff canonico informa a branch correta, a cadeia de dependencias, bloqueios e proxima acao. Nao assuma que main contem fases ainda pendentes de integracao.

Trabalhe uma fase por vez. Para concluir uma fase: valide, documente a fase, atualize checklist/resumo/status quando aplicavel, rode git diff --check, faca um commit objetivo e envie a branch. Nunca commite ou exponha secrets.
```
