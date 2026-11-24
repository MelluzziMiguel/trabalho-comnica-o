require("dotenv").config();
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../src/app");
const { inicializarBanco, pool } = require("../src/store/database");

let server;
let baseUrl;
const token = process.env.WEBHOOK_TOKEN || "demo-token";

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    return { status: response.status, body: await response.json() };
}

before(async () => {
    await inicializarBanco();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
});

test("cria e consulta um pagamento persistido", async () => {
    const created = await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: `Teste ${Date.now()}`, valor: 25.5 })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.pagamento.status, "pending");
    const found = await request(`/pagamentos/${created.body.pagamento.id}`);
    assert.equal(found.status, 200);
    assert.equal(found.body.id, created.body.pagamento.id);
});

test("pagamentos permanecem disponíveis após reinicializar o esquema", async () => {
    const created = await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: `Persistência ${Date.now()}`, valor: 18 })
    });
    await inicializarBanco();
    const found = await request(`/pagamentos/${created.body.pagamento.id}`);
    assert.equal(found.status, 200);
    assert.equal(found.body.status, "pending");
});

test("atualiza status pelo webhook e lista por status", async () => {
    const created = await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: `Webhook ${Date.now()}`, valor: 10 })
    });
    const payment = created.body.pagamento;
    const updated = await request("/webhook/pagamento", {
        method: "POST", headers: { "content-type": "application/json", "x-webhook-token": token },
        body: JSON.stringify({ pagamentoId: payment.id, status: "approved", eventoId: `evt-${Date.now()}` })
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.pagamento.status, "approved");
    const list = await request("/pagamentos?status=approved");
    assert.ok(list.body.pagamentos.some(item => item.id === payment.id));
});

test("a interface pode simular aprovação sem expor token no navegador", async () => {
    const created = await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: `Simulação ${Date.now()}`, valor: 14 })
    });
    const simulated = await request(`/simulacao/pagamentos/${created.body.pagamento.id}/aprovar`, { method: "POST" });
    assert.equal(simulated.status, 200);
    assert.equal(simulated.body.pagamento.status, "approved");
});

test("evento duplicado não é processado novamente", async () => {
    const created = await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: `Duplicado ${Date.now()}`, valor: 12 })
    });
    const payload = { pagamentoId: created.body.pagamento.id, status: "rejected", eventoId: `dup-${Date.now()}` };
    const options = { method: "POST", headers: { "content-type": "application/json", "x-webhook-token": token }, body: JSON.stringify(payload) };
    assert.equal((await request("/webhook/pagamento", options)).status, 200);
    const duplicate = await request("/webhook/pagamento", options);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicado, true);
});

test("evento repetido para outro pagamento retorna conflito", async () => {
    const create = async () => request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: `Colisão ${Date.now()}-${Math.random()}`, valor: 12 })
    });
    const [first, second] = await Promise.all([create(), create()]);
    const eventId = `colisao-${Date.now()}`;
    const send = (paymentId) => request("/webhook/pagamento", {
        method: "POST", headers: { "content-type": "application/json", "x-webhook-token": token },
        body: JSON.stringify({ pagamentoId: paymentId, status: "approved", eventoId: eventId })
    });
    assert.equal((await send(first.body.pagamento.id)).status, 200);
    assert.equal((await send(second.body.pagamento.id)).status, 409);
});

test("recusa dados inválidos e tokens incorretos", async () => {
    assert.equal((await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cliente: "", valor: -1 })
    })).status, 400);
    assert.equal((await request("/webhook/pagamento", {
        method: "POST", headers: { "content-type": "application/json", "x-webhook-token": "incorreto" },
        body: JSON.stringify({ pagamentoId: "x", status: "approved", eventoId: "x" })
    })).status, 401);
    assert.equal((await request("/pagamentos?status=desconhecido")).status, 400);
    assert.equal((await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente: "Precisão", valor: 10.123 })
    })).status, 400);
    assert.equal((await request("/pagamentos", {
        method: "POST", headers: { "content-type": "application/json" }, body: "{json invalido"
    })).status, 400);
});
