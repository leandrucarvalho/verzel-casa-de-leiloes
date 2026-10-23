# Decisões

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Front-end | Next.js (App Router) + TypeScript | Diferencial da vaga; deploy nativo na Vercel |
| Back-end | Node.js + Express + TypeScript | Processo longo, necessário para SSE e job de liquidação (não cabe em serverless) |
| Banco | PostgreSQL | Transações e `SELECT ... FOR UPDATE` para concorrência de lances |
| Tempo real | SSE (polling como plano B) | Unidirecional, simples, funciona atrás de proxy |
| Item externo | Art Institute of Chicago API | Aberta, sem chave, imagens IIIF e atributos ricos |

## Branches e fluxo

- `main`: produção. Só recebe PR vindo de `staging`.
- `staging`: homologação. Só recebe PR vindo de `develop`.
- `develop`: integração. Recebe PR de branches `feat/*`, `fix/*`, `chore/*`, `docs/*`, `ci/*`.
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, `refactor:`).
- Merge por merge commit nas promoções (`develop` → `staging` → `main`) e squash nas branches de trabalho.

## Deploy gratuito

| Peça | Serviço | Observação |
|---|---|---|
| Front-end | Vercel (Hobby) | Branch `main` = produção, `staging` = preview estável |
| API | Render (Web Service free, Docker) | Dorme após ~15 min sem tráfego (cold start de ~1 min). Mitigação: ping periódico e liquidação "lazy" no acesso, sem depender só do job |
| Banco | Neon (Postgres free) | Sem expiração, ao contrário do Postgres free do Render (30 dias) |

Pontos de atenção:

- SSE vai direto do navegador para a API (a Vercel limita conexões longas em rewrites), então a API precisa de CORS para o domínio do front.
- Segredos (URL do banco, segredo do HMAC e do JWT) ficam só nas variáveis de ambiente de cada serviço.
- Docker Compose (opcional do desafio) sobe `db`, `api` e `web` com o mesmo Dockerfile usado no Render.
