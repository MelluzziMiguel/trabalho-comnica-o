require('dotenv').config();

const app = require("./src/app");
const { inicializarBanco, pool } = require("./src/store/database");

const port = Number(process.env.PORT) || 5000;
inicializarBanco().then(() => {
    app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
}).catch(async (error) => {
    console.error("Não foi possível conectar/preparar o MySQL:", error.message);
    await pool.end();
    process.exitCode = 1;
});
