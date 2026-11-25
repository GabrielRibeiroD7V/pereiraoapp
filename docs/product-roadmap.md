# PEREIRÃO — direção de produto e etapas

Direção registrada em 24/11/2026. Este documento é planejamento; não declara funcionalidades futuras implementadas ou homologadas.

## Regra de produto

Plataforma aberta de serviços e projetos: qualquer conta habilitada, autenticada e com e-mail confirmado pode publicar no próprio perfil e no feed, sem aprovação administrativa prévia e sem precisar cadastrar negócio ou serviço. Autônomos e empresas também publicam seus perfis profissionais e projetos pelo aplicativo. A administração atua na moderação posterior, com denúncias, suspensão e auditoria. Publicar um post e publicar um perfil profissional são ações distintas e explícitas.

Não publicar automaticamente rascunhos existentes. Preservar privacidade, autoria, moderação e proteções financeiras. Publicação aberta e visual azul/turquesa seguem a implementação já autorizada; este planejamento não autoriza novas migrações, merges ou publicação de conteúdo. Nenhuma etapa depende de assinatura ou cobrança.

O diferencial a desenvolver conecta **mostrar trabalhos → publicar uma necessidade → conversar com quem pode atendê-la**.

## Sequência e critérios verificáveis

| Etapa | Dependências | Critérios de conclusão | Riscos e decisões antes da implementação |
| --- | --- | --- | --- |
| 1. Base funcional | Publicação aberta, mídia privada/pública, perfis, feed, busca e conversas existentes | Duas contas legítimas distintas completam publicar → encontrar → iniciar conversa → responder → recarregar. Testar conta pessoal e profissional; rascunhos inacessíveis ao terceiro; só autor modifica; retirada e moderação removem conteúdo público. Busca de prestadores continua distinta do feed de projetos. Registrar separadamente testes automatizados, operação real e testes físicos. | RLS/API/Storage devem concordar; evitar vazamento de rascunhos e de dados profissionais privados através de um post público. Validar pré-requisitos reais da conversa, retorno após login e persistência. Não usar demonstração como prova operacional. SQL e deploy precisam de sequência compatível, sem interface nova contra regras antigas. |
| 2. Horários opcionais | Base estável e identificação/permissões do negócio | Responsável cadastra dias, intervalos e fuso IANA, e informa se aceita contatos fora do horário. Sem cadastro válido: “Horário não informado”. “Aberto agora” calculado no fuso do negócio, com testes de virada do dia, intervalos, fechamento e transições de fuso. Mesma informação em iPhone, Android e desktop. | Definir exceções/feriados e intervalos que atravessam meia-noite antes de exibir o indicador. Localização do visitante não determina o fuso do prestador. Horário não prova presença nem garante resposta. Escrita somente pelo responsável; leitura pública somente no perfil público. |
| 3. Disponibilidade manual | Base; horários são informação complementar, não condição técnica obrigatória | “Disponível para novos trabalhos” exige ação do responsável e validade definida. Expirado o prazo, não continuar anunciando disponibilidade. Testar renovar, desativar, expirar e recarregar nos três tipos de dispositivo. | Alinhar duração/limites e tratamento após expiração. Separar disponibilidade de horário e de presença: nunca chamar de “online”. Proteger alterações por terceiros e usar tempo do servidor. |
| 4. Pedidos de projetos | Base com conversa real, autoria, mídia, busca por categoria/cidade e moderação; horários/disponibilidade podem enriquecer depois | Cliente cria necessidade com descrição, categoria, cidade, fotos opcionais e prazo. Profissional manifesta interesse; cliente escolhe com quem conversar. Definir e testar estados e transições, edição, retirada, encerramento e moderação. Telefone e endereço exato não aparecem publicamente. | Aprovar modelo, visibilidade de cada campo/foto, participantes, retenção, denúncias, limites e proteção contra spam antes do SQL. Interesse não equivale a contratação nem autoriza contato irrestrito. Não reutilizar automaticamente permissões de posts para pedidos. |
| 5. Notificações | Mensagens persistidas e participantes autorizados; respostas a pedidos dependem da etapa 4 | Primeiro avisos internos derivados de eventos reais, com deduplicação, isolamento por destinatário e leitura persistida. Depois push opcional, mediante ação explícita da pessoa. Validar recusa/revogação, entrega duplicada, conta desconectada e conteúdo privado na tela bloqueada. | Permissão de push não implica entrega garantida. No iPhone, considerar requisitos do app adicionado à Tela de Início e suporte efetivo; não prometer push em uma aba comum do Safari. Definir assinaturas por dispositivo, expiração, remoção no logout e conteúdo mínimo antes de provisionar serviços. |

Dependência principal: **base → pedidos → avisos de respostas**. Horários e disponibilidade entram na ordem de produto acima, mas não devem bloquear publicação ou conversa. Avisos internos de mensagens podem preceder pedidos quando a base estiver validada; push vem depois dos avisos internos e da gestão de consentimento.

## Validação por dispositivo

Cada módulo terá critérios para iPhone/Safari, Android/Chrome e desktop: navegação e retorno, formulários com teclado, alvos de toque, foco acessível, recarga, novo login e falha de rede. Emulação não comprova seletor nativo, instalação, gestos, permissões ou push físicos. Resultados físicos só serão registrados após execução/relato, sem pedir ao titular testes de módulos ainda não implementados.

## Limite desta rodada e próxima entrega

Somente registrar dependências e critérios. Não criar telas, tabelas, notificações, dados demonstrativos ou PRs das etapas 2–5. Antes de cada módulo, alinhar escopo, modelo de dados, permissões, retenção, moderação e testes; qualquer SQL remoto exige preflight e autorização específica.

Próxima entrega concreta: concluir os PRs da base de publicação aberta e do visual azul/turquesa, apresentar os preflights SQL e, após as autorizações pertinentes, validar o ciclo real com duas contas. Não alterar Asaas, fase gratuita, isenção, assinatura ou cobrança.
