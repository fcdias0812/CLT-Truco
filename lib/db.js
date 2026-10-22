/* CLT — acesso ao Postgres (Neon) e utilidades das funcoes serverless */
const { neon } = require('@neondatabase/serverless');
const senha = require('./senha.js');

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
  await sql()`ALTER TABLE clt_campeonatos ADD COLUMN IF NOT EXISTS senha_hash text`;
  /* salas criadas antes de existir senha ficam com a senha padrao (1234) */
  const semSenha = await sql()`SELECT codigo FROM clt_campeonatos WHERE senha_hash IS NULL`;
  for (const linha of semSenha) {
    await sql()`
      UPDATE clt_campeonatos SET senha_hash = ${senha.hashSenha(senha.SENHA_PADRAO)}
       WHERE codigo = ${linha.codigo} AND senha_hash IS NULL`;
  }
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token');
  res.setHeader('Access-Control-Max-Age', '7200');
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

/* token que o aparelho recebeu ao acertar a senha da sala */
function lerToken(req) {
  return String((req.headers && req.headers['x-token']) || '');
}

/* le a sala e confere o token; responde 404/401 sozinho e devolve null se nao pode */
async function salaAutorizada(req, res, codigo) {
  const linha = await sql()`SELECT versao, senha_hash FROM clt_campeonatos WHERE codigo = ${codigo}`;
  if (!linha.length) { responder(res, 404, { erro: 'sala nao encontrada' }); return null; }
  if (!senha.confereToken(lerToken(req), codigo, linha[0].senha_hash)) {
    responder(res, 401, { erro: 'precisa da senha da sala' });
    return null;
  }
  return linha[0];
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

module.exports = { sql, garantirTabela, novoCodigo, responder, corpoJson, rota, salaAutorizada };
