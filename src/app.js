const express = require('express');
const path = require('node:path');
require("dotenv").config();

const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const simulationRoutes = require("./routes/simulationRoutes");
const app = express();

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
    // res.json({
    //     servico: 'webhook de pagamentos',
    //     status: 'online'
    // })
});

app.use("/pagamentos", paymentRoutes);
app.use("/webhook", webhookRoutes);
app.use("/simulacao", simulationRoutes);

app.use((error, req, res, next) => {
    console.error("Erro na aplicação:", error.message);
    if (error.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
    if (error.type === "entity.too.large") return res.status(413).json({ erro: "Corpo da requisição muito grande." });
    res.status(500).json({ erro: "Erro interno. Verifique a conexão com o banco de dados." });
});

module.exports = app;
