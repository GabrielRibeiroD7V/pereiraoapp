# Demonstração reversível de duas identidades

Execução: `npm run demo:local`, somente em `http://127.0.0.1:5201` no computador. O comando desabilita as variáveis Supabase para este servidor e não integra nenhum caminho ao build de produção. O cabeçalho identifica autenticação, posts e conversa como SIMULAÇÃO LOCAL em memória. Não informe credenciais.

Duas identidades A e B, dois perfis, um post e serviços para cada perfil e uma conversa com mensagens nos dois sentidos. Alternar identidade remonta a sessão simulada e mantém apenas o estado do processo em memória. É possível enviar A→B/B→A, abrir perfil, capa, página própria e serviços. Nenhum participante, foto ou mensagem é criado no banco operacional; não há número de WhatsApp real.

## Limites reais

- Autenticação e persistência da demonstração são simuladas. Não é teste de dois usuários Supabase Auth, nem de envio real pela API operacional.
- Os testes SQL/RLS existentes executam operações de mensagens em PostgreSQL nativo descartável com identidades de fixture, sem serviço Supabase Auth. Não transformam o login simulado em autenticação real.
- Leitura da integração confirmou que o projeto não tem branches Supabase isoladas. Criar uma branch pode gerar custo por hora; não foi criada. Para ensaio real de Auth+Storage+mensagens sem contaminar produção, é necessária uma decisão sobre ambiente isolado e custo, seguida de preflight das migrações desse ambiente. Não usar service_role para simular usuário nem publicar os negócios reais para viabilizar um teste.

## Manifesto e remoção

Todos os identificadores, nomes e imagens estão em `src/test/socialDemo.ts`, somente para fixtures, com nomes “Demonstração A/B”. As duas mensagens iniciais são explicitamente técnicas; mensagens adicionais só existem em memória. Não há senha, cookie, token ou e-mail real.

Encerrar Ctrl+C e recarregar a página encerra os dados adicionais. Nenhuma limpeza no navegador ou banco do usuário. Uma futura homologação isolada deve registrar os UUIDs reais no manifesto privado antes de qualquer remoção; objetos pelo Storage API, mensagens/posts/vínculos por operações autorizadas, Auth por último e apenas contas identificadas como teste. Não há autorização de limpeza de dados operacionais.

## Evidência local nova

Teste de unidade: separação entre gestão A/B, mesma conversa simulada, remetentes distintos e rejeição de outro identificador de conversa. QA em 393 e 1280 px: A envia, B lê/responde, A recebe, abre perfil/post e serviços; interceptação confirma nenhuma requisição remota e nenhum erro JS. Capturas marcadas como demonstração, sem aceite físico. Nada desse ambiente foi publicado no domínio oficial.
