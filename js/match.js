/* CLT — motor da partida (truco paulista: 12 pontos, escada 1/3/6/9/12, mao de 11) */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else { raiz.CLT = raiz.CLT || {}; raiz.CLT.match = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ESCADA = [1, 3, 6, 9, 12];
  var NOMES = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' };

  function nomeAposta(v) { return NOMES[v] || String(v); }
  function proximo(v) {
    var i = ESCADA.indexOf(v);
    return (i >= 0 && i < ESCADA.length - 1) ? ESCADA[i + 1] : null;
  }
  function outro(t) { return t === 'A' ? 'B' : 'A'; }
  function timeValido(t) { return t === 'A' || t === 'B'; }

  function criar(opts) {
    var p = {
      id: 'p' + Date.now(),
      criadaEm: new Date().toISOString(),
      times: {
        A: { nome: opts.times.A.nome, jogadores: opts.times.A.jogadores || [] },
        B: { nome: opts.times.B.nome, jogadores: opts.times.B.jogadores || [] }
      },
      pontos: { A: 0, B: 0 },
      limite: opts.limite || 12,
      usarMaoDe11: opts.usarMaoDe11 !== false,
      maoDeFerroVale: opts.maoDeFerroVale || 3,
      origem: opts.origem || { tipo: 'avulsa' },
      numeroMao: 0,
      historico: [],
      vencedor: null,
      pilha: [],
      mao: null
    };
    novaMao(p);
    return p;
  }

  function novaMao(p) {
    var limiar = p.limite - 1;
    var a = p.pontos.A, b = p.pontos.B;
    var mao = {
      valor: 1,
      aposta: null,          // {time, valor, anterior}
      podeAumentar: null,    // quem tem a mao pra aumentar depois de aceitar
      especial: null,        // 'm11' | 'ferro'
      decisao11: null,       // time que precisa decidir jogar ou correr
      trucoBloqueado: false
    };
    if (p.usarMaoDe11) {
      if (a >= limiar && b >= limiar) {
        mao.especial = 'ferro';
        mao.valor = p.maoDeFerroVale;
        mao.trucoBloqueado = true;
      } else if (a >= limiar || b >= limiar) {
        mao.especial = 'm11';
        mao.decisao11 = a >= limiar ? 'A' : 'B';
        mao.valor = 3;
        mao.trucoBloqueado = true;
      }
    }
    p.mao = mao;
    p.numeroMao++;
  }

  function registrar(p, texto, autor) {
    p.historico.unshift({
      mao: p.numeroMao,
      texto: texto,
      placar: p.pontos.A + ' x ' + p.pontos.B,
      em: Date.now(),
      autor: autor || null
    });
    if (p.historico.length > 60) p.historico.pop();
  }

  function guardar(p) {
    p.pilha.push(JSON.stringify({
      pontos: p.pontos, mao: p.mao, historico: p.historico,
      vencedor: p.vencedor, numeroMao: p.numeroMao
    }));
    if (p.pilha.length > 15) p.pilha.shift();
  }

  function desfazer(p) {
    if (!p.pilha.length) return false;
    var s = JSON.parse(p.pilha.pop());
    p.pontos = s.pontos; p.mao = s.mao; p.historico = s.historico;
    p.vencedor = s.vencedor; p.numeroMao = s.numeroMao;
    return true;
  }

  function podePedir(p, time) {
    if (!timeValido(time)) return false;
    if (p.vencedor || !p.mao) return false;
    var m = p.mao;
    if (m.trucoBloqueado || m.aposta || m.decisao11) return false;
    if (proximo(m.valor) === null) return false;
    if (m.valor === 1) return true;
    return m.podeAumentar === time;
  }

  /*
   * Cada funcao abaixo devolve true se realmente mudou alguma coisa em `p`,
   * ou false se foi um "no-op" (pedido que nao valia mais, mao ja resolvida
   * por outro aparelho, etc). Quem chama (nucleo.js) usa isso pra saber se
   * deve gravar/propagar a jogada ou recusar com um aviso — sem isso, um
   * clique que chegou atrasado (dois celulares na mesma sala) parecia dar
   * certo sem ter mudado nada de verdade.
   */

  function pedir(p, time, autor) {
    if (!podePedir(p, time)) return false;
    guardar(p);
    var valor = proximo(p.mao.valor);
    p.mao.aposta = { time: time, valor: valor, anterior: p.mao.valor };
    registrar(p, p.times[time].nome + ' pediu ' + nomeAposta(valor), autor);
    return true;
  }

  function aumentar(p, autor) {
    var m = p.mao;
    if (!m || !m.aposta) return false;
    var prox = proximo(m.aposta.valor);
    if (prox === null) return false;
    guardar(p);
    var quem = outro(m.aposta.time);
    m.aposta = { time: quem, valor: prox, anterior: m.aposta.valor };
    registrar(p, p.times[quem].nome + ' pediu ' + nomeAposta(prox), autor);
    return true;
  }

  function aceitar(p, autor) {
    var m = p.mao;
    if (!m || !m.aposta) return false;
    guardar(p);
    var quemAceitou = outro(m.aposta.time);
    m.valor = m.aposta.valor;
    m.podeAumentar = proximo(m.valor) === null ? null : quemAceitou;
    registrar(p, p.times[quemAceitou].nome + ' aceitou — mão vale ' + m.valor, autor);
    m.aposta = null;
    return true;
  }

  function correr(p, autor) {
    var m = p.mao;
    if (!m || !m.aposta) return false;
    guardar(p);
    var fugiu = outro(m.aposta.time);
    var ganhador = m.aposta.time;
    var valor = m.aposta.anterior;
    registrar(p, p.times[fugiu].nome + ' correu do ' + nomeAposta(m.aposta.valor), autor);
    m.aposta = null;
    aplicarPontos(p, ganhador, valor, 'levou', autor);
    return true;
  }

  /* mao de 11: o time que esta com 11 decide jogar (vale 3) ou correr (da 1 ao adversario) */
  function resolverMao11(p, decisao, autor) {
    if (decisao !== 'jogar' && decisao !== 'correr') return false;
    var m = p.mao;
    if (!m || !m.decisao11 || p.vencedor) return false;
    guardar(p);
    var time = m.decisao11;
    if (decisao === 'jogar') {
      m.decisao11 = null;
      registrar(p, p.times[time].nome + ' aceitou a mão de 11 — vale 3', autor);
    } else {
      registrar(p, p.times[time].nome + ' correu da mão de 11', autor);
      m.decisao11 = null;
      aplicarPontos(p, outro(time), 1, 'levou a mão de 11', autor);
    }
    return true;
  }

  function vencerMao(p, time, autor) {
    if (!timeValido(time)) return false;
    var m = p.mao;
    /* m.aposta pendente = tem truco em negociacao; a mao so pode ser fechada
       depois que aceitar/correr/aumentar resolver esse pedido */
    if (!m || p.vencedor || m.decisao11 || m.aposta) return false;
    guardar(p);
    aplicarPontos(p, time, m.valor, 'venceu a mão', autor);
    return true;
  }

  function aplicarPontos(p, time, valor, motivo, autor) {
    p.pontos[time] = Math.min(p.limite, p.pontos[time] + valor);
    registrar(p, p.times[time].nome + ' ' + motivo + ' +' + valor, autor);
    if (p.pontos[time] >= p.limite) {
      p.vencedor = time;
      p.encerradaEm = new Date().toISOString();
      registrar(p, 'FIM — ' + p.times[time].nome + ' venceu', autor);
    } else {
      novaMao(p);
    }
  }

  /* depois de qualquer ajuste manual, o vencedor tem que ser recalculado
     olhando OS DOIS placares — nunca só o time que acabou de ser mexido,
     senão dá pra reabrir (ou ate trocar) uma partida que ja tinha terminado */
  function recalcularVencedor(p) {
    var aVenceu = p.pontos.A >= p.limite;
    var bVenceu = p.pontos.B >= p.limite;
    var vencedorAindaValido = p.vencedor === 'A' ? aVenceu : (p.vencedor === 'B' ? bVenceu : false);

    if (vencedorAindaValido) return; // nada mudou pro vencedor, mao continua encerrada

    if (aVenceu && bVenceu) {
      // so acontece por ajuste manual (o jogo normal nunca deixa os dois no limite);
      // fica com quem tiver mais pontos, e em empate preserva quem ja era o vencedor
      p.vencedor = p.pontos.A === p.pontos.B ? (p.vencedor || 'A') : (p.pontos.A > p.pontos.B ? 'A' : 'B');
      p.encerradaEm = p.encerradaEm || new Date().toISOString();
    } else if (aVenceu) {
      p.vencedor = 'A';
      p.encerradaEm = new Date().toISOString();
    } else if (bVenceu) {
      p.vencedor = 'B';
      p.encerradaEm = new Date().toISOString();
    } else {
      p.vencedor = null;
      p.encerradaEm = null;
    }
    if (!p.vencedor) novaMao(p);
  }

  /* ajuste manual do placar (corrigir um ponto contado errado) */
  function ajustar(p, time, delta, autor) {
    if (!timeValido(time)) return false;
    delta = Number(delta) || 0;
    if (!delta) return false;

    guardar(p);
    var antes = p.pontos[time];
    p.pontos[time] = Math.max(0, Math.min(p.limite, antes + delta));
    var deltaReal = p.pontos[time] - antes;
    if (!deltaReal) { p.pilha.pop(); return false; } // ja estava no piso/teto, nada mudou de verdade

    registrar(p, 'ajuste manual: ' + p.times[time].nome + ' ' + (deltaReal > 0 ? '+' : '') + deltaReal, autor);
    recalcularVencedor(p);
    return true;
  }

  return {
    ESCADA: ESCADA,
    nomeAposta: nomeAposta,
    proximo: proximo,
    outro: outro,
    criar: criar,
    novaMao: novaMao,
    podePedir: podePedir,
    pedir: pedir,
    aumentar: aumentar,
    aceitar: aceitar,
    correr: correr,
    resolverMao11: resolverMao11,
    vencerMao: vencerMao,
    ajustar: ajustar,
    desfazer: desfazer
  };
});
