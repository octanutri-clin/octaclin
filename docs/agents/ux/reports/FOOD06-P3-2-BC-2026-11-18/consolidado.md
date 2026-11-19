# Consolidação — FOOD06 P3-2, etapas B e C

Duas instâncias do runtime com o papel como prompt, 0 ferramentas cada, só o `brief.md`; não independentes do coordenador; sem
leitor de tela real nem pessoas. Sem P0. APROVAR é recomendação.

| ID | Prio. | Estado | Tratamento | Prova |
| --- | --- | --- | --- | --- |
| PUX-18 | P1 | CORRIGIDO | Link "Escrever para quem faz seu acompanhamento" nos dois avisos de limite | Playwright (3 links no estado de limite) |
| PUX-17 | P2 | CORRIGIDO | Ajudas dos tipos neutras ("O alimento é evitado por decisão própria."; "Quem faz o acompanhamento vai entender e classificar.") | Unitário de termos e Playwright |
| PUX-20 | P2 | CORRIGIDO | "Você pode tentar de novo: não vamos registrar duas vezes." (a tela reenvia com a mesma chave) | Playwright (mesma chave nas duas tentativas) |
| PUX-21 | P2 | CORRIGIDO | Foco no primeiro campo com erro; erro do grupo associado aos rádios | Playwright (foco no rádio e depois no campo) |
| PUX-22 / NUX-29 | P2/P3 | CORRIGIDO | Rótulo "O que está errado e como deveria ficar?" ou "Por que remover esta informação?" | Playwright |
| NUX-28 | P2 | CORRIGIDO | "Um alimento por vez. Exemplo: amendoim, leite, camarão." | Captura |
| PUX-23 | P2 | BACKLOG | O diálogo compartilhado foca o "Fechar" (X), que não cancela; mudar o foco inicial altera todos os modais do sistema | — |
| PUX-19 | P2 | BACKLOG | O 409 da API não distingue conflito de limite; o limite já é avisado antes de enviar e o texto é preservado | — |
| PUX-24 | P3 | BACKLOG | Estilo de rótulo do sistema | — |
| PUX-25 / PUX-26 | P3 | BACKLOG | Texto de sucesso depende de validação clínica (PUX-01); abertura é texto aprovado (Q11) | — |
| NUX-26 | P1 | CONDIÇÃO DE ATIVAÇÃO | A flag não liga sem a tela do profissional que mostra as pendências (P3-0a + P3-3); registrado no plano | — |
| NUX-24 | P1 | DECISÃO DO PROPRIETÁRIO | Guardar a marca "não sabia classificar" exige campo novo no conteúdo (backend, R4); hoje é limite registrado da Q-G | — |
| NUX-27 | P1 | DECISÃO DO PROPRIETÁRIO / CLÍNICA | Texto de urgência é conteúdo clínico (ATV-1, ATV-7) | — |
| NUX-25 | P2 | DECISÃO DO PROPRIETÁRIO | Campo de reação muda o contrato e conversa com Q-E (gravidade fora do portal) | — |
| NUX-30 | P2 | BACKLOG (P3-3/P3-5) | Autoria da declaração/pedido na tela do profissional exige leitura no backend (P3-0a) | — |
| NUX-31 | P3 | BACKLOG | Aviso de duplicata (relacionado a NUX-07) | — |
| NUX-32 | P3 | JÁ COBERTO (decisão P2d-3b) | Cancelar vale de "enviado" ou "em análise", sob lock no backend; corrida provada em PostgreSQL na P2 | — |

Leitor de tela real e teste com pessoas continuam SKIPPED (ATV-7).
