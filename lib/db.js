/* CLT — acesso ao Postgres (Neon) e utilidades das funcoes serverless */
const { neon } = require('@neondatabase/serverless');

let sqlRef = null;
let tabelaPronta = false;

function sql() {
  if (!sqlRef) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL nao configurada no projeto da Vercel');
    }
    sqlRef = neon(process.env.DATABASE_URL);
  }
  return sqlRef;
}

async function garantirTabela() {
  if (tabelaPronta) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS clt_campeonatos (
      codigo        text PRIMARY KEY,
      dados         jsonb NOT NULL,
      versao        integer NOT NULL DEFAULT 1,
      criado_em     timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )`;
  tabelaPronta = true;
}

/* sem I, O, 0 e 1 pra ninguem errar ao digitar o codigo da sala */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function novoCodigo(tamanho) {
  let s = '';
  for (let i = 0; i < (tamanho || 6); i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return s;
}

function cabecalhos(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function responder(res, status, corpo) {
  cabecalhos(res);
  res.status(status).json(corpo);
}

function corpoJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch (e) { return {}; }
  }
  return b;
}

/* embrulha o handler: CORS, OPTIONS e erro virando JSON legivel */
function rota(handler) {
  return async function (req, res) {
    cabecalhos(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    try {
      await garantirTabela();
      await handler(req, res);
    } catch (erro) {
      console.error('[clt]', erro);
      responder(res, 500, { erro: String((erro && erro.message) || erro) });
    }
  };
}

module.exports = { sql, garantirTabela, novoCodigo, responder, corpoJson, rota };
