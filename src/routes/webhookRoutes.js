const express = require("express");

const {
    processarEvento,
    buscarPagamento
} = require("../store/paymentStore");

const router = express.Router();
const statusValidos = ["pending", "approved", "rejected", "cancelled"];

router.post("/pagamento", async (req, res, next) => {
    const tokenRecebido = req.get("x-webhook-token");
    if(!process.env.WEBHOOK_TOKEN || tokenRecebido !== process.env.WEBHOOK_TOKEN){
        return res.status(401).json({erro: "Token do webhook invalido"})
    }


    const { pagamentoId, status, eventoId } = req.body ?? {};

    if (typeof pagamentoId !== "string" || !pagamentoId.trim() ||
        typeof status !== "string" || !statusValidos.includes(status) ||
        typeof eventoId !== "string" || !eventoId.trim() || eventoId.trim().length > 255 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pagamentoId)) {
        return res.status(400).json({
            erro: "informe pagamentoId, um status válido e eventoId."
        });
    }

    try {
        const resultado = await processarEvento(pagamentoId, status, eventoId);
        if (resultado.tipo === "nao_encontrado") return res.status(404).json({ erro: "Pagamento não encontrado" });
        if (resultado.tipo === "duplicado") {
            if (resultado.pagamentoId !== pagamentoId) {
                return res.status(409).json({ erro: "eventoId já foi usado em outro pagamento." });
            }
            return res.status(200).json({ mensagem: "Evento já processado", duplicado: true, pagamento: await buscarPagamento(pagamentoId) });
        }
        return res.status(200).json({ mensagem: "Webhook processado", pagamento: resultado.pagamento });
    } catch (error) { return next(error); }
})

module.exports = router;
