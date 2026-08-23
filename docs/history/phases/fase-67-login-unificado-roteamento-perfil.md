# Fase 67 - Login unificado e roteamento por perfil

## Entregue

- Mantido um unico login para profissional, equipe operacional e paciente.
- Adicionada decisao centralizada de autorizacao de rota no BFF web.
- Paciente autenticado acessa `/portal` e e redirecionado para `/portal` ao tentar telas do console.
- Perfis operacionais autenticados sao redirecionados para seu `destinoInicial` ao tentar `/portal`.
- A tela de login passou a comunicar o acesso unificado: profissional, equipe ou paciente.
- Adicionado teste `test:authz` para validar as regras de roteamento por perfil.

## Regras atuais

| Papel | Destino inicial | Rotas web permitidas neste corte |
| --- | --- | --- |
| `SuperAdmin` | `/operacoes` | Console operacional |
| `Professional` | `/agenda` | Console operacional |
| `Collaborator` | `/agenda` | Console operacional |
| `Patient` | `/portal` | Portal do paciente |

## Validacao esperada

1. Login como `Patient` deve cair em `/portal`.
2. Com sessao de paciente, abrir `/agenda`, `/pacientes` ou `/operacoes` deve redirecionar para `/portal`.
3. Login como profissional/equipe deve cair no destino operacional vindo do backend.
4. Com sessao operacional, abrir `/portal` deve redirecionar para o destino operacional do perfil.
