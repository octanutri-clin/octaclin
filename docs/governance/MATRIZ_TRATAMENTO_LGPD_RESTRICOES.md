# Matriz de operações de tratamento — restrições alimentares (FOOD06 T8, Q4): ESQUELETO

**Status:** esqueleto técnico para a avaliação formal de privacidade e jurídica. **Não é parecer jurídico** e **não escolhe base legal, controlador, operador nem prazo de retenção**: essas colunas estão
**PENDENTES** e dependem de quem tem competência para decidi-las. O que está preenchido é o que a engenharia consegue afirmar sobre o desenho (categoria de dados, quem acessa, medidas), e vale só enquanto o contrato v2 e o v3 não mudarem.

- Base de dados sensíveis: restrições alimentares são **dado de saúde**; uma restrição que revele **convicção religiosa ou filosófica** recebe proteção de dado sensível. A hipótese de tutela da saúde (LGPD, art. 11) deve ser avaliada **por operação**, e **não** vale automaticamente para finalidade comercial, analítica ou administrativa do SaaS.
- **Minimização (decisão do proprietário):** o campo de motivação religiosa **sai da v1**; o motor usa só a restrição necessária.
- **Retenção:** sem prazo arbitrário; considerar a finalidade, as obrigações legais aplicáveis e a política do prontuário. **Não definido.**
- **Dados reais:** nenhum teste, relatório ou exemplo usa dado real.

Legenda: **PEND-J** = pendente de avaliação jurídica e de privacidade.

| # | Operação | Finalidade (proposta técnica) | Categoria de dados | Controlador / operador | Base legal | Quem acessa | Retenção e descarte | Compartilhamento | Medidas de segurança (desenho) | Direitos do titular |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Registro da restrição pelo profissional | Acompanhamento nutricional individual | Saúde; pode revelar convicção (escolha) | PEND-J | PEND-J | `Professional` com permissão clínica; `Collaborator` só o que criou | PEND-J | Nenhum | Cifragem de aplicação; RLS por tenant com `FORCE`; carteira autorizada antes de ler; auditoria sem conteúdo clínico | PEND-J (acesso, correção, eliminação, portabilidade) |
| 2 | Declaração e pedido de correção pelo paciente | Atualização pelo titular | Saúde | PEND-J | PEND-J | Paciente (o próprio) e profissional responsável | PEND-J | Nenhum | Pedido nunca sobrescreve; explicação ao paciente separada da justificativa interna | PEND-J; representantes legais (ATV-6) |
| 3 | Confirmação, reconfirmação e inativação | Validar o registro para o acompanhamento | Saúde | PEND-J | PEND-J | `Professional` com permissão clínica | PEND-J | Nenhum | Confirmação em dois passos; histórico append-only; auditoria imutável | PEND-J |
| 4 | Avaliação pelo motor (M11, M04, M12) | Apoiar a decisão do nutricionista com fatos | Saúde (derivado) | PEND-J | PEND-J | Profissional responsável | Resultado não é gravado; a **decisão de aplicar** guarda a evidência usada (PEND-J: prazo) | Nenhum | Servidor reautoriza; impressão das entradas; canários de vazamento | PEND-J |
| 5 | Exibição ao paciente no portal | Transparência ao titular | Saúde | PEND-J | PEND-J | Paciente (o próprio) | n/a | Nenhum | DTO por allowlist; sem códigos técnicos, motivação religiosa nem justificativa interna | PEND-J |
| 6 | Leitura de respostas antigas do questionário | Sugerir revisão ao profissional | Saúde | PEND-J | PEND-J | Profissional responsável | Segue o questionário (PEND-J) | Nenhum | Somente leitura; **não** copiar para campo sem cifragem; ver auditoria Q5 | PEND-J |
| 7 | Curadoria **local** (composição declarada de produto ou receita) | Corrigir o dado que originou um bloqueio | Dado de produto; vínculo com o atendimento | PEND-J | PEND-J | Profissional responsável | PEND-J | **Nunca** alimenta o catálogo global sem revisão | Origem `local_profissional`; evidência obrigatória; nunca vira `permitido` silencioso | n/a |
| 8 | Curadoria **global** do catálogo | Governança da taxonomia e do mapeamento | **Sem dado de paciente** | PEND-J | PEND-J | Mantenedora e revisor técnico | Versões e histórico | Nenhum | Versionamento; nenhum dado de paciente entra no catálogo global | n/a |
| 9 | Auditoria | Rastreabilidade | Metadados (autor, data, ação) | PEND-J | PEND-J | Profissional e operação autorizada | PEND-J | Nenhum | Sem conteúdo clínico; redação conforme `redacao-auditoria.ts` | PEND-J |
| 10 | Relatório e PDF | Entrega ao paciente, se o profissional escolher | Saúde | PEND-J | PEND-J | Quem recebe o relatório | Sem arquivo persistido | Opt-in do profissional | Restrições **não** entram no PDF sem a opção explícita | PEND-J |
| 11 | Backups, filas, caches e exportações | Continuidade operacional | Saúde (cifrada) | PEND-J | PEND-J | Operação autorizada | PEND-J | Provedores de infraestrutura (PEND-J) | Cifragem; nenhum dado em Cache Storage; sem PHI em log, erro ou telemetria | PEND-J |

## O que a avaliação precisa responder

1. Quem é **controlador** e quem é **operador** em cada operação (o nutricionista, a clínica, o OctaClin)?
2. Qual **base legal** vale para cada linha, separando a tutela da saúde de finalidades comerciais, analíticas ou administrativas?
3. **Retenção e descarte:** alinhar ao ciclo de vida de `pacientes` (campos de retenção existem em `paciente.orm.ts`), à política do prontuário e às obrigações aplicáveis, sem prazo arbitrário.
4. **Direitos do titular** e **representação legal** (menores): como o portal os cumpre.
5. A cifragem de aplicação dos **novos** campos é suficiente? (Auditoria do Q5.)

**Condição objetiva de aprovação:** matriz preenchida e **assinada por quem tem competência**, anexada ao registro da fase; sem isso, a funcionalidade clínica de restrições **não é ativada** (ATV-2 do contrato v3).
