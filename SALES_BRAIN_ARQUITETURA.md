# Sales Brain — Arquitetura Completa (Design)

## Princípio central

O LLM nunca decide sozinho. Ele só transforma decisão em linguagem. Toda
decisão de negócio (o que dizer, quando empurrar checkout, como tratar
objeção) vive no backend, em código determinístico + regras. Isso substitui
o `processarComIA.js` atual, que hoje manda tudo pro Claude decidir sozinho.

```
Mensagem do cliente
    ↓
Classification Agent    → entende intenção
    ↓
Conversation State      → atualiza o "estado" daquela conversa
    ↓
Buy Score Engine        → recalcula intenção de compra (0-100)
    ↓
Objection Engine        → detecta objeção, se houver
    ↓
Decision Engine         → escolhe a ESTRATÉGIA (não a resposta)
    ↓
Prompt Builder          → monta o prompt certo pra aquela estratégia
    ↓
LLM (Claude)            → só aqui gera o texto da resposta
    ↓
Response Validator      → checa se não inventou nada, não vazou prompt
    ↓
WhatsApp
```

---

## FASE 1 — Núcleo (substitui o motor atual)

Objetivo: sair do "Claude decide tudo" pro "backend decide, Claude escreve".

### Módulos

**1. Classification Agent** (`src/agents/classification/`)
- Recebe a mensagem crua do cliente
- Chama o LLM com prompt curto e focado só em classificar (não em vender)
- Devolve JSON: `intent`, `confidence`, `stage`, `emotion`, `objection`, `buyScoreDelta`
- Custo baixo — é uma chamada pequena e barata, separada da chamada de venda

**2. Conversation State** (`src/conversation/state.js`)
- Substitui a tabela `conversas` simples por um registro de estado por conversa
- Campos: `stage`, `buyScore`, `interestLevel`, `objections[]`, `lastQuestions[]`,
  `sentiment`, `checkoutGenerated`, `messagesCount`, `waitingHuman`
- Persistido no Supabase (nova tabela `conversation_state`)
- É consultado e atualizado a cada mensagem — nunca se decide só olhando o
  histórico bruto

**3. Buy Score Engine** (`src/decision/buyScore.js`)
- Função pura: recebe estado atual + evento (intent classificado) → devolve novo score
- Tabela de pesos configurável (preço +10, garantia +8, frete +15, parcelamento +20,
  pediu link +25, 3 dias sem responder -30, "vou pensar" -15, comparou concorrente -5)
- Score decai com o tempo (job periódico ou cálculo no momento da leitura)

**4. Decision Engine** (`src/decision/engine.js`)
- Input: estado da conversa + intent + buyScore + objeção detectada
- Output: uma **estratégia** (enum), não uma resposta
- Estratégias da Fase 1: `responder_informacao`, `coletar_info`, `conduzir_checkout`,
  `transferir_humano`, `encerrar`
- Regra simples de exemplo: `buyScore > 70 E intent = buy → conduzir_checkout`

**5. Prompt Builder** (`src/prompt/builder.js`)
- Monta o `system` prompt dinamicamente combinando: estratégia escolhida +
  resumo do produto (já cacheado, como fizemos) + últimas mensagens + regras
  comerciais fixas
- Cada estratégia tem um "bloco" de instrução própria que entra no prompt

**6. Response Validator** (`src/response/validator.js`)
- Checagens pós-resposta, antes de enviar:
  - Preço mencionado bate com o preço real do produto?
  - Não contém frases tipo "sou uma IA", "não posso te ajudar com isso"?
  - Não vazou nada do prompt de sistema?
- Se falhar, reprocessa com instrução de correção ou cai pra `transferir_humano`

### Schema novo (Supabase)

```sql
create table conversation_state (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) unique,
  product_id uuid references produtos(id),
  stage text default 'discovery',
  buy_score integer default 20,
  interest_level text,
  objections jsonb default '[]',
  last_questions jsonb default '[]',
  sentiment text default 'neutral',
  checkout_generated boolean default false,
  purchase_completed boolean default false,
  waiting_human boolean default false,
  messages_count integer default 0,
  updated_at timestamptz default now()
);
```

### Critério de saída da Fase 1
Substituir completamente `processarComIA.js` por esse pipeline, testar com
conversas reais, e comparar: a taxa de resposta "estranha" ou fora de tom cai?

---

## FASE 2 — Refinamento comercial

Objetivo: dar nuance — parar de tratar toda objeção/cliente do mesmo jeito.

### Módulos

**7. Customer Profile** (`src/agents/classification/profile.js`)
- Classificação leve rodando em paralelo: `analítico`, `impulsivo`,
  `desconfiado`, `sensível a preço`, `premium`, `curioso`, `decidido`
- Ajusta o tom no Prompt Builder (ex: analítico recebe mais dado técnico,
  impulsivo recebe menos texto e call-to-action mais direto)

**8. Objection Engine** (`src/decision/objections.js`)
- Categoriza objeção: preço, confiança, entrega, garantia, qualidade, marca,
  necessidade, urgência
- Cada categoria tem uma **estratégia de resposta própria** registrada em
  `src/decision/strategies/objection_*.js`
- Exemplo do fluxo de preço, conforme sua spec: mostrar valor → prova social
  → garantia → parcelamento → perguntar se fecha (nunca desconto automático)

