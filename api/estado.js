/*
 * GET /api/estado                      -> teste de vida (o app usa pra saber se ha backend)
 * GET /api/estado?codigo=X&versao=N    -> so devolve o campeonato se mudou desde a versao N
 *                                         (precisa do token da senha no cabecalho X-Token)
 *
 * A checagem de versao vem numa consulta minuscula de proposito: os celulares ficam
 * perguntando de poucos em poucos segundos e so baixam o campeonato inteiro quando mudou.
 */
const { sql, responder, rota, salaAutorizada } = require('../lib/db.js');

module.exports = rota(async function (req, res) {
  const codigo = String((req.query && req.query.codigo) || '').trim().toUpperCase();
  if (!codigo) return responder(res, 200, { ok: true, backend: true });

  const versaoCliente = Number((req.query && req.query.versao) || 0);
  const atual = await salaAutorizada(req, res, codigo);
  if (!atual) return;

  const versao = Number(atual.versao);
  if (versaoCliente === versao) return responder(res, 200, { mudou: false, versao: versao });

  const linha = await sql()`SELECT versao, dados FROM clt_campeonatos WHERE codigo = ${codigo}`;
  return responder(res, 200, {
    mudou: true,
    versao: Number(linha[0].versao),
    camp: linha[0].dados
  });
});
