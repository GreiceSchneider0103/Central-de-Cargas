# Central de Cargas

## Stack oficial
- **Frontend:** Next.js (App Router)
- **Banco/Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Deploy:** Vercel
- **Produtos/CMV:** importação de planilha (exportação de produtos do Olist ou planilha com SKU/Nome/CMV) na tela Produtos
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

## O que é legado
Toda a implementação React/Vite/Firebase foi movida para `legacy-vite/` sem exclusão, para servir de referência visual e de domínio durante a migração.

## Próximos passos (alto nível)
1. Configurar cliente/server Supabase no `apps/web`.
2. Definir schema SQL inicial e migrations versionadas.
3. Implementar autenticação e RBAC com RLS.
4. Migrar gradualmente módulos (dashboard, solicitações, cargas, produtos, agenda).


## Produtos
- Cadastro por importação de planilha na tela Produtos (admin e gerente de estoque), escolhendo uma ou mais empresas. Aceita a exportação de produtos do Olist (.xls) — SKU, descrição, preço de custo, fornecedor, peso e medidas da embalagem — ou uma planilha com SKU / Nome / CMV.
- A antiga sincronização com o Google Sheets (`/api/products/sync` e o cron semanal) foi removida.

## Deploy bloqueado na Vercel ("Deployment Blocked")
O plano **Hobby** da Vercel não aceita colaboração em repositório privado: só é aceito deploy de commits cujo autor seja o dono da conta/projeto. Se um deploy de Production aparecer como **Blocked** com a mensagem "the commit author did not have contributing access to the project on Vercel":

- Confira o autor do commit (`git log -1 --format='%an <%ae>'`). Precisa bater com a conta dona do projeto na Vercel.
- Os commits feitos com ajuda do Claude Code neste repositório usam o autor `GreiceSchneider0103 <greicelessul@gmail.com>` (configurado localmente via `git config user.name`/`user.email`), justamente para evitar esse bloqueio.
- Se o bloqueio voltar a acontecer, as opções são: (1) fazer upgrade para o plano Pro da Vercel (aceita múltiplos colaboradores), ou (2) garantir que o commit que chega em `main` tenha o autor correto antes do merge.
