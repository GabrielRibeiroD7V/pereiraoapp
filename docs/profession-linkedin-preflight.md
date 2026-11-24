# Profissão declarada e LinkedIn: preflight, compatibilidade e limites

## Escopo

Migração proposta `20261123041029_business_profession_linkedin.sql`, gerada pelo CLI. SHA-256 `dca975adecc43459db70ca905d8ec4b18384aad17a583d1991a55e7292a4c2c5`. Adiciona somente profession (até 100 caracteres) e linkedin_url (até 300) a business_presentations, ambos opcionais com default vazio. Não altera businesses.description, categorias, especialidades, cidade, foto, publicação, dados privados, finanças ou gratuidade. Na empresa, a UI usa “Atuação declarada da empresa”; não atribui profissão/registro a um empregado ou proprietário. Autônomo usa “Profissão declarada”; nunca uma credencial verificada.

RPC nova save_business_presentation_identity com SECURITY INVOKER/search_path vazio, EXECUTE somente authenticated. RLS existente continua limitando escrita ao proprietário/admin do negócio; administrador da plataforma pode ler revisão, sem ganhar escrita/propriedade. Leitura pública continua dependendo de negócio publicado. URL só HTTPS nos hosts exatos linkedin.com/www.linkedin.com e caminhos /in/slug ou /company/slug, sem query, fragmento ou credenciais; normalização canônica no cliente e CHECK no banco. React escapa texto e link usa noopener/noreferrer/no-referrer. Registro não implica verificação.

## Preflight executado sem aplicação

- Leitura do remoto yazdjiwaksamizrbqewq: 18 versões registradas; última 20261123014433. Tabela existente com RLS; os dois campos novos ausentes; quatro drafts.
- CLI db push --remote=yazdjiwaksamizrbqewq --dry-run --skip-vault listou exclusivamente este arquivo. Nenhuma seed, role ou migração anterior será aplicada por esse plano. Não foi executado push sem dry-run.
- Aplicação sequencial das 18 migrações existentes mais a proposta e testes SQL/RLS em PostgreSQL 17 descartável, sem Docker. Inclui proprietário, admin do negócio, terceiro, viewer/admin da plataforma, anônimo, publicação local, retirada local, URL inválida e RPC antiga preservando novos campos. Nenhuma publicação ou início de gratuidade foi feito no projeto operacional.

## Compatibilidade e ordem futura (exige autorização)

1. Revalidar projeto, histórico, SHA/hash final, campos ausentes e dry-run somente deste arquivo. Parar em qualquer divergência. Rever diff/CI. Não reaplicar migrações anteriores.
2. Aplicar exclusivamente a expansão após decisão específica. Transação única com lock_timeout 5s: falha reverte tudo. Não escreve linhas de negócios/contas nem cria apresentação sintética remota.
3. Validar colunas/constraints/grants/RLS/RPC em leitura e integridade. Testar escrita somente com conta/dados legítimos explicitamente autorizados, sem publicar.
4. O Preview normal pode gravar profissão e LinkedIn reais apenas depois da aplicação. Antes disso, detecta as colunas ausentes, mostra campos novos desabilitados e mantém título/experiência existentes pela RPC antiga. Não descarta nova informação silenciosamente caso uma RPC falhe.
5. Integrar o código somente após decisão correspondente. Cliente antigo continua usando a RPC antiga, que preserva profession/LinkedIn. Sem necessidade de indisponibilidade planejada; pode haver falha transacional se lock não for obtido, sem efeito parcial.

## Contenção

Preferir reverter o frontend e manter a expansão aditiva: dados existentes e novos ficam preservados, RPC antiga segue funcionando. Se necessário, revogar EXECUTE da RPC nova exige autorização específica e pausa apenas a edição nova; leitura/edição antiga continuam. Não apagar colunas, registros ou arquivo de migração do histórico como “rollback”. Remoção futura exigiria plano próprio com preservação dos dados e nova migração autorizada.

## Evidências e teste do Preview

Preview normal: acompanha o backend operacional, sem dados fabricados; campos novos ficam indisponíveis antes da migração. Demo em /qa/profile-editor/?view=profile: só build Preview, configuração Supabase vazia, negócios/pessoas/serviços sintéticos fora da conta de Gabriel. Apresentação persistida apenas em localStorage com chave exclusiva de QA para validar recarga; não é persistência real do Supabase. Demais dados permanecem em memória. Não informar dados pessoais nessa demo.

Percurso: Meu perfil → Editar perfil → Profissão, título e LinkedIn (empresa: Atuação, título e LinkedIn) → profissão + LinkedIn + título → Salvar apresentação → mesmo perfil → Ver como cliente → recarregar o mesmo link da demo. Somente dados salvos aparecem; bio/categoria existentes continuam independentes. Testar também empresa e endereço inválido. A navegação existente volta ao mesmo businessId; autenticação, isenção e aprovação não se alteram. Testes em navegador de desktop/emulação não contam como testes físicos de Safari/Android.
