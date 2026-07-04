# Market Brain v1 — Design Enxuto

## Objetivo da v1

Descobrir produtos de afiliado promissores (Hotmart, Kiwify) antes da
concorrência, pontuá-los com um Opportunity Score, e entregar um relatório
diário via Telegram com os melhores achados — prontos pra importar no Sales
Brain com um comando.

O que fica de fora da v1 (e por quê):
- Crawling de Mercado Livre/Amazon/Shopee/Temu → guerra anti-bot, custo alto,
  manutenção eterna. Só entra se a v1 provar valor.
- Social listening TikTok/Instagram/YouTube → APIs fechadas, scraping viola
  ToS e quebra toda semana.
- Profit Engine com CPA/conversão estimada → dados não existem publicamente;
  chute com cara de precisão é pior que não ter.
- Demand Forecast 7/30/90 dias → precisa de histórico próprio que ainda não
  existe. Entra na v2 depois de meses coletando.

---

## Arquitetura v1

```
Scheduler (cron diário, ex: 6h da manhã)
    ↓
Coletores
  ├── Hotmart (marketplace de afiliação — temperatura, comissão, categoria)
  ├── Kiwify (produtos em destaque, comissão)
  └── Google Trends (interesse de busca das categorias/termos)
    ↓
Normalizador (unifica formato dos produtos das 2 fontes)
    ↓
Opportunity Score Engine (0-100, pesos configuráveis)
    ↓
Persistência (Supabase — histórico diário de cada produto)
    ↓
Detector de movimento (o que subiu/caiu vs. ontem)
    ↓
AI Market Analyst (Claude gera o relatório executivo)
    ↓
Telegram (relatório diário — mesmo padrão do LeilaoWDO)
    ↓
[comando /importar CODIGO] → chama POST /produtos/importar do Sales Brain
```

Roda no mesmo Railway, como um serviço separado ou como módulo do backend
existente com cron interno (mais simples pra v1: módulo no mesmo backend).

---

## Estrutura de pastas

```
src/market/
  scheduler.js          — cron diário
  collectors/
    hotmart.js          — coleta do marketplace de afiliação
    kiwify.js           — coleta de produtos/comissões
    trends.js           — Google Trends via google-trends-api (npm)
  normalize.js          — formato único de produto
  opportunityScore.js   — cálculo do score (função pura, testável)
  movement.js           — comparação com snapshot anterior
  analyst.js            — Claude gera relatório executivo
  telegram.js           — envio do relatório + comando /importar
```

---

## Fontes de dados — como coletar sem dor

**Hotmart:** o marketplace de afiliação é navegável logado como afiliado.
Existem endpoints internos usados pela própria página (JSON) que retornam
produtos com temperatura, comissão, blueprint. Estratégia v1: Puppeteer
logado com sua conta de afiliado, extraindo o JSON das requisições da
página de marketplace — mais estável que scraping de HTML.

**Kiwify:** mesma lógica — área de afiliado logada, extração via Puppeteer.

**Google Trends:** biblioteca `google-trends-api` (npm, sem chave) para
interesse relativo de busca dos termos/categorias dos produtos achados.
Instável às vezes (Google muda), mas gratuita e suficiente pra v1.

Nota honesta: as duas primeiras dependem da estrutura das páginas logadas —
se a plataforma redesenhar, o coletor precisa de ajuste. É manutenção
esperada, mas MUITO menor que crawlear marketplaces abertos com anti-bot.

---

## Opportunity Score v1 (0-100)

Pesos iniciais (calibráveis depois, mesmo padrão dos 30 pregões do WDO):

| Fator | Peso | Fonte |
|---|---|---|
| Comissão (% e valor absoluto) | 25% | Hotmart/Kiwify |
| Temperatura/demanda na plataforma | 25% | Hotmart (temperatura), Kiwify (destaque) |
| Tendência de busca (crescimento 30d) | 20% | Google Trends |
| Concorrência estimada (nº de afiliados promovendo, quando visível) | 15% | Hotmart |
| Qualidade da página de vendas (Landing Score simplificado) | 15% | Puppeteer + Claude avalia a página |

Cada fator normalizado 0-100, score final = média ponderada.
Confidence Score separado: quantos fatores tinham dado real vs. estimado.

---

## Schema (Supabase)

```sql
create table market_products (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null,          -- hotmart | kiwify
  external_id text,                  -- id do produto na plataforma
  nome text,
  categoria text,
  preco numeric,
  comissao_pct numeric,
  comissao_valor numeric,
  temperatura numeric,               -- métrica da plataforma, se houver
  url text,
  primeiro_visto timestamptz default now(),
  ultimo_visto timestamptz default now(),
  importado boolean default false,   -- já virou produto no Sales Brain?
  unique(plataforma, external_id)
);

create table market_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references market_products(id),
  data date not null,
  opportunity_score numeric,
  confidence_score numeric,
  trend_score numeric,
  commission_score numeric,
  competition_score numeric,
  landing_score numeric,
  raw jsonb,                         -- dados brutos do dia, pra auditoria
  unique(product_id, data)
);
```

O histórico diário em `market_snapshots` é o que permite, na v2, detectar
aceleração ("subiu 15 pontos em 3 dias") e eventualmente treinar forecast.

---

## Relatório diário (AI Market Analyst)

Claude recebe: top 10 por score, maiores movimentos vs. ontem, produtos
novos nunca vistos. Gera texto executivo curto pro Telegram:

> 📊 Market Brain — 04/07
> Analisados: 214 produtos (Hotmart 163, Kiwify 51)
>
> 🔥 Top oportunidade: "Protocolo Sono Profundo" — Score 91 (comissão 60%,
> R$97, tendência de busca +40% em 30d, poucos afiliados)
>
> 📈 Em aceleração: "Curso Confeitaria Lucrativa" subiu de 62→78 em 2 dias
>
> 🆕 Novos: 7 produtos entraram no radar hoje
>
> Para importar: /importar HOT12345

Comando `/importar CODIGO` no Telegram chama o endpoint do Sales Brain que
já existe (`POST /produtos/importar`), fechando o ciclo Market → Sales.

---

## O que a v1 entrega, em resumo

1. Radar diário automático de Hotmart + Kiwify sem você abrir as plataformas
2. Score objetivo pra comparar produtos entre si (em vez de "achismo")
3. Detecção de movimento — produto esquentando aparece antes de saturar
4. Um comando no Telegram pra transformar achado em produto vendendo
5. Histórico acumulando desde o dia 1 (combustível pra v2: forecast,
   auto-import, sazonalidade)

## Critério de sucesso da v1

Depois de ~30 dias rodando: os produtos com score >80 que você importou
converteram melhor que os que você escolheria no olho? Se sim, v2. Se não,
recalibrar pesos antes de expandir.

## Esforço estimado

- Coletores Hotmart/Kiwify: a parte mais trabalhosa (login + extração)
- Trends + Score + Telegram: rápido, padrões que você já tem no WDO
- Total: comparável à Fase 1 do Sales Brain

## Pré-requisito antes de codar

Sales Brain rodando em produção com pelo menos um produto real. O Market
Brain abastece o Sales Brain — sem o destino funcionando, o radar não tem
pra onde mandar os achados.
