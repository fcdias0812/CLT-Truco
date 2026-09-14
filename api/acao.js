/*
 * POST /api/acao — aplica UMA acao no campeonato.
 * O servidor e quem manda: le a versao atual, aplica a regra (mesmo codigo do navegador)
 * e so grava se ninguem tiver escrito no meio do caminho. Assim dois celulares clicando
 * ao mesmo tempo nao se atropelam.
 */
const { sql, responder, corpoJson, rota } = require('../lib/db.js');
const nucleo = require('../js/nucleo.js');

module.exports = rota(async function (req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'use POST' });

  const corpo = corpoJson(req);
  const codigo = String(corpo.codigo || '').trim().toUpperCase();
  const acao = corpo.acao;
  if (!codigo || !acao || !acao.tipo) {
    return responder(res, 400, { erro: 'informe codigo e acao' });
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const linha = await sql()`SELECT versao, dados FROM clt_campeonatos WHERE codigo = ${codigo}`;
    if (!linha.length) return responder(res, 404, { erro: 'sala nao encontrada' });

    const versao = Number(linha[0].versao);
    const camp = linha[0].dados;
    camp.codigo = codigo;

    const r = nucleo.aplicar(camp, acao);
    if (!r.ok) {
      return responder(res, 409, { erro: r.erro, versao: versao, camp: camp });
    }

    const gravado = await sql()`
      UPDATE clt_campeonatos
         SET dados = ${JSON.stringify(camp)}::jsonb,
             versao = versao + 1,
             atualizado_em = now()
       WHERE codigo = ${codigo} AND versao = ${versao}
      RETURNING versao`;

    if (gravado.length) {
      return responder(res, 200, { versao: Number(gravado[0].versao), camp: camp });
    }
    /* alguem gravou primeiro: le de novo e reaplica em cima do estado novo */
  }

  return responder(res, 503, { erro: 'muita gente mexendo ao mesmo tempo, tente de novo' });
});
