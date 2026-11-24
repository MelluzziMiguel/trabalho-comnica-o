# Cobranças demonstrativas com webhook

Aplicação didática em Node.js, Express e MySQL para criar cobranças fictícias, consultar pagamentos e simular atualizações recebidas por webhook. Não processa pagamentos reais e o QR Code é apenas ilustrativo, sem possibilidade de pagamento.

## Requisitos

- Node.js 18 ou superior (usa `fetch` e o executor de testes nativo).
- MySQL 8 ou compatível, acessível localmente na porta `3308`.

## Instalação e execução

1. Crie o banco de dados: `CREATE DATABASE webhook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. Copie `.env.example` para `.env` e ajuste as credenciais. A configuração preparada usa host `localhost`, porta `3308`, usuário `root` e senha `root`.
3. Instale as dependências: `npm install`.
4. Inicie a aplicação: `npm start` (ou `npm run dev` durante o desenvolvimento).
5. Acesse http://localhost:3000.

As tabelas `pagamentos` e `eventos_webhook` são criadas automaticamente na inicialização. Se você já possuía a versão inicial da tabela `pagamentos`, a inicialização adiciona a coluna de atualização, ajusta o domínio do status e cria os índices que faltam. O script `database.sql` contém o esquema para criação manual. O MySQL é a fonte de verdade: pagamentos e eventos continuam disponíveis depois que o servidor reinicia.

## Variáveis de ambiente

| Variável | Uso | Padrão |
| --- | --- | --- |
| `PORT` | Porta HTTP | `3000` |
| `MYSQL_HOST` | Endereço do MySQL | `localhost` |
| `MYSQL_PORT` | Porta do MySQL | `3308` |
| `MYSQL_USER` | Usuário | `root` |
| `MYSQL_PASSWORD` | Senha | `root` |
| `MYSQL_DATABASE` | Banco de dados | `webhook` |
| `WEBHOOK_TOKEN` | Token exigido no cabeçalho do webhook | `demo-token` |

Altere o token padrão em ambientes compartilhados. Ele é usado pela interface para a simulação demonstrativa.

## API

Todas as respostas e requisições usam JSON.

### Criar pagamento

`POST /pagamentos`

```json
{
  "cliente": "Ana Silva",
  "valor": 50.00
}
```

Exemplo:

```bash
curl -X POST http://localhost:3000/pagamentos -H "Content-Type: application/json" -d '{"cliente":"Ana Silva","valor":50.00}'
```

Retorna `201` e o pagamento criado com identificador UUID e estado inicial `pending`. Cliente é obrigatório (até 255 caracteres); valor deve ser numérico e maior que zero.

### Listar pagamentos

`GET /pagamentos` lista os pagamentos mais recentes primeiro. Para filtrar: `GET /pagamentos?status=pending`. Status aceitos: `pending`, `approved`, `rejected` e `cancelled`.

```bash
curl "http://localhost:3000/pagamentos?status=pending"
```

### Consultar pagamento

`GET /pagamentos/:id`

```bash
curl http://localhost:3000/pagamentos/UUID_DO_PAGAMENTO
```

### Atualizar por webhook

`POST /webhook/pagamento` exige o cabeçalho `x-webhook-token` igual a `WEBHOOK_TOKEN`. O identificador do evento é único e eventos repetidos retornam `duplicado: true`, sem reaplicar a alteração.

```bash
curl -X POST http://localhost:3000/webhook/pagamento \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: demo-token" \
  -d '{"pagamentoId":"UUID_DO_PAGAMENTO","status":"approved","eventoId":"evt-001"}'
```

Status aceitos no webhook: `pending`, `approved`, `rejected` e `cancelled`. A interface tem uma rota didática de simulação (`POST /simulacao/pagamentos/:id/aprovar`), que atualiza e registra o evento de demonstração no banco; integrações externas devem usar o webhook autenticado.

## Códigos HTTP

- `200`: consulta ou webhook processado (também o mesmo evento repetido para o mesmo pagamento).
- `201`: pagamento criado.
- `400`: dados ou filtro inválidos.
- `413`: corpo da requisição excede o limite de 32 KB.
- `401`: token do webhook inválido ou ausente.
- `404`: pagamento não encontrado.
- `409`: identificador de evento já associado a outro pagamento.
- `500`: falha interna, como indisponibilidade do banco.

## Testes

Configure o MySQL e as variáveis do `.env`, depois execute `npm test`. Os testes usam o banco configurado, criam registros de exemplo e cobrem criação, consulta, persistência após inicialização, atualização de status, evento duplicado, colisão de evento entre pagamentos e dados/token inválidos.
