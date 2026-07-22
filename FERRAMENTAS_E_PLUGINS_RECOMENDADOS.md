# OctaClin - Ferramentas e plugins recomendados

Este arquivo lista ferramentas uteis para desenvolvimento pleno do OctaClin. Nem todas sao obrigatorias no primeiro dia.

## Essenciais

- GitHub: repositorio privado, commits, PRs e historico.
- Git: sincronizacao local e historico.
- Node.js LTS: runtime do backend/web.
- pnpm: gerenciador de pacotes usado no projeto.
- PowerShell: comandos padrao no ambiente Windows atual.
- VS Code, Cursor ou IDE equivalente: edicao e debug.
- Playwright: validacao visual e fluxos E2E.
- DBeaver, pgAdmin ou DataGrip: inspecao PostgreSQL.
- Bruno, Insomnia ou Postman: testes manuais de API.

## Plugins/conectores recomendados para IA

- GitHub: essencial para leitura, commits, PRs e revisao.
- Browser ou Chrome control: validar UI real, login e fluxos.
- Context7: consultar documentacao atual de Next.js, NestJS, TypeORM, Playwright e outras libs.
- OpenAI Platform: quando a fase tocar IA clinica, prompts ou API OpenAI.
- Google Calendar: quando a fase tocar agenda e sincronizacao.
- Gmail: quando a fase tocar email real.
- Figma: quando entrarmos em redesign ou UI/UX mais profundo.
- Google Drive/Docs: util se politicas, termos e documentacao comercial forem mantidos fora do repo.

## Plugins opcionais por operacao

- Atlassian/Jira ou Linear: se o time quiser gestao formal de tarefas.
- Slack/Teams: se o time quiser notificacoes e coordenacao operacional.
- Notion: se a documentacao de produto sair do GitHub.

## Provedores externos usados no OctaClin

- Render: hospedagem web/backend.
- Neon: PostgreSQL.
- Upstash: Redis/fila/cache.
- Gmail/Google Cloud: email e OAuth.
- Google Calendar: agenda.
- Meta Developers: WhatsApp Cloud API.

## Acessos por tipo de fase

| Tipo de trabalho | Acesso necessario |
| --- | --- |
| UI/UX frontend | GitHub e Browser/Chrome |
| Backend/domain | GitHub e, se usar dados reais, Neon staging |
| Banco/migrations | GitHub, Neon staging e backup/exportacao antes de mudancas sensiveis |
| Email | GitHub, Render env e Google/Gmail |
| Agenda | GitHub, Render env e Google Calendar/Cloud |
| WhatsApp | GitHub, Render env e Meta Developers |
| Deploy/operacao | GitHub, Render, Neon e Upstash |
| IA clinica | GitHub, OpenAI Platform e Render env |

## Recomendacao de seguranca

- Usar senhas fortes e 2FA em GitHub, Render, Neon, Google e Meta.
- Compartilhar secrets por gerenciador seguro, como Bitwarden, 1Password ou GitHub/Render Secrets.
- Nunca compartilhar tokens em chat comum.
- Rotacionar qualquer token que tenha sido colado em conversa, log ou arquivo versionado.
- Manter producao e staging com variaveis separadas.
