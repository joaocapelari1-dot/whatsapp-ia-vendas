# Manual de Instruções e Uso
## Sistema de Automação WhatsApp + IA para Vendas

---

## 1. O que é o sistema

Sistema que automatiza vendas via WhatsApp sem intervenção humana. Você cola o
link de uma página de vendas, o sistema "aprende" tudo sobre o produto, e a
partir daí a IA conversa com qualquer cliente que chegar pelo WhatsApp — tira
dúvida, quebra objeção, e quando o cliente confirma interesse, gera o link de
pagamento e fecha a venda sozinha.

Um único número de WhatsApp atende múltiplos produtos ao mesmo tempo. A IA
identifica automaticamente qual produto está em discussão em cada conversa.

---

## 2. Antes de começar: contas e chaves necessárias

| Serviço | Para que serve | Onde conseguir |
|---|---|---|
| Anthropic (Claude) | Motor de IA que estuda o produto e conversa com o cliente | console.anthropic.com → API Keys |
| Supabase | Banco de dados (leads, produtos, conversas, vendas) | supabase.com → seu projeto → Settings → API |
| Mercado Pago | Geração dos links de pagamento | mercadopago.com.br/developers → Credenciais |
| Railway | Hospedagem do backend e da Evolution API | railway.app |
| Evolution API | Ponte que conecta seu WhatsApp ao sistema | Sobe como imagem Docker no Railway (grátis, open source) |

---

## 3. Instalação passo a passo

### 3.1. Preparar o projeto

1. Extraia o arquivo `whatsapp-ia-vendas.zip`
2. Abra a pasta no terminal
3. Rode:
   ```
   npm install
   ```

### 3.2. Configurar as chaves

1. Copie `.env.example` para um novo arquivo chamado `.env`
2. Preencha cada linha com suas chaves reais (veja a tabela da seção 2)

### 3.3. Criar as tabelas no banco

1. Abra seu projeto no Supabase
2. Vá em **SQL Editor**
3. Cole todo o conteúdo do arquivo `schema.sql`
4. Clique em **Run**

Isso cria 4 tabelas: `produtos`, `leads`, `conversas`, `vendas`.

### 3.4. Subir a Evolution API (conexão com o WhatsApp)

1. No Railway: **New Project → Deploy from Docker Image**
2. Use a imagem: `atendai/evolution-api:latest`
3. Configure estas variáveis de ambiente no serviço:
   - `AUTHENTICATION_API_KEY` — invente uma chave secreta (ela vai se repetir no seu `.env` como `EVOLUTION_API_KEY`)
   - `DATABASE_ENABLED=true`
   - `DATABASE_PROVIDER=postgresql`
   - `DATABASE_CONNECTION_URI` — connection string do seu Supabase Postgres
   - `WEBHOOK_GLOBAL_URL` — URL do seu backend + `/webhook/whatsapp` (ex: `https://seu-backend.railway.app/webhook/whatsapp`)
   - `WEBHOOK_GLOBAL_ENABLED=true`
   - `WEBHOOK_EVENTS_MESSAGES_UPSERT=true`
4. Aguarde o deploy finalizar

### 3.5. Conectar seu número de WhatsApp

Rode este comando uma única vez (troque a URL e a chave pelas suas):

```
curl -X POST https://seu-evolution.railway.app/instance/create \
  -H "apikey: SUA_CHAVE_SECRETA_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "vendas_principal", "qrcode": true}'
```

A resposta traz um QR code. Escaneie com o WhatsApp do número que vai atender
(Configurações → Aparelhos conectados → Conectar aparelho). Depois disso, o
número fica conectado permanentemente — **não precisa manter o celular ligado
ou o app aberto**.

### 3.6. Subir o backend em produção

1. No Railway, crie um segundo serviço (separado da Evolution API)
2. Aponte para a pasta do projeto (`whatsapp-ia-vendas`)
3. Configure as mesmas variáveis do seu `.env`
4. Atualize `BACKEND_URL` para a URL pública que o Railway gerar
5. Volte no serviço da Evolution API e confirme que `WEBHOOK_GLOBAL_URL`
   aponta para essa URL correta

---

## 4. Como usar no dia a dia

### 4.1. Cadastrar um novo produto

Toda vez que quiser colocar um produto novo pra vender via IA:

```
curl -X POST https://seu-backend.railway.app/produtos/importar \
  -H "Content-Type: application/json" \
  -d '{"url": "https://link-da-pagina-de-vendas.com", "codigo": "PX01"}'
```

- `url`: o link da página de vendas do produto (site próprio, Hotmart, etc.)
- `codigo`: um identificador curto que você escolhe (ex: `PX01`, `COPAIBA01`, `FADIGA01`)

O sistema devolve uma resposta assim:

