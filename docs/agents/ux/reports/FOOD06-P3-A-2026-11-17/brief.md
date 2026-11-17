# Brief sintético — FOOD06 P3, etapa A (com D)

Etapa A sobre o **plano** das telas web de restrições (nenhuma tela, protótipo ou código). Base: `main` em `91241b1`, 2026-11-17.
Etapa D: o brief inclui as decisões aprovadas e o backlog herdado (P2-A, T8-A, T8-A2, plano de carteiras e vínculos), para não
repetir recomendações já tratadas. Dados: só cenários sintéticos. Cada persona recebeu a parte comum abaixo e a parte do seu público.

## Parte comum

Propósito: telas web (Next.js via BFF) para restrições alimentares do paciente, consumindo a API da P2. Tudo atrás da flag
`restricoes.clinicas`, desligada; ativação bloqueada por validação clínica (as restrições ainda **não** geram alerta automático
confiável no plano), jurídica e teste com pessoas.

Decisões aprovadas (não reabrir): restrição confirmada nunca vence; a avaliação do paciente pede reconfirmação a cada 180 dias.
Inativar alergia/celíaca: só Professional com a permissão clínica, confirmação em dois passos, motivo obrigatório e justificativa
protegida, sem reautenticação; não apaga histórico. Professional sem a permissão e Collaborator só registram pendências;
Collaborator lê só o que registrou. Paciente informa (vira pendência) e pede correção/remoção; nunca altera restrição confirmada.
Preferência não entra neste fluxo. Reconfirmação registra meio e resultado (atestação). Titular delega a carteira inteira a um
colaborador; a equipe registra representantes; uma conta pode representar vários pacientes.

## Parte do profissional (persona nutricionista)

Cenários: Dra. Ana, autônoma, com a permissão clínica; clínica com Dr. Bruno (titular) e Carla (colaboradora) com carteira delegada.

- Aba "Restrições" na ficha: aviso fixo "Estes registros ainda não geram alerta automático no plano"; situação da avaliação e aviso
  de reconfirmação (≤ 30 dias ou vencida, sem bloquear); lista agrupada (Alergias, Intolerâncias, Outras condições, Escolhas) com
  estado em texto e origem em texto.
- Registrar: natureza, tipo clínico, gravidade opcional, alimento em texto livre (sem catálogo de alérgenos), observação interna
  (≤ 1000, sem quebra). Sem a permissão, fica pendente.
- Ações: confirmar; rejeitar (justificativa obrigatória); reavaliar; inativar em dois passos (motivo + justificativa ≤ 1000; tela de
  revisão com o tipo e o alimento; botão separado).
- Reconfirmar avaliação: meio + resultado + atestação; "sem restrições declaradas" exige segunda confirmação e nenhuma pendência ou
  confirmada.
- Solicitações do paciente: listar, iniciar análise, decidir (atendida/parcial/recusada) com explicação ao paciente e justificativa
  interna; atender uma correção exige primeiro a operação clínica (inativar a antiga e registrar a nova) e depois citá-la.
- Equipe: conceder/revogar a carteira (limite 100, aviso de alcance); representantes (tipo de verificação; limite 100).
- Estados: carregando, vazio, erro genérico, conflito, resultado incerto. A API devolve 409 genérico para conflito ou limite.
- Limites: sem edição de conteúdo; solicitações mostram as 100 mais recentes; sem histórico de revogados.

## Parte do paciente (persona paciente)

Cenários: Júlia (celular, alérgica a amendoim confirmada); Marcos (representa a mãe e o filho, tem conta própria, usa leitor de
tela); Rita (pouca familiaridade com tecnologia e termos nutricionais).

- Seletor quando a conta acessa mais de uma pessoa; nome da pessoa no topo e em cada confirmação.
- Resumo com grupos e selos em texto: "Restrição registrada no seu acompanhamento", "Informação enviada por você", "Anotado pela
  equipe de atendimento; ainda será conferido"; última confirmação; gravidade a decidir.
- Vazio que não sugere ausência de risco; convite sobre questionário antigo; informar restrição; pedir correção/remoção; meus
  pedidos com estados em texto, explicação da equipe e cancelar só para o autor antes da decisão.
- Erros genéricos, falha de rede depois de enviar, limite de 200 itens. Alvo: WCAG 2.2 AA, teclado, leitor de tela, 200%/400%.
- Questões abertas apresentadas: selo "por você" quando outro representante informou; "equipe de atendimento" × "seu atendimento";
  mostrar a gravidade.

## Herdado (backlog)

Sucesso × falha de revogação; resultado incerto; revisão uma vez por item por sessão; nunca oferecer "inativar" como saída fácil de
bloqueio; sem selo verde; correção por teclado e leitor de tela; pessoa selecionada sempre identificável; perder acesso durante a
operação sem revelar dados.
