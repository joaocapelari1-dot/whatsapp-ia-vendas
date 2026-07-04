require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Rotas
app.use(require('./routes/webhookWhatsapp'));
app.use(require('./routes/produtos'));
app.use(require('./routes/market'));

// Market Brain: análise diária automática (desativa com MARKET_ENABLED=false)
if (process.env.MARKET_ENABLED !== 'false') {
  const { iniciarScheduler } = require('./src/market/scheduler');
  iniciarScheduler();
}

app.get('/', (req, res) => {
    res.json({ status: 'ok', servico: 'whatsapp-ia-vendas' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
