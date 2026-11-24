# Home e identidade compartilhada — referência aprovada

## Escopo

Topo azul-marinho, lettering oficial centralizado geometricamente (arquivo original, composição SVG para fundo escuro), localização abaixo, título com destaque amarelo e busca funcional. Curvas/gradientes em CSS, sem vídeo, imagem remota ou animação contínua. Categorias mantêm as seis ilustrações, nomes, IDs e destinos existentes; três colunas compactas no celular e seis no desktop. Estados vazios reais e feed público existente preservados. Convite profissional em card compacto, com destino do cadastro preservado.

Cabeçalho, superfícies, botões e barra fixa de quatro destinos usam o mesmo acabamento nas páginas compartilhadas. Nenhum atalho de mensagens no topo. O convite de instalação fica acima da barra; regras de instalação/dispensa não foram alteradas. Cor de tema do manifesto, HTML e fallback offline acompanha o cabeçalho; identidade, start_url e protocolo de atualização do PWA preservados.

## Comparação com a referência

Mantidos hierarquia, topo escuro, busca branca, sublinhados amarelos, cards claros, ilustrações e convite escuro. Adaptados deliberadamente: cards menores, sem perfis/contadores inventados; ilustrações já aprovadas, sem criar outro estilo; quatro abas em vez de atalho duplicado no cabeçalho; desktop com conteúdo limitado a 62rem. Após inspecionar as capturas, corrigidos o fundo da marca, recorte do símbolo e altura excessiva do convite.

## Evidências implementadas

Capturas de componentes reais em Chromium local, com API vazia compatível com o estado público atual. Não são teste físico nem comprovação de consulta remota. Fixture preenchida é exclusivamente sintética e local, sem criar dados de produção.

- [Celular, topo](qa/home-reference/home-top-393.png)
- [Celular, fim](qa/home-reference/home-end-393.png)
- [Desktop, topo](qa/home-reference/home-top-1280.png)
- [Desktop, fim](qa/home-reference/home-end-1280.png)

Script reproduzível: `PUPPETEER_MODULE=/caminho/puppeteer-core.js QA_OUTPUT=/diretorio node scripts/home-refresh-qa.mjs` (usa Chrome local já instalado; não adiciona dependência de produção).

Validações: 320, 375, 390, 393×852, 430, 768, 1024, 1280 e 1440 px; viewport reduzida 393×360 (não simula teclado físico); centralização <1px; seis destinos; quatro abas; alvos >=44px; rótulos dentro dos cards; navegação por Tab; movimento reduzido; posição do convite sem sobrepor a barra. Contrastes medidos >=4.5:1; nenhum erro JavaScript, requisição externa ou overflow. Capturas adicionais de Buscar, Conta, entrada de Conversas e feed com carrossel sintético.

693 testes automatizados; typecheck e build. Novos testes exercitam busca/URL, categorias, vazio vs indisponibilidade, ausência de leitura privada, feed/data/carrossel/página própria e retorno de login de Conversas. Checks de SQL/RLS do CI são de banco descartável, não migrações remotas.

## Limites e preservação

Pendente relato físico de Safari/iPhone: renderização da marca, safe areas, teclado, retorno/instalação. Não houve nova aceitação de upload, autenticação ou conversas com duas contas nesta entrega. Nenhuma alteração em SQL, RLS, autenticação, regras financeiras, dados operacionais ou publicação. UFMS e negócios em rascunho não são usados para preencher o feed. Sem alterações no PR #52 ou #62.
