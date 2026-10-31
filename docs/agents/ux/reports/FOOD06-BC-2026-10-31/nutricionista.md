# Persona nutricionista — síntese editorial B/C

Instância `/root/food06_nutricionista_ux_b`, B e follow-up C independentes da outra
persona. Base6317a0c0 + worktree; sem commit imutável B próprio. Texto resume os
pareceres recebidos na atividade, preservando argumentos, prioridades e limites.

## B — achados

- **NUX-B01, P2, risco plausível:** ao consultar micronutrientes no celular, o
  profissional atravessava28 cartões para descobrir o botão. Evidência: posição
  observada pelo coordenador; abandono não medido. Impacto: rolagem repetitiva.
  Sugestão: acesso junto ao início da PA06. Aceite: botão antes dos cartões,
  preservando pedido apenas ao abrir.
- **NUX-B02, P2, defeito no caminho descrito:** um409 exclusivo do detalhe pedia
  atualização, mas só oferecia retry; o atalho da PA06 dependia de outro409.
  Impacto: repetir operação sem resolver causa. Sugestão: Atualizar seleção no
  detalhe, reutilizando rotina existente. Aceite: atualizar e só consultar após
  sucesso, sem reescrever o plano ou criar outra seleção.
- **NUX-B03, P2, hipótese de compreensão:** Completa2/2 poderia ser lida como
  completude nutricional/adequação. O aviso geral reduz risco, sem provar
  compreensão. Sugestão: Dados completos/parciais e denominador explícito.
  Aceite: presença de composição por alimento/nutriente, sem confiança percentual.

Positivos: zero distinto de desconhecido, parcial explícito, filtros e invalidação.
Não inventou cliques medidos ou concordância automática com o implementador.

## C — fechamento do incremento

Os três B foram considerados encerrados conforme observações/testes fornecidos:
posição corrigida RED/GREEN, atualização direta409 e rótulos/denominadores claros.
Sem novo bloqueio de usabilidade sustentado para este incremento factual.
A jornada permite selecionar/recalcular/abrir análise e distinguir as lacunas.

**NUX-C01, P3, BACKLOG:** observar futuramente se rolagem horizontal no celular
atrapalha relacionar nutriente, quantidade e cobertura. Hipótese, sem falha atual
comprovada; nenhuma mudança de layout adicional autorizada pela persona.

Limites: sem interação própria ou inspeção direta dos PNGs; DOM e observações
recebidos do coordenador.32 Playwright e24 testes relatados não são pesquisa
humana. Build/CI ainda pendentes na avaliação. Não conclui M01–M12, FOOD06,
validação clínica ou R4. Avaliação C limitada à jornada deste PR.
