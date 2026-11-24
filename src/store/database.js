const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3308),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "root",
    database: process.env.MYSQL_DATABASE || "webhook",
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true
});

async function executar(sql, valores) {
    return pool.execute(sql, valores);
}

async function inicializarBanco() {
    await pool.execute(`CREATE TABLE IF NOT EXISTS pagamentos (
        id CHAR(36) PRIMARY KEY,
        cliente VARCHAR(255) NOT NULL,
        valor DECIMAL(10, 2) NOT NULL,
        status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
        criado_em DATETIME(3) NOT NULL,
        atualizado_em DATETIME(3) NULL,
        INDEX idx_pagamentos_status (status),
        INDEX idx_pagamentos_criado_em (criado_em)
    ) ENGINE=InnoDB`);
    // Migração leve para instalações que já tinham a tabela pagamentos anterior.
    const [colunas] = await pool.execute("SHOW COLUMNS FROM pagamentos");
    if (!colunas.some(coluna => coluna.Field === "atualizado_em")) {
        await pool.execute("ALTER TABLE pagamentos ADD COLUMN atualizado_em DATETIME(3) NULL");
    }
    if (!colunas.some(coluna => coluna.Field === "status" && coluna.Type.toLowerCase().includes("enum"))) {
        await pool.execute("ALTER TABLE pagamentos MODIFY status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending'");
    }
    await pool.execute(`CREATE TABLE IF NOT EXISTS eventos_webhook (
        evento_id VARCHAR(255) PRIMARY KEY,
        pagamento_id CHAR(36) NOT NULL,
        status VARCHAR(20) NOT NULL,
        recebido_em DATETIME(3) NOT NULL,
        CONSTRAINT fk_eventos_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id),
        INDEX idx_eventos_pagamento (pagamento_id)
    ) ENGINE=InnoDB`);
    const [indices] = await pool.execute("SHOW INDEX FROM pagamentos");
    if (!indices.some(indice => indice.Key_name === "idx_pagamentos_status")) {
        await pool.execute("CREATE INDEX idx_pagamentos_status ON pagamentos(status)");
    }
    if (!indices.some(indice => indice.Key_name === "idx_pagamentos_criado_em")) {
        await pool.execute("CREATE INDEX idx_pagamentos_criado_em ON pagamentos(criado_em)");
    }
}

module.exports = { executar, inicializarBanco, pool };
