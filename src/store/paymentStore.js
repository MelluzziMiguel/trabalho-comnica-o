const crypto = require("node:crypto");
const { executar } = require("./database");

function mapearPagamento(row) {
    if (!row) return null;
    return {
        id: row.id,
        cliente: row.cliente,
        valor: Number(row.valor),
        status: row.status,
        criadoEm: new Date(row.criado_em).toISOString(),
        ...(row.atualizado_em ? { atualizadoEm: new Date(row.atualizado_em).toISOString() } : {})
    };
}

async function criarPagamento(cliente, valor){
    const pagamento = {
        id: crypto.randomUUID(),
        cliente,
        valor,
        status: "pending",
        criadoEm: new Date().toISOString()
    }

    await executar(
        `INSERT INTO pagamentos (id, cliente, valor, status, criado_em)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [pagamento.id, pagamento.cliente, pagamento.valor, pagamento.status]
    );

    return pagamento;
}

async function buscarPagamento(id){
    const [rows] = await executar("SELECT * FROM pagamentos WHERE id = ?", [id]);
    return mapearPagamento(rows[0]);
}

async function listarPagamentos(status){
    const [rows] = status
        ? await executar("SELECT * FROM pagamentos WHERE status = ? ORDER BY criado_em DESC", [status])
        : await executar("SELECT * FROM pagamentos ORDER BY criado_em DESC");
    return rows.map(mapearPagamento);
}

async function processarEvento(id, status, eventoId){
    const { pool } = require("./database");
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [pagamentos] = await connection.execute("SELECT * FROM pagamentos WHERE id = ? FOR UPDATE", [id]);
        if (!pagamentos.length) {
            await connection.rollback();
            return { tipo: "nao_encontrado" };
        }
        try {
            await connection.execute(
                "INSERT INTO eventos_webhook (evento_id, pagamento_id, status, recebido_em) VALUES (?, ?, ?, UTC_TIMESTAMP(3))",
                [eventoId, id, status]
            );
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                await connection.rollback();
                const [eventos] = await connection.execute("SELECT pagamento_id FROM eventos_webhook WHERE evento_id = ?", [eventoId]);
                return { tipo: "duplicado", pagamentoId: eventos[0]?.pagamento_id };
            }
            throw error;
        }
        await connection.execute("UPDATE pagamentos SET status = ?, atualizado_em = UTC_TIMESTAMP(3) WHERE id = ?", [status, id]);
        const [atualizados] = await connection.execute("SELECT * FROM pagamentos WHERE id = ?", [id]);
        await connection.commit();
        return { tipo: "processado", pagamento: mapearPagamento(atualizados[0]) };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    criarPagamento,
    buscarPagamento,
    listarPagamentos,
    processarEvento
}   
