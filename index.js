require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Rotas
app.use(require('./routes/webhookWhatsapp'));
app.use(require('./routes/produtos'));

app.get('/', (req, res) => {
    res.json({ status: 'ok', servico: 'whatsapp-ia-vendas' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
