const express = require('express');
const cors = require('cors');

const produtos = require('./routes/produtos');
const movimentacoes = require('./routes/movimentacoes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Sua API está funcionando e segura!');
});

app.use('/produtos', produtos);
app.use('/movimentacoes', movimentacoes);


module.exports = app;