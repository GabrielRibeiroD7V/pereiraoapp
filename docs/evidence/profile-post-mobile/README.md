# Capturas do perfil e compositor

Build local de Preview do #51 sobre #50; demonstração isolada /qa/profile-editor/?view=profile, com dados sintéticos e Supabase desconectado. Browser Chromium emulado, NÃO Safari físico. Não são evidências de upload real.

- [Perfil 393×852](profile-393.jpg): ações próximas da identidade, contatos compactos.
- [Menu 320×852](add-menu-320.jpg): diálogo contido, Serviço / Foto de trabalho / Publicação.
- [Perfil desktop 1280×900](profile-desktop.jpg).
- [Fotos 393×852](composer-photos-393.jpg): seleção/ordenação antes da descrição.
- [Descrição e prévia 393×852](composer-caption-393.jpg).
- [Altura reduzida 393×340](composer-short-viewport.jpg): campo focado, fechar e ações visíveis, corpo rolável. Simulação de restrição de altura, não teclado real.
- [Compositor desktop 1280×900](composer-desktop.jpg).

Fluxo conferido: abrir Adicionar → escolher arquivo sintético pelo seletor → conferir foto → Continuar → preencher título/legenda → prévia → Cancelar. Nenhum envio ao Supabase. Salvamento/falhas/permissões cobertos separadamente por testes locais/SQL; precisam de autorização da expansão e sessão legítima para ensaio operacional.
