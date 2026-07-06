# Sistema de Automação WhatsApp + IA (Vendas)

Sistema que recebe um link de produto, "estuda" o conteúdo com IA, e conduz o
cliente via WhatsApp até a compra — sem intervenção humana.

## Arquitetura

```
Link de vendas
    ↓
POST /produtos/importar (scraping + Claude resume o produto)
    ↓
Cliente clica no link de WhatsApp gerado (com #codigo do produto)
    ↓
Evolution API → POST /webhook/whatsapp
    ↓
Backend identifica o lead/produto → Claude conversa (function calling)
    ↓
Cliente confirma compra → gera link Mercado Pago
    ↓
Pagamento aprovado → POST /webhook/mercadopago → confirma automaticamente
```

## Passo a passo para rodar

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha com suas chaves reais:

```bash
cp .env.example .env
```

- `ANTHROPIC_API_KEY`: sua chave da API da Anthropic
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`: do painel do seu projeto Supabase (Settings → API)
- `MP_ACCESS_TOKEN`: do painel de desenvolvedor do Mercado Pago
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE_NAME`: depois de subir a Evolution API (passo 4)

### 3. Rodar o schema no Supabase

Abra o **SQL Editor** do seu projeto Supabase e cole o conteúdo de `schema.sql`. Isso cria as 4 tabelas (`produtos`, `leads`, `conversas`, `vendas`).

### 4. Subir a Evolution API (bridge do WhatsApp)

No Railway:
1. New Project → Deploy from Docker Image
2. Imagem: `atendai/evolution-api:latest`
3. Configure as variáveis de ambiente no serviço da Evolution API:
   - `AUTHENTICATION_API_KEY` (você define, é a mesma que vai em `EVOLUTION_API_KEY` no seu backend)
   - `DATABASE_ENABLED=true`
   - `DATABASE_PROVIDER=postgresql`
   - `DATABASE_CONNECTION_URI` (pode usar a connection string do seu próprio Supabase Postgres)
   - `WEBHOOK_GLOBAL_URL=https://seu-backend.railway.app/webhook/whatsapp`
   - `WEBHOOK_GLOBAL_ENABLED=true`
   - `WEBHOOK_EVENTS_MESSAGES_UPSERT=true`

5. Depois do deploy, crie a instância (uma vez):

```bash
curl -X POST https://seu-evolution.railway.app/instance/create \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "vendas_principal", "qrcode": true}'
```

A resposta traz um QR code em base64 — escaneie uma vez com o WhatsApp que vai usar pra vender. Depois disso a instância fica conectada, sem precisar do celular online.

### 5. Rodar o backend localmente (teste)

```bash
npm run dev
```

Isso sobe o servidor em `http://localhost:3000`. Para a Evolution API (que está no Railway) conseguir chamar seu webhook local, use um túnel (ngrok, por exemplo) durante os testes, ou já suba o backend direto no Railway.

### 6. Importar um produto

```bash
curl -X POST http://localhost:3000/produtos/importar \
  -H "Content-Type: application/json" \
  -d '{"url": "https://link-da-pagina-de-vendas.com", "codigo": "PX01"}'
```

A resposta traz o produto processado e o `linkWhatsapp` pronto — é esse link que você coloca na sua página de vendas / anúncio.

### 7. Testar a conversa

Clique no `linkWhatsapp` retornado (ou mande manualmente uma mensagem contendo `#PX01` pro número conectado). A IA deve responder já reconhecendo o produto.

## Deploy em produção

Suba este backend como um segundo serviço no Railway (separado da Evolution API), configure as mesmas variáveis de ambiente do `.env`, e atualize `BACKEND_URL` e `WEBHOOK_GLOBAL_URL` para as URLs públicas do Railway.

## Notas importantes

- **Nunca** implemente disparo em massa/broadcast para listas de números frios — isso é o principal gatilho de banimento no WhatsApp. O sistema aqui é 100% orientado a evento (responde quem chamou).
- Se o produto for digital, preencha `link_entrega` na tabela `produtos` manualmente (ou crie uma rota de atualização) para que a confirmação de pagamento já entregue o acesso automaticamente.
- Para produtos com página muito pesada em JS, o Puppeteer já lida com isso (`waitUntil: networkidle2`). Se alguma página específica falhar, pode ser necessário aumentar o timeout.

## Pareamento manual de plataformas (Braip, Cakto e outras com 2FA/e-mail)

Algumas plataformas de afiliado pedem confirmação por e-mail ou 2FA no
login, o que trava o login automático do coletor. A solução: você loga
**uma vez, manualmente, no seu PC** — o navegador abre visível, você
completa o login normalmente (incluindo 2FA), e a sessão fica salva no
Supabase. O coletor no Railway reaproveita essa sessão depois, sem
precisar logar de novo por semanas.

Rodar (no terminal, dentro da pasta do projeto, com `.env` preenchido):

```
node scripts/pareamento.js braip
node scripts/pareamento.js cakto
```

Troque `braip`/`cakto` pela plataforma que quiser parear (`hotmart`,
`kiwify`, `eduzz`, `monetizze`, `kairos` também funcionam, mas normalmente
só precisam disso se o login automático falhar).

Quando a sessão expirar (você vai ver um aviso nos logs do Railway tipo
`sessão pareada parece ter expirado`), é só rodar o comando de novo.
