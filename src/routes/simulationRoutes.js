const express = require("express");
const crypto = require("node:crypto");
const { processarEvento } = require("../store/paymentStore");

const router = express.Router();

// Rota didática para a interface; não substitui o webhook autenticado.
router.post("/pagamentos/:id/aprovar", async (req, res, next) => {
    try {
        const resultado = await processarEvento(req.params.id, "approved", `sim-${crypto.randomUUID()}`);
        if (resultado.tipo === "nao_encontrado") return res.status(404).json({ erro: "Pagamento não encontrado" });
        return res.status(200).json({ mensagem: "Pagamento aprovado na simulação", pagamento: resultado.pagamento });
    } catch (error) { return next(error); }
});

module.exports = router;
