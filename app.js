const express = require('express');
const cors = require('cors');
const path = require('path');

const produtos = require('./routes/produtos');
const movimentacoes = require('./routes/movimentacoes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../saep_front')));

app.get('/api', (req, res) => res.send('Sua API esta funcionando.'));
app.use('/produtos', produtos);
app.use('/movimentacoes', movimentacoes);

module.exports = app;
