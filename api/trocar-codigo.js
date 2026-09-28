/*
 * POST /api/trocar-codigo — gera um codigo novo pra mesma sala e desativa o antigo.
 * Util se o link/codigo vazou: em vez de abandonar o campeonato inteiro, so troca a chave.
 */
const { sql, novoCodigo, responder, corpoJson, rota } = require('../lib/db.js');

module.exports = rota(async function (req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'use POST' });

  const corpo = corpoJson(req);
  const atual = String(corpo.codigo || '').trim().toUpperCase();
  if (!atual) return responder(res, 400, { erro: 'informe o codigo atual' });

  const existe = await sql()`SELECT 1 FROM clt_campeonatos WHERE codigo = ${atual}`;
  if (!existe.length) return responder(res, 404, { erro: 'sala nao encontrada' });

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const novo = novoCodigo(6);
    const linha = await sql()`
      UPDATE clt_campeonatos
         SET codigo = ${novo},
             dados = jsonb_set(dados, '{codigo}', to_jsonb(${novo}::text)),
             atualizado_em = now()
       WHERE codigo = ${atual}
      RETURNING codigo, versao, dados`;

    if (linha.length) {
      return responder(res, 200, { codigo: linha[0].codigo, versao: Number(linha[0].versao), camp: linha[0].dados });
    }
    /* colidiu com um codigo ja existente (raro) ou a sala sumiu no meio do caminho — tenta de novo */
    const aindaExiste = await sql()`SELECT 1 FROM clt_campeonatos WHERE codigo = ${atual}`;
    if (!aindaExiste.length) return responder(res, 404, { erro: 'sala nao encontrada' });
  }

  return responder(res, 503, { erro: 'nao consegui gerar um codigo livre, tente de novo' });
});