```json
{
  "produto": { "nome": "...", "preco": ..., "status": "pronto" },
  "linkWhatsapp": "https://wa.me/5591999999999?text=Quero%20saber%20sobre%20%23PX01"
}
```

O campo `linkWhatsapp` é o link pronto que você vai divulgar — no anúncio, na
bio do Instagram, no botão da página de vendas, etc. Quando o cliente clica
nele, o WhatsApp abre automaticamente com uma mensagem já preenchida contendo
o código do produto, e a IA já sabe do que se trata.

**Importante:** a importação pode levar de 10 a 40 segundos, porque o sistema
acessa a página real e lê todo o conteúdo antes de responder.

### 4.2. Conferir os produtos cadastrados

```
curl https://seu-backend.railway.app/produtos
```

Isso lista todos os produtos e o status de cada um:
- `processando` — ainda lendo a página
- `pronto` — já pode receber vendas
- `erro` — falhou ao ler a página (verifique se o link está certo e acessível)

### 4.3. Produtos digitais (entrega automática)

Se o produto for digital (PDF, curso, acesso a plataforma), você precisa
informar o link de entrega manualmente após a importação, direto no Supabase:

1. Abra a tabela `produtos` no Supabase
2. Encontre a linha do produto pelo `codigo`
3. Preencha o campo `link_entrega` com o link de acesso

A partir daí, quando o pagamento for aprovado, a IA envia esse link
automaticamente pro cliente, sem você precisar fazer nada.

Se o produto for físico ou a entrega for manual, deixe esse campo vazio — a
IA só confirma o pagamento, e você segue com o envio por fora.

### 4.4. Acompanhar conversas e vendas

Todas as tabelas ficam visíveis e pesquisáveis direto no painel do Supabase
(**Table Editor**):

- **`leads`** — todo mundo que já mandou mensagem, com telefone e status no funil (`novo`, `conversando`, `interessado`, `comprou`, `perdido`, `escalado`)
- **`conversas`** — histórico completo de cada mensagem, do lead e da IA
- **`vendas`** — cada intenção de compra, com status do pagamento (`pendente`, `approved`, `rejected`)

### 4.5. Quando a IA escala para atendimento humano

Se um cliente tiver uma reclamação, dúvida de suporte pós-venda, ou qualquer
assunto fora do escopo do produto, a IA marca o lead como `escalado` na
tabela `leads` e para de responder automaticamente sobre aquele assunto. Vale
a pena checar esse status periodicamente no Supabase (ou, depois, configurar
uma notificação — ver seção 6).

---

## 5. Testando pela primeira vez

1. Importe um produto de teste (seção 4.1)
2. Clique no `linkWhatsapp` retornado, no seu próprio celular
3. Envie a mensagem que já vem preenchida
4. A IA deve responder reconhecendo o produto e puxando conversa
5. Faça algumas perguntas como se fosse cliente
6. Diga algo como "quero comprar" — a IA deve gerar um link de pagamento
7. Se quiser validar o fluxo de pagamento completo, finalize um pagamento de
   teste no Mercado Pago (eles têm cartões de teste na documentação) e
   confirme que a mensagem de confirmação chega automaticamente

---

## 6. Regra de ouro — não quebrar

**Nunca configure disparo em massa (broadcast) para listas de números que não
iniciaram contato.** Esse é o principal motivo de banimento de número no
WhatsApp. O sistema como construído só responde a eventos (alguém mandou
mensagem primeiro) — mantenha assim. Se no futuro quiser fazer reengajamento
de leads antigos, isso deve ser feito individualmente e com intervalo entre
mensagens, nunca em lote simultâneo.

---

## 7. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Produto fica em `erro` após importar | Página bloqueou o acesso automatizado, ou link errado | Confira o link no navegador; se a página tiver proteção anti-bot, pode precisar de ajuste técnico |
| IA não responde no WhatsApp | Webhook da Evolution API não está apontando certo | Confira `WEBHOOK_GLOBAL_URL` no serviço da Evolution API no Railway |
| Número desconectou sozinho | Instabilidade comum de conexões não-oficiais | Gere um novo QR code e reconecte (seção 3.5) |
| Pagamento aprovado mas cliente não recebeu confirmação | `BACKEND_URL` ou `notification_url` do Mercado Pago desatualizada | Confira se a URL pública do backend está correta nas variáveis de ambiente |
| Preço do produto veio errado ou vazio | Heurística de leitura de preço não encontrou o valor na página | Corrija manualmente o campo `preco` direto na tabela `produtos` no Supabase |

---

## 8. Resumo rápido (cola de referência)

- **Importar produto:** `POST /produtos/importar` com `url` e `codigo`
- **Divulgar:** use o `linkWhatsapp` retornado
- **Acompanhar:** tabelas `leads`, `conversas`, `vendas` no Supabase
- **Produto digital:** preencher `link_entrega` manualmente na tabela `produtos`
- **Nunca:** disparo em massa para números frios
