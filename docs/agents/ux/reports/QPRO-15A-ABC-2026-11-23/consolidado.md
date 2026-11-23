# QPRO-15-A — avaliações A/D e B/C

Síntese editorial do coordenador. Persona fictícia profissional por papel
explícito no runtime `/root/qst_auditoria_nutri`, sem ferramentas. Seleção
nativa do TOML não comprovada. Não é pesquisa com usuários nem revisão R4.

## A/D — planejamento e aprendizado

Parecer favorável ao recorte editorial. Reduz ruído de leitura sem mudar conteúdo
gravado. Cuidado: “Média por envio” deve manter a agregação existente; “Sem
comparação” descreve disponibilidade técnica, não resultado clínico. Conferência
no backend e bindings de interface confirmou que o delta preserva o cálculo.

## Evidência real e B/C

Coordenador abriu Next local com Chromium e mocks BFF sintéticos reaproveitados
dos testes existentes. Capturas [desktop](desktop.png) e [mobile](mobile.png)
foram inspecionadas: escala/rótulos acentuados, aba Distribuições e campos
editáveis preservados; “Sem secao” legado continua visível por decisão de escopo.
A barra de abas móvel mantém rolagem horizontal; não equivale a todos os nomes
visíveis simultaneamente. Captura não prova leitor de tela nem autorização real.
Persona recebe descrição das evidências; não operou navegador nem viu as imagens.

Parecer B/C favorável ao delta descrito; nenhuma dificuldade concreta nova.
“Média por envio” corresponde ao cálculo informado. No momento do parecer,
regressões ainda em curso; não convertidas em PASS pela persona.
B visual pela persona: **NOT RUN** (não viu capturas nem operou navegador).
Coordenador realizou a inspeção visual descrita acima. Não há validação clínica.

## Consolidação

| ID | Origem | Problema/evidência | Prioridade | Solução/complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Q15A-01 | Profissional | Grafia estática inadequada comprovada no código e UI | P2 | Corrigir apenas apresentação; baixa | Sem mudança de contrato | JÁ COBERTO neste delta |
| Q15A-02 | Profissional | Risco plausível de mudar sentido da média | P2 | Conferir binding/cálculo; baixa | Cálculo preservado | JÁ COBERTO |
| Q15A-03 | Coordenador | Defaults/dados dinâmicos sem acento permanecem | P3 | Próximo planejamento de compatibilidade | Busca literal exige cuidado | BACKLOG |

Paciente: **N/A justificado**, sem impacto de portal, acesso ou conteúdo clínico.
Sem novos requisitos assumidos. QPRO-15 permanece parcial. Evidências automatizadas
finais e limitações no [handoff](../../../../../tasks/qst-qpro15-rotulos-portugues.md).
