# Validação da infraestrutura de UX/produto

Escopo: papéis versionados, instruções compartilhadas, procedimento A/B/C/D, templates, piloto e gates locais. Nenhuma implementação de FOOD07; nenhuma configuração global, provider ou dado clínico alterado.

| Verificação | Resultado | Evidência / limite |
| --- | --- | --- |
| TDD de existência/configuração | RED observado, depois GREEN | Teste real do repositório falhou com dois papéis ausentes; após criação,5/5PASS |
| Casos negativos de autoridade | PASS | Ativação de ferramenta/valor ambíguo, modelo/provider/MCP/sandbox/approval extras, TOML ausente/malformado, nomes trocados, instrução vazia, symlinks |
| Gate Node pré-existente | PASS | `node --test scripts/validar-tooling-agentes.spec.mjs`:12/12, preservado no scriptpackage |
| Parser e gate Python | PASS | `python3 scripts/validar-papeis-ux.py`, unittest5/5, stdlibPython3.12.14 local |
| Duas avaliações | Concluídas por instâncias diferentes | task names no manifesto; sem ferramenta, contexto completo ou parecer cruzado; opiniões fictícias e estáticas |
| Seleção nativa de TOML | BLOCKED / não comprovada | SmokeCLI bloqueado por autenticação; config/read e debug de prompt não comprovam descoberta dos tipos; ver capacidades.md |
| Revisão técnica independente da infraestrutura | Favorável, estática | `/root/ux_infra_review`, sem achado material; executou somente unittestPython5/5, não CLI/Node/CI/provedores. Não revalidou bytes dos prompts/trilha dos revisores |
| Hashes/links | PASS local | Manifesto identifica7artefatos, verificados; links locais existentes. Hash não prova validade clínica/autoria humana |
| Scanner de segredos / diff | PASS local | `node scripts/scan-secrets.mjs`, `git diff --check`; nenhuma chave ou dado real incluído |
| Node compatível | CI pendente | LocalNode24.19.0 fora de engines; CI deve usarNode22, sem alterar engines |
| Backend/Web/PostgreSQL/Playwright de produto | N/A para este patch | Não há runtime/schema/UI de produto alterados; não declarar testesFOOD07executados |
| Etapas B/C de UXFOOD07 | NOT RUN | Precisam interface implementada e evidência real; relatórioA não as substitui |
| Merge/deploy/migrations/ativação | Não executados | PR Draft, autorização somente para infraestrutura/processo e piloto |

A revisão técnica é adicional às duas personas. O autor mantém responsabilidade por implementação; personas não concedem autorizações clínicas/operacionais nem encerram gatesR4. As decisões de produto sugeridas no piloto ainda aguardam o proprietário.
