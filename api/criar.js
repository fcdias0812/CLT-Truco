/* POST /api/criar — cria uma sala (campeonato) e devolve o codigo de entrada */
const { sql, novoCodigo, responder, corpoJson, rota } = require('../lib/db.js');
const nucleo = require('../js/nucleo.js');

module.exports = rota(async function (req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'use POST' });

  const corpo = corpoJson(req);
  const nomes = (corpo.nomes || []).map(function (n) { return String(n).trim(); })
    .filter(Boolean).slice(0, 24);
  const tamanhoTime = Number(corpo.tamanhoTime) === 3 ? 3 : 2;

  if (nomes.length < tamanhoTime * 2) {
    return responder(res, 400, { erro: 'jogadores insuficientes para o formato escolhido' });
  }

  const camp = nucleo.criarCampeonato({
    nome: String(corpo.nome || 'Champions League de Truco').slice(0, 80),
    nomes: nomes,
    tamanhoTime: tamanhoTime,
    totalJogos: Math.min(200, Math.max(1, Number(corpo.totalJogos) || 30)),
    valorAposta: Math.max(0, Number(corpo.valorAposta) || 0),
    config: corpo.config || {}
  });

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = novoCodigo(6);
    const existe = await sql()`SELECT 1 FROM clt_campeonatos WHERE codigo = ${codigo}`;
    if (existe.length) continue;
    camp.codigo = codigo;
    await sql()`
      INSERT INTO clt_campeonatos (codigo, dados, versao)
      VALUES (${codigo}, ${JSON.stringify(camp)}::jsonb, 1)`;
    return responder(res, 200, { codigo: codigo, versao: 1, camp: camp });
  }

  return responder(res, 503, { erro: 'nao consegui gerar um codigo livre, tente de novo' });
});
