/*
 * POST /api/entrar — confere a senha da sala e devolve o campeonato + o token de acesso.
 * O token vai em todas as consultas seguintes (cabecalho X-Token).
 */
const { sql, responder, corpoJson, rota } = require('../lib/db.js');
const senha = require('../lib/senha.js');

module.exports = rota(async function (req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'use POST' });

  const corpo = corpoJson(req);
  const codigo = String(corpo.codigo || '').trim().toUpperCase();
  if (!codigo) return responder(res, 400, { erro: 'informe o campeonato' });

  const linha = await sql()`SELECT versao, dados, senha_hash FROM clt_campeonatos WHERE codigo = ${codigo}`;
  if (!linha.length) return responder(res, 404, { erro: 'sala nao encontrada' });
  if (!senha.confereSenha(String(corpo.senha || ''), linha[0].senha_hash)) {
    return responder(res, 401, { erro: 'senha errada' });
  }

  return responder(res, 200, {
    codigo: codigo,
    versao: Number(linha[0].versao),
    camp: linha[0].dados,
    token: senha.tokenDaSala(codigo, linha[0].senha_hash)
  });
});