**9. Strategy Engine** (`src/decision/strategies/`)
- Expande as estratégias da Fase 1 pra incluir: `quebrar_objecao`,
  `comparar_produtos`, `gerar_confianca`, `mostrar_provas_sociais`,
  `mostrar_garantia`, `upsell`, `cross_sell`
- Cada estratégia é um arquivo separado com sua própria lógica de quando
  disparar e que instrução gerar pro Prompt Builder

### Critério de saída da Fase 2
Objeção de preço, confiança e entrega têm tratamento visivelmente diferente
nos logs — não é mais resposta genérica.

---

## FASE 3 — Product Brain multi-plataforma

Objetivo: em vez de só ler qualquer página com Puppeteer genérico, reconhecer
a plataforma e extrair de forma estruturada.

### Módulos

**10. Platform Detector** (`src/knowledge/platformDetector.js`)
- Identifica pela URL/HTML: Mercado Livre, Hotmart, Kiwify, Eduzz, Braip,
  Amazon, Shopee, WooCommerce, Shopify, ou site próprio
- Cada plataforma tem um **extractor** próprio (seletores CSS específicos),
  porque scraping genérico perde informação estruturada (avaliação, FAQ,
  política de devolução)

**11. Knowledge Engine** (`src/knowledge/documents.js`)
- Ao invés de um único texto "conhecimento_ia" solto, gera documentos
  separados e indexáveis: resumo, características, benefícios, diferenciais,
  dúvidas frequentes, objeções mapeadas, público-alvo, tom de venda
- Isso é o que entra no cache do prompt (mesma técnica que já implementamos,
  só que agora com conteúdo mais estruturado)

### Critério de saída da Fase 3
Importar um link de Mercado Livre ou Hotmart traz avaliação de nota, número
de vendas e política de devolução — não só texto solto da página.

---

## FASE 4 — Memória, follow-up e aprendizado

Objetivo: o sistema fica "mais esperto" com o tempo, e não deixa lead esfriar.

### Módulos

**12. Memory Engine** (`src/memory/`)
- Guarda por lead: produtos vistos, objeções, compras, preferências
- Se o mesmo telefone voltar meses depois, a IA já "lembra" do contexto —
  isso já tem base pronta na tabela `leads`/`conversas`, só precisa persistir
  de forma mais estruturada (resumo, não histórico bruto infinito)

**13. Follow-up Engine** (`src/decision/followup.js`)
- Cron job (mesmo padrão que já usamos no LeilaoWDO)
- 24h sem resposta → lembrete amigável (individual, nunca em lote)
- 72h → nova tentativa
- 7 dias → último contato, depois marca como `perdido`

**14. Analytics** (`src/analytics/`)
- Dashboard simples: tempo médio de conversa, objeções mais comuns, taxa de
  conversão por estratégia, buy score médio dos que compraram vs. dos que
  não compraram
- Reaproveita o padrão de dashboard que você já tem no LeilaoWDO

**15. Auto Learning** (`src/knowledge/autoLearning.js`)
- Salva perguntas novas não previstas na base de conhecimento
- Salva respostas que levaram à venda vs. que levaram a perda
- Job periódico sugere atualização do Knowledge Engine (não atualiza sozinho,
  te avisa e você aprova — igual ao padrão de calibração que você já usa no
  WDO depois de 30 pregões)

**16. Logs de decisão** (`src/utils/decisionLog.js`)
- Cada mensagem gera um rastro auditável: intent → buyScore → stage →
  objeção → estratégia → prompt → resposta → validação → envio
- Guardado em tabela própria, permite auditar qualquer conversa depois

### Critério de saída da Fase 4
Um lead que sumiu há 3 dias recebe follow-up automático sem você configurar
nada manualmente, e você consegue ver no analytics qual estratégia converte mais.

---

## Resumo de esforço por fase

| Fase | O que entrega | Complexidade |
|---|---|---|
| 1 | Motor de decisão real (troca o atual) | Média — é a base de tudo |
| 2 | Objeção e perfil tratados com nuance | Média |
| 3 | Importação de produto muito mais rica | Média-alta (scraping específico por site) |
| 4 | Memória de longo prazo, follow-up, analytics | Alta (mais módulos, mais integração) |

## Estrutura de pastas final (todas as fases)

```
src/
  agents/
    classification/
      classify.js
      profile.js
  conversation/
    state.js
  decision/
    buyScore.js
    engine.js
    objections.js
    followup.js
    strategies/
      objection_price.js
      objection_trust.js
      objection_shipping.js
      ...
  knowledge/
    platformDetector.js
    documents.js
    autoLearning.js
    extractors/
      mercadolivre.js
      hotmart.js
      kiwify.js
      ...
  memory/
    engine.js
  prompt/
    builder.js
  response/
    validator.js
  checkout/
    generate.js
  analytics/
    dashboard.js
  crm/
    leads.js
  utils/
    decisionLog.js
```

---

## Minha recomendação de ordem

Fase 1 é a que muda tudo — depois dela, o resto é incremento sobre uma base
sólida. Não faz sentido pular pra Fase 3 (multi-plataforma) sem antes ter o
Decision Engine funcionando, porque hoje o conhecimento do produto já
funciona bem o suficiente pra validar o núcleo.

Sugiro: aprovar esse desenho, começar a Fase 1 completa, testar com
conversas reais por alguns dias, e só então avançar pra Fase 2.
