/*
 * POST /api/trocar-senha — define uma senha nova pra sala (precisa estar dentro dela).
 * Os outros aparelhos perdem o acesso na hora e pedem a senha nova na proxima consulta.
 */
const { sql, responder, corpoJson, rota, salaAutorizada } = require('../lib/db.js');
const senha = require('../lib/senha.js');

module.exports = rota(async function (req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'use POST' });

  const corpo = corpoJson(req);
  const codigo = String(corpo.codigo || '').trim().toUpperCase();
  if (!codigo) return responder(res, 400, { erro: 'informe o codigo atual' });
  if (!senha.senhaValida(corpo.senha)) return responder(res, 400, { erro: 'a senha nova nao pode ficar vazia' });

  if (!(await salaAutorizada(req, res, codigo))) return;

  const hash = senha.hashSenha(corpo.senha);
  await sql()`UPDATE clt_campeonatos SET senha_hash = ${hash} WHERE codigo = ${codigo}`;
  return responder(res, 200, { token: senha.tokenDaSala(codigo, hash) });
});
