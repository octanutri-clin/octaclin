---
name: fechar-fase
description: Checklist para fechar uma fase numerada do OctaClin (atualizar docs, validar, commitar e dar push). Use ao concluir qualquer fase de desenvolvimento deste projeto, ou quando o usuario pedir para "fechar a fase", "concluir a fase X" ou "preparar o commit da fase".
---

# Fechar fase do OctaClin

Este projeto trabalha por fases numeradas (ver `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`). Toda fase so esta
concluida quando os passos abaixo forem executados, na ordem. Nao pule etapas mesmo que pareçam redundantes -
cada uma corresponde a uma regra explicita do `AGENTS.md`/`CLAUDE.md` deste repositorio.

## Passo a passo

1. **Confirmar a fase atual e o escopo entregue.**
   Releia o que foi pedido nesta fase e liste o que foi implementado.

2. **Criar ou atualizar `fase-XXX-*.md`** com: objetivo, o que foi entregue, arquivos principais tocados,
   observacoes/pendencias.

3. **Atualizar `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`**:
   - Marcar o item da fase como `[x]`.
   - Registrar commit (preencher apos o commit, ver passo 7), data e principais validacoes.

4. **Atualizar `RESUMO_FASES_CONCLUIDAS.md`** *apenas se a fase consolidar uma capacidade de produto*
   (nova tela, novo fluxo, nova integracao). Fases puramente internas/documentais podem pular este arquivo.

5. **Atualizar `STATUS_ATUAL_PROJETO.md`** se a fase mudar o estado geral do produto (nova fase concluida,
   novo bloco funcional, mudanca de risco principal).

6. **Rodar as validacoes proporcionais ao risco** (ver `TESTES_E_VALIDACOES.md` para o mapeamento completo).
   Comandos comuns:
   ```powershell
   pnpm --dir octaclin-backend typecheck
   pnpm --dir octaclin-web typecheck
   pnpm --dir octaclin-backend test --runInBand <specs-relevantes>
   pnpm --dir octaclin-web test:authz
   pnpm --dir octaclin-web build
   npm run security:secrets
   powershell -ExecutionPolicy Bypass -File ./validar-preflight.ps1 -DocsOnly
   ```
   Se a fase tocou permissoes, multi-tenant, agenda/integracoes externas, backup ou staging, rode tambem
   as validacoes especificas listadas em `TESTES_E_VALIDACOES.md` para essas areas.

7. **Commit e push**:
   ```powershell
   git status --short
   git diff --check
   git add <arquivos-relevantes>
   git commit -m "<mensagem objetiva descrevendo a fase>"
   git push
   ```
   Nunca use `git add -A`/`git add .` sem revisar - o projeto proibe secrets, `.env` reais, dumps de banco
   ou logs com credenciais no commit.

8. **Atualizar o roadmap para a proxima fase** (numero seguinte em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`),
   a menos que o usuario decida explicitamente pular ou mudar a ordem.

9. **Responder ao usuario** com: resumo do que foi feito, commit criado, validacoes executadas e proxima
   fase sugerida.

## Regras que nao podem ser quebradas

- Nao expor secrets, tokens, senhas reais, URLs reais de banco/cache ou chaves de API em nenhum arquivo.
- Nao usar dados reais de pacientes/clientes em fixtures.
- Nunca rodar `pnpm seed:staging` contra producao.
- Nao usar `git reset --hard` nem reverter mudancas que voce nao fez sem pedido explicito do usuario.
- Nao pular fases sem decisao explicita do usuario.
