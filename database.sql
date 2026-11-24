CREATE TABLE pagamentos (
    id CHAR(36) PRIMARY KEY,
    cliente VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    criado_em DATETIME(3) NOT NULL,
    atualizado_em DATETIME(3) NULL,
    INDEX idx_pagamentos_status (status),
    INDEX idx_pagamentos_criado_em (criado_em)
) ENGINE=InnoDB;

CREATE TABLE eventos_webhook (
    evento_id VARCHAR(255) PRIMARY KEY,
    pagamento_id CHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL,
    recebido_em DATETIME(3) NOT NULL,
    CONSTRAINT fk_eventos_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id),
    INDEX idx_eventos_pagamento (pagamento_id)
) ENGINE=InnoDB;
