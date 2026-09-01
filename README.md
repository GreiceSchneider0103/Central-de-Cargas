# Central de Cargas

## Stack oficial
- **Frontend:** Next.js (App Router)
- **Banco/Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Deploy:** Vercel
- **Produtos/CMV:** Google Sheets
- **MVP:** sem upload de documentos

## Estrutura do repositório
- `apps/web`: novo app Next.js (base da migração)
- `legacy-vite`: aplicação antiga React + Vite + Firebase/Firestore preservada para referência
- `supabase/migrations`: diretório de migrations SQL (estrutura inicial)
- `docs`: documentação técnica

## Como rodar o novo app
```bash
npm install
npm run dev
```

A aplicação Next.js sobe em ambiente local (padrão `http://localhost:3000`).

## Variáveis de ambiente
Copie `.env.example` para `.env.local` (ou equivalente) e preencha:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (uso **somente server-side**)
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_RANGE`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `CRON_SECRET`

## O que é legado
Toda a implementação React/Vite/Firebase foi movida para `legacy-vite/` sem exclusão, para servir de referência visual e de domínio durante a migração.

## Próximos passos (alto nível)
1. Configurar cliente/server Supabase no `apps/web`.
2. Definir schema SQL inicial e migrations versionadas.
3. Implementar autenticação e RBAC com RLS.
4. Migrar gradualmente módulos (dashboard, solicitações, cargas, produtos, agenda).


## Sincronização de produtos (Google Sheets)
- Endpoint interno: `GET|POST /api/products/sync`
- Manual: usuário `admin` autenticado pode acionar na tela de Produtos.
- Automático (cron gratuito): `apps/web/vercel.json` declara um Vercel Cron Job (`0 11 * * 1` = toda segunda-feira, 08:00 no horário de Brasília) que chama esse endpoint. Cron Jobs fazem parte do plano gratuito (Hobby) da Vercel, com o limite de rodar no máximo 1x/dia por job — semanal está dentro do limite.
- Para o cron funcionar em produção:
  1. Defina a env var `CRON_SECRET` (qualquer string aleatória) nas configurações do projeto na Vercel.
  2. A Vercel injeta automaticamente o header `Authorization: Bearer <CRON_SECRET>` nas chamadas do cron — o endpoint já valida esse header antes de rodar a sincronização.
  3. Sem `CRON_SECRET` configurado, o endpoint continua funcionando apenas no modo manual (admin autenticado).
- Em caso de variáveis do Google não configuradas, a API retorna erro amigável.
