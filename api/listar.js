/*
 * GET /api/listar — todos os campeonatos compartilhados, pra aparecerem na tela inicial.
 * So vai o basico (nome, jogadores, andamento); o campeonato em si continua atras da senha.
 */
const { sql, responder, rota } = require('../lib/db.js');

module.exports = rota(async function (req, res) {
  const linhas = await sql()`
    SELECT codigo,
           dados->>'nome' AS nome,
           COALESCE(jsonb_array_length(dados->'jogadores'), 0) AS jogadores,
           COALESCE(jsonb_array_length(dados->'jogos'), 0) AS total,
           (SELECT count(*) FROM jsonb_array_elements(COALESCE(dados->'jogos', '[]'::jsonb)) j
             WHERE j->>'status' = 'concluido') AS feitos,
           COALESCE((dados->>'encerrado')::boolean, false) AS encerrado,
           atualizado_em
      FROM clt_campeonatos
     ORDER BY atualizado_em DESC
     LIMIT 100`;
  return responder(res, 200, {
    salas: linhas.map(function (l) {
      return {
        codigo: l.codigo, nome: l.nome || 'Campeonato', jogadores: Number(l.jogadores),
        total: Number(l.total), feitos: Number(l.feitos), encerrado: !!l.encerrado,
        atualizadoEm: l.atualizado_em
      };
    })
  });
});
