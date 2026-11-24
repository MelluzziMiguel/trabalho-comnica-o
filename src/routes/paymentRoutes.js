const express = require("express");

const { criarPagamento, buscarPagamento, listarPagamentos } = require("../store/paymentStore");

const router = express.Router();

router.post("/", async (req, res, next) => {
    const {cliente, valor} = req.body ?? {};
    if(typeof cliente !== "string" || !cliente.trim() ||
        cliente.trim().length > 255 || typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > 99999999.99 || Math.round(valor * 100) !== valor * 100){
        return res.status(400).json({
            erro: "informe o cliente e valor maior que zero."
        });
    }

    try {
        const pagamento = await criarPagamento(cliente.trim(), valor);
        return res.status(201).json({
            mensagem: "Pagamento criado",
            pagamento
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/", async (req, res, next) => {
    const status = req.query.status;
    const statusValidos = ["pending", "approved", "rejected", "cancelled"];
    if (status !== undefined && (typeof status !== "string" || !statusValidos.includes(status))) {
        return res.status(400).json({ erro: "status inválido." });
    }
    try {
        return res.json({ pagamentos: await listarPagamentos(status) });
    } catch (error) { return next(error); }
});

router.get("/:id", async (req, res, next) => {
    try {
        const pagamento = await buscarPagamento(req.params.id);
        if(!pagamento){
            return res.status(404).json({ erro: "Pagamento não encontrado" });
        }
        return res.json(pagamento);
    } catch (error) { return next(error); }
});


module.exports = router;
