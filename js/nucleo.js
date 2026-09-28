/*
 * CLT — nucleo compartilhado.
 * Roda igual no navegador e no servidor (api/acao.js): toda mudanca no campeonato
 * passa por aplicar(), entao os dois lados chegam sempre ao mesmo resultado.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica(require('./scheduler.js'), require('./match.js'));
  } else {
    raiz.CLT = raiz.CLT || {};
    raiz.CLT.nucleo = fabrica(raiz.CLT.scheduler, raiz.CLT.match);
  }
})(typeof self !== 'undefined' ? self : this, function (SC, M) {
  'use strict';

  var CONFIG_PADRAO = { limite: 12, usarMaoDe11: true, maoDeFerroVale: 3 };

  function id() { return Math.random().toString(36).slice(2, 9); }
  function clonar(x) { return JSON.parse(JSON.stringify(x)); }

  function criarCampeonato(dados) {
    var jogadores = (dados.nomes || []).map(function (n) {
      return { id: id(), nome: String(n).trim(), inativo: false };
    });
    var ids = jogadores.map(function (j) { return j.id; });
    var semente = dados.semente || (Date.now() % 100000);
    var tamanho = dados.tamanhoTime || 2;
    var total = Math.max(1, dados.totalJogos || 30);
    var presentes = {};
    ids.forEach(function (i) { presentes[i] = true; });
    return {
      nome: dados.nome || 'Champions League de Truco',
      criadoEm: new Date().toISOString(),
      jogadores: jogadores,
      tamanhoTime: tamanho,
      totalJogos: total,
      valorAposta: dados.valorAposta == null ? 10 : dados.valorAposta,
      semente: semente,
      config: Object.assign({}, CONFIG_PADRAO, dados.config || {}),
      presentes: presentes,
      partidas: {},
      jogos: montarJogos(SC.gerarRodizio(ids, tamanho, total, semente)),
      log: [],
      encerrado: false
    };
  }

  function montarJogos(brutos, base) {
    base = base || 0;
    return brutos.map(function (j, i) {
      return {
        n: base + i + 1, a: j.a, b: j.b, fora: j.fora || [],
        status: 'pendente', placar: { A: 0, B: 0 }, vencedor: null, tipo: 'normal', em: null,
        historico: null
      };
    });
  }

  /* registro de auditoria em nivel de campeonato (quem presenteou, iniciou,
     cancelou, trocou config etc). O historico mao-a-mao de uma partida em si
     fica dentro da propria partida (js/match.js `registrar`) e e preservado
     em jogo.historico quando a partida e finalizada — ver case 'finalizar'. */
  function registrarLog(camp, texto, autor) {
    if (!camp.log) camp.log = [];
    camp.log.unshift({ texto: texto, autor: autor || null, em: new Date().toISOString() });
    if (camp.log.length > 150) camp.log.pop();
  }

  /* ---------------- consultas (nao mudam nada) ---------------- */

  function jogador(camp, idJog) {
    var j = (camp.jogadores || []).filter(function (x) { return x.id === idJog; })[0];
    return j ? j.nome : '?';
  }
  function nomes(camp, ids) {
    return (ids || []).map(function (i) { return jogador(camp, i); }).join(' + ');
  }
  function presente(camp, idJog) { return camp.presentes[idJog] !== false; }
  function inativo(camp, idJog) {
    var j = (camp.jogadores || []).filter(function (x) { return x.id === idJog; })[0];
    return !!(j && j.inativo);
  }
  function jogoLiberado(camp, jogo) {
    return jogo.a.concat(jogo.b).every(function (p) { return presente(camp, p); });
  }
  function ausentesDoJogo(camp, jogo) {
    return jogo.a.concat(jogo.b).filter(function (p) { return !presente(camp, p); });
  }
  function acharJogo(camp, n) {
    return camp.jogos.filter(function (x) { return x.n === Number(n); })[0] || null;
  }
  function acharJogador(camp, idJog) {
    return (camp.jogadores || []).filter(function (x) { return x.id === idJog; })[0] || null;
  }
  function emAndamento(camp) {
    return camp.jogos.filter(function (j) { return j.status === 'em_andamento'; });
  }
  function pendentes(camp) {
    return camp.jogos.filter(function (j) { return j.status === 'pendente'; });
  }

  /* Quem entra em quadra agora: primeiro partida pausada que da pra retomar,
     depois o primeiro jogo novo com todo mundo presente. */
  function proximoJogo(camp) {
    var pausadas = emAndamento(camp).filter(function (j) { return jogoLiberado(camp, j); });
    if (pausadas.length) return pausadas[0];
    var lista = pendentes(camp);
    for (var i = 0; i < lista.length; i++) if (jogoLiberado(camp, lista[i])) return lista[i];
    return null;
  }

  function adiados(camp) {
    var prox = proximoJogo(camp);
    return pendentes(camp).filter(function (j) {
      return !jogoLiberado(camp, j) && (!prox || j.n < prox.n);
    });
  }

  function progresso(camp) {
    return {
      feitos: camp.jogos.filter(function (j) { return j.status === 'concluido'; }).length,
      andamento: emAndamento(camp).length,
      pulados: camp.jogos.filter(function (j) { return j.status === 'pulado'; }).length,
      total: camp.jogos.length
    };
  }

  function classificacao(camp) {
    var linhas = {};
    camp.jogadores.forEach(function (j) {
      linhas[j.id] = { id: j.id, nome: j.nome, inativo: !!j.inativo, j: 0, v: 0, d: 0, pf: 0, ps: 0, sd: 0, ap: 0, x1: 0 };
    });
    camp.jogos.forEach(function (g) {
      if (g.status !== 'concluido') return;
      [['A', g.a], ['B', g.b]].forEach(function (par) {
        var lado = par[0], meus = par[1];
        var meusPts = g.placar[lado], outrosPts = g.placar[lado === 'A' ? 'B' : 'A'];
        meus.forEach(function (p) {
          var l = linhas[p];
          if (!l) return;
          l.j++; l.pf += meusPts; l.ps += outrosPts;
          if (g.vencedor === lado) { l.v++; if (g.tipo === 'x1') l.x1++; } else { l.d++; }
        });
      });
    });
    var arr = Object.keys(linhas).map(function (k) {
      var l = linhas[k];
      l.sd = l.pf - l.ps;
      l.ap = l.j ? Math.round((l.v / l.j) * 100) : 0;
      return l;
    });
    arr.sort(function (x, y) {
      return (y.v - x.v) || (y.sd - x.sd) || (y.pf - x.pf) || x.nome.localeCompare(y.nome);
    });
    return arr;
  }

  function empatadosNoTopo(camp) {
    var t = classificacao(camp);
    if (t.length < 2) return [];
    var top = t[0];
    var iguais = t.filter(function (l) { return l.v === top.v && l.sd === top.sd; });
    return iguais.length > 1 ? iguais : [];
  }

  function criarPartidaDoJogo(camp, jogo) {
    return M.criar({
      times: {
        A: { nome: nomes(camp, jogo.a), jogadores: jogo.a.map(function (i) { return jogador(camp, i); }) },
        B: { nome: nomes(camp, jogo.b), jogadores: jogo.b.map(function (i) { return jogador(camp, i); }) }
      },
      limite: camp.config.limite,
      usarMaoDe11: camp.config.usarMaoDe11,
      maoDeFerroVale: camp.config.maoDeFerroVale,
      origem: { tipo: 'campeonato', n: jogo.n, x1: jogo.tipo === 'x1' }
    });
  }

  /* 'pendente'/'em_andamento' sao os unicos status que ainda bloqueiam o
     campeonato de fechar — 'pulado' (jogador saiu no meio) conta como resolvido */
  function conferirEncerrado(camp) {
    camp.encerrado = !camp.jogos.some(function (j) {
      return j.status === 'pendente' || j.status === 'em_andamento';
    });
  }

  /*
   * Um lance dentro de uma partida — usado pelo reducer e pela partida avulsa.
   * Devolve {ok:true} so quando o lance realmente mudou alguma coisa; um lance
   * que chegou atrasado (mao ja resolvida por outro aparelho) devolve
   * {ok:false} em vez de fingir sucesso — assim quem chamou sabe que precisa
   * avisar a pessoa e ressincronizar, em vez de gravar um "nada aconteceu"
   * como se fosse uma jogada valida.
   */
  function lanceNaPartida(p, acao) {
    if (!p) return { ok: false, erro: 'partida nao encontrada' };
    var autor = acao.autor;
    var mudou;
    switch (acao.lance) {
      case 'pedir': mudou = M.pedir(p, acao.time, autor); break;
      case 'aceitar': mudou = M.aceitar(p, autor); break;
      case 'correr': mudou = M.correr(p, autor); break;
      case 'aumentar': mudou = M.aumentar(p, autor); break;
      case 'venceu': mudou = M.vencerMao(p, acao.time, autor); break;
      case 'm11': mudou = M.resolverMao11(p, acao.decisao, autor); break;
      case 'ajuste': mudou = M.ajustar(p, acao.time, acao.delta, autor); break;
      case 'desfazer': mudou = M.desfazer(p); break;
      default: return { ok: false, erro: 'lance desconhecido' };
    }
    return mudou ? { ok: true } : { ok: false, erro: 'essa jogada nao vale mais — o placar ja mudou' };
  }

  /* ---------------- o reducer ---------------- */
  /* aplicar(camp, acao) altera camp no lugar e devolve {ok} ou {ok:false, erro}. */
  function aplicar(camp, acao) {
    if (!camp || !acao || !acao.tipo) return { ok: false, erro: 'acao invalida' };
    if (!camp.log) camp.log = []; // campeonatos criados antes desse campo existir
    var jogo, p, autor = acao.autor;

    switch (acao.tipo) {

      case 'presenca': {
        var alvoPresenca = acharJogador(camp, acao.jogador);
        if (!alvoPresenca) return { ok: false, erro: 'jogador desconhecido' };
        var estava = presente(camp, acao.jogador);
        var vaiFicar = acao.valor !== false;
        if (estava === vaiFicar) return { ok: false, erro: 'presenca sem mudanca' };
        camp.presentes[acao.jogador] = vaiFicar;
        registrarLog(camp, alvoPresenca.nome + (vaiFicar ? ' chegou' : ' saiu da mesa'), autor);
        return { ok: true };
      }

      case 'iniciar':
        jogo = acharJogo(camp, acao.n);
        if (!jogo) return { ok: false, erro: 'jogo nao encontrado' };
        if (jogo.status === 'concluido') return { ok: false, erro: 'jogo ja concluido' };
        if (jogo.status === 'pulado') return { ok: false, erro: 'jogo foi pulado' };
        if (!camp.partidas[jogo.n]) camp.partidas[jogo.n] = criarPartidaDoJogo(camp, jogo);
        jogo.status = 'em_andamento';
        conferirEncerrado(camp);
        registrarLog(camp, 'iniciou o jogo ' + jogo.n, autor);
        return { ok: true };

      case 'lance':
        jogo = acharJogo(camp, acao.n);
        p = camp.partidas[acao.n];
        if (!jogo || !p) return { ok: false, erro: 'partida nao encontrada' };
        return lanceNaPartida(p, acao);

      case 'cancelar':
        jogo = acharJogo(camp, acao.n);
        if (!jogo) return { ok: false, erro: 'jogo nao encontrado' };
        delete camp.partidas[jogo.n];
        if (jogo.status === 'em_andamento') jogo.status = 'pendente';
        conferirEncerrado(camp);
        registrarLog(camp, 'cancelou a partida do jogo ' + jogo.n, autor);
        return { ok: true };

      case 'finalizar':
        jogo = acharJogo(camp, acao.n);
        p = camp.partidas[acao.n];
        if (!jogo || !p) return { ok: false, erro: 'partida nao encontrada' };
        if (!p.vencedor) return { ok: false, erro: 'partida ainda nao terminou' };
        jogo.status = 'concluido';
        jogo.placar = { A: p.pontos.A, B: p.pontos.B };
        jogo.vencedor = p.vencedor;
        jogo.em = new Date().toISOString();
        jogo.historico = p.historico; // guarda o mao-a-mao (com autor) antes de descartar a partida
        delete camp.partidas[jogo.n];
        conferirEncerrado(camp);
        registrarLog(camp, 'salvou o jogo ' + jogo.n + ': ' + jogo.placar.A + 'x' + jogo.placar.B, autor);
        return { ok: true };

      case 'reabrir':
        jogo = acharJogo(camp, acao.n);
        if (!jogo) return { ok: false, erro: 'jogo nao encontrado' };
        jogo.status = 'pendente';
        jogo.placar = { A: 0, B: 0 };
        jogo.vencedor = null;
        jogo.em = null;
        jogo.historico = null;
        delete camp.partidas[jogo.n];
        camp.encerrado = false;
        registrarLog(camp, 'reabriu o jogo ' + jogo.n, autor);
        return { ok: true };

      case 'x1': {
        var ids = acao.jogadores || empatadosNoTopo(camp).map(function (l) { return l.id; });
        if (ids.length < 2) return { ok: false, erro: 'sem empate para desempatar' };
        var novos = montarJogos(SC.gerarX1(ids), camp.jogos.length);
        novos.forEach(function (j) { j.tipo = 'x1'; j.fora = []; });
        camp.jogos = camp.jogos.concat(novos);
        camp.encerrado = false;
        registrarLog(camp, 'gerou o desempate X1 (' + novos.length + ' jogo' + (novos.length > 1 ? 's' : '') + ')', autor);
        return { ok: true, criados: novos.length };
      }

      case 'regerar':
        if (camp.jogos.some(function (j) { return j.status !== 'pendente'; })) {
          return { ok: false, erro: 'o campeonato ja comecou' };
        }
        camp.semente = (camp.semente + 1013) % 999983;
        camp.jogos = montarJogos(SC.gerarRodizio(
          camp.jogadores.map(function (j) { return j.id; }),
          camp.tamanhoTime, camp.totalJogos, camp.semente));
        registrarLog(camp, 'sorteou o rodizio de novo', autor);
        return { ok: true };

      case 'config':
        camp.config = Object.assign({}, camp.config, acao.config || {});
        registrarLog(camp, 'mudou a configuracao do campeonato', autor);
        return { ok: true };

      case 'renomear-jogador': {
        var pRenomear = acharJogador(camp, acao.jogador);
        if (!pRenomear) return { ok: false, erro: 'jogador desconhecido' };
        var novoNome = String(acao.nome || '').trim().slice(0, 40);
        if (!novoNome) return { ok: false, erro: 'nome vazio' };
        if (novoNome === pRenomear.nome) return { ok: false, erro: 'nome sem mudanca' };
        var nomeAntigo = pRenomear.nome;
        pRenomear.nome = novoNome;
        registrarLog(camp, nomeAntigo + ' passou a se chamar ' + novoNome, autor);
        return { ok: true };
      }

      /* jogador sai definitivamente do campeonato (diferente de "nao esta na
         mesa hoje"): os jogos dele que ainda nao comecaram viram 'pulado' em
         vez de ficar adiados para sempre, o que deixa o campeonato fechar. */
      case 'jogador-inativo': {
        var pInativar = acharJogador(camp, acao.jogador);
        if (!pInativar) return { ok: false, erro: 'jogador desconhecido' };
        var ligar = acao.valor !== false;
        if (!!pInativar.inativo === ligar) return { ok: false, erro: 'sem mudanca' };
        pInativar.inativo = ligar;
        if (ligar) {
          camp.presentes[pInativar.id] = false;
          camp.jogos.forEach(function (j) {
            if (j.status === 'pendente' && (j.a.indexOf(pInativar.id) !== -1 || j.b.indexOf(pInativar.id) !== -1)) {
              j.status = 'pulado';
            }
          });
        } else {
          camp.jogos.forEach(function (j) {
            if (j.status === 'pulado' && (j.a.indexOf(pInativar.id) !== -1 || j.b.indexOf(pInativar.id) !== -1)) {
              j.status = 'pendente';
            }
          });
        }
        conferirEncerrado(camp);
        registrarLog(camp, pInativar.nome + (ligar ? ' saiu do campeonato' : ' voltou ao campeonato'), autor);
        return { ok: true };
      }

      default:
        return { ok: false, erro: 'acao desconhecida: ' + acao.tipo };
    }
  }

  return {
    CONFIG_PADRAO: CONFIG_PADRAO,
    id: id, clonar: clonar,
    criarCampeonato: criarCampeonato,
    criarPartidaDoJogo: criarPartidaDoJogo,
    lanceNaPartida: lanceNaPartida,
    aplicar: aplicar,
    registrarLog: registrarLog,
    jogador: jogador, nomes: nomes, presente: presente, inativo: inativo,
    jogoLiberado: jogoLiberado, ausentesDoJogo: ausentesDoJogo, acharJogo: acharJogo,
    acharJogador: acharJogador,
    emAndamento: emAndamento, pendentes: pendentes, proximoJogo: proximoJogo,
    adiados: adiados, progresso: progresso,
    classificacao: classificacao, empatadosNoTopo: empatadosNoTopo,
    scheduler: SC, match: M
  };
});
