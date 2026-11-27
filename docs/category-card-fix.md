# Correção dos cards e retorno do convite profissional

Base: main após #101, squash `d9f000de1748ff1f610eae267ff87619d097a9f1`.

## Defeito reproduzido e causa

As ilustrações estavam dentro de um frame Grid de altura fixa com `overflow:hidden`; o dimensionamento percentual da imagem conservava uma altura derivada de sua largura/proporção intrínseca maior que o frame. A validação anterior cobria overflow da página, mas não esse corte interno.

A nova checagem de contenção falhou **antes** da correção em 360px: frame 42,390625px, imagem 49,5px. O recorte fica ainda mais visível no desktop. Não foi necessário alterar os SVGs.

Correção: frame Flex centralizado e imagem com altura limitada, largura automática, máximos de largura/altura e `object-fit:contain`. Mantém os 12 cards, quatro colunas, três linhas, nomes, IDs, rotas e ilustrações existentes.

## Convite restaurado

A pedido do titular, “É profissional ou tem uma empresa? Cadastre-se” voltou como acesso compacto abaixo dos banners e acima das categorias. Fora das imagens, sem overlay. Usa `/conta/profissional`, a mesma entrada do segundo banner: login quando necessário, retomada de negócio/draft ou formulário existente. Não cria registros ao abrir.

## Verificações

- Nova asserção no script visual verifica que **toda a caixa de cada uma das 12 imagens cabe no respectivo frame**, além da grade e ausência de overflow da página.
- Chromium local emulado: 320, 360, 375, 390, 393, 430, 768, 1024, 1280 e 1440px; passou após a correção, sem erros JS ou tráfego externo. Não é Safari físico.
- 42 testes direcionados aprovados; typecheck e build aprovados. A regressão do convite confere texto, destino e ordem entre banner/categorias.
- Nenhuma imagem foi redesenhada, nenhuma migração proposta/aplicada e nenhuma regra de cadastro ou financeira foi alterada.

## Capturas locais sintéticas

- [Antes, desktop](screenshots/category-card-fix/before-1440.png).
- [Depois, desktop](screenshots/category-card-fix/after-1440.png).
- [Depois, 393px](screenshots/category-card-fix/after-393.png).
- [Depois, 320px](screenshots/category-card-fix/after-320.png).

São capturas da interface implementada com catálogo sintético identificado, não aceite físico no aparelho do titular. A barra inferior fixa aparece na posição da viewport na captura longa; seu comportamento não foi alterado.

## Produção versus proposta

O #101 foi integrado com autorização própria. Vercel confirmou READY, alias `pereirao.vercel.app` e SHA `d9f000de1748ff1f610eae267ff87619d097a9f1`. Na leitura HTTP, HTML e version.json coincidem em `c10862531ccb5a2782b6`; os dois WebPs respondem HTTP200/image-webp e o JS entregue contém os banners novos.

A captura enviada como “antigo” mostra carregamento, mas não contém identificação da versão em execução. Ela não prova cache antigo ou falha do app instalado. Nenhuma sessão/cache foi apagada nem causa de cache foi presumida.

Esta correção posterior fica em PR separado, aguardando decisão para integrar. #99 permanece aberto e separado; nenhum SQL, cobrança ou publicação de negócio/post foi executado.
