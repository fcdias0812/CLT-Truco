/* CLT — gerador de rodizio (quem joga com quem) */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else { raiz.CLT = raiz.CLT || {}; raiz.CLT.scheduler = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rng(semente) {
    var t = (semente || 1) >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function combinacoes(arr, k) {
    var out = [];
    (function rec(inicio, atual) {
      if (atual.length === k) { out.push(atual.slice()); return; }
      for (var i = inicio; i < arr.length; i++) {
        atual.push(arr[i]);
        rec(i + 1, atual);
        atual.pop();
      }
    })(0, []);
    return out;
  }

  function chave(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  function paresInternos(time) {
    var r = [];
    for (var i = 0; i < time.length; i++)
      for (var j = i + 1; j < time.length; j++) r.push(chave(time[i], time[j]));
    return r;
  }

  function paresCruzados(a, b) {
    var r = [];
    for (var i = 0; i < a.length; i++)
      for (var j = 0; j < b.length; j++) r.push(chave(a[i], b[j]));
    return r;
  }

  /* Todas as formacoes possiveis: dois times de `tamanho` + quem fica de fora. */
  function configuracoes(ids, tamanho) {
    var porJogo = tamanho * 2;
    var res = [];
    if (ids.length < porJogo) return res;
    combinacoes(ids, porJogo).forEach(function (grupo) {
      var fora = ids.filter(function (x) { return grupo.indexOf(x) === -1; });
      var resto = grupo.slice(1);
      combinacoes(resto, tamanho - 1).forEach(function (comp) {
        var a = [grupo[0]].concat(comp);
        var b = grupo.filter(function (x) { return a.indexOf(x) === -1; });
        res.push({ a: a, b: b, fora: fora });
      });
    });
    return res;
  }

  function mesmaFormacao(x, y) {
    var jx = x.a.concat(x.b).slice().sort().join(',');
    var jy = y.a.concat(y.b).slice().sort().join(',');
    if (jx !== jy) return false;
    var dx = [x.a.slice().sort().join(','), x.b.slice().sort().join(',')].sort().join('/');
    var dy = [y.a.slice().sort().join(','), y.b.slice().sort().join(',')].sort().join('/');
    return dx === dy;
  }

  /*
   * Monta a sequencia de jogos de forma equilibrada:
   *  - todo mundo joga a mesma quantidade de jogos (prioridade maxima)
   *  - todo mundo joga com todo mundo (duplas/trios variados)
   *  - os confrontos tambem se espalham
   *  - ninguem fica de fora duas vezes seguidas se der pra evitar
   */
  function gerarRodizio(ids, tamanho, totalJogos, semente) {
    var cfgs = configuracoes(ids, tamanho);
    if (!cfgs.length) return [];
    var sorte = rng(semente || 7);
    var nJogos = {}, folgaSeguida = {}, parceria = {}, confronto = {};
    ids.forEach(function (i) { nJogos[i] = 0; folgaSeguida[i] = 0; });
    ids.forEach(function (x) {
      ids.forEach(function (y) {
        if (x !== y) { parceria[chave(x, y)] = 0; confronto[chave(x, y)] = 0; }
      });
    });

    var jogos = [];
    for (var g = 0; g < totalJogos; g++) {
      var melhor = null, melhorCusto = Infinity;
      for (var c = 0; c < cfgs.length; c++) {
        var cfg = cfgs[c];
        var custo = 0;
        cfg.a.concat(cfg.b).forEach(function (p) {
          custo += 1000 * nJogos[p] - 200 * folgaSeguida[p];
        });
        cfg.fora.forEach(function (p) { custo += 300 * folgaSeguida[p]; });
        paresInternos(cfg.a).concat(paresInternos(cfg.b)).forEach(function (k) {
          custo += 120 * parceria[k];
        });
        paresCruzados(cfg.a, cfg.b).forEach(function (k) { custo += 30 * confronto[k]; });
        if (jogos.length && mesmaFormacao(jogos[jogos.length - 1], cfg)) custo += 600;
        custo += sorte() * 8;
        if (custo < melhorCusto) { melhorCusto = custo; melhor = cfg; }
      }

      melhor.a.concat(melhor.b).forEach(function (p) { nJogos[p]++; folgaSeguida[p] = 0; });
      melhor.fora.forEach(function (p) { folgaSeguida[p]++; });
      paresInternos(melhor.a).concat(paresInternos(melhor.b)).forEach(function (k) { parceria[k]++; });
      paresCruzados(melhor.a, melhor.b).forEach(function (k) { confronto[k]++; });
      jogos.push({ a: melhor.a.slice(), b: melhor.b.slice(), fora: melhor.fora.slice() });
    }
    return jogos;
  }

  /* Resumo do equilibrio, pra mostrar antes de comecar o campeonato. */
  function estatisticasRodizio(jogos, ids) {
    var porJogador = {}, duplas = {};
    ids.forEach(function (i) { porJogador[i] = { jogos: 0, folgas: 0, parceiros: {} }; });
    ids.forEach(function (x) {
      ids.forEach(function (y) { if (x < y) duplas[chave(x, y)] = 0; });
    });
    jogos.forEach(function (j) {
      j.a.concat(j.b).forEach(function (p) { porJogador[p].jogos++; });
      (j.fora || []).forEach(function (p) { porJogador[p].folgas++; });
      paresInternos(j.a).concat(paresInternos(j.b)).forEach(function (k) {
        duplas[k]++;
        var pp = k.split('|');
        porJogador[pp[0]].parceiros[pp[1]] = (porJogador[pp[0]].parceiros[pp[1]] || 0) + 1;
        porJogador[pp[1]].parceiros[pp[0]] = (porJogador[pp[1]].parceiros[pp[0]] || 0) + 1;
      });
    });
    var qtds = ids.map(function (i) { return porJogador[i].jogos; });
    var vals = Object.keys(duplas).map(function (k) { return duplas[k]; });
    return {
      porJogador: porJogador,
      duplas: duplas,
      minJogos: Math.min.apply(null, qtds),
      maxJogos: Math.max.apply(null, qtds),
      minDupla: vals.length ? Math.min.apply(null, vals) : 0,
      maxDupla: vals.length ? Math.max.apply(null, vals) : 0
    };
  }

  /* Mata-mata X1 entre os empatados (turno unico, todos contra todos). */
  function gerarX1(ids) {
    var jogos = [];
    for (var i = 0; i < ids.length; i++)
      for (var j = i + 1; j < ids.length; j++)
        jogos.push({ a: [ids[i]], b: [ids[j]], fora: [] });
    return jogos;
  }

  return {
    gerarRodizio: gerarRodizio,
    estatisticasRodizio: estatisticasRodizio,
    configuracoes: configuracoes,
    gerarX1: gerarX1,
    combinacoes: combinacoes
  };
});
