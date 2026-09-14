/*
 * CLT — estado do aparelho.
 * Tudo que muda o campeonato vira uma "acao" que passa pelo nucleo. Se a sala for online,
 * a mesma acao vai pro servidor, que e quem manda; enquanto isso a tela ja responde na hora.
 */
window.CLT = window.CLT || {};
(function (CLT) {
  'use strict';

  var N = CLT.nucleo, api = CLT.api;
  var CHAVE = 'clt.v2';

  function padrao() {
    return {
      tela: 'inicio',
      aba: 'proximos',
      codigo: null,        // sala online (null = so neste aparelho)
      versao: 0,
      camp: null,          // o campeonato
      jogoAberto: null,    // numero do jogo que esta aberto na tela de partida
      avulsa: null,        // partida solta, sem campeonato (nunca sincroniza)
      backend: 'checando', // 'checando' | 'ok' | 'ausente'
      conexao: 'ok',       // 'ok' | 'caiu'
      aviso: null
    };
  }

  var estado = padrao();
  var aoMudar = function () {};
  var enviando = 0;
  var timer = null;

  function get() { return estado; }

  function carregar() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        var s = JSON.parse(bruto);
        estado = Object.assign(padrao(), s);
        estado.backend = 'checando';
        estado.conexao = 'ok';
        estado.aviso = null;
      }
    } catch (e) { estado = padrao(); }
    return estado;
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        tela: estado.tela, aba: estado.aba, codigo: estado.codigo,
        versao: estado.versao, camp: estado.camp,
        jogoAberto: estado.jogoAberto, avulsa: estado.avulsa
      }));
    } catch (e) {}
  }

  function avisar(texto, tipo) {
    estado.aviso = texto ? { texto: texto, tipo: tipo || 'erro', em: Date.now() } : null;
  }

  /* ---------------- sincronizacao ---------------- */

  function intervalo() {
    if (!estado.codigo) return 6000;
    if (typeof document !== 'undefined' && document.hidden) return 20000;
    if (estado.tela === 'partida') return 1800;   // placar ao vivo
    return 4000;
  }

  function agendar() {
    clearTimeout(timer);
    timer = setTimeout(bater, intervalo());
  }

  function bater() {
    /* com a aba escondida a gente nao para de conferir, so espaca bastante */
    if (!estado.codigo || enviando > 0) {
      agendar();
      return;
    }
    api.buscar(estado.codigo, estado.versao).then(function (r) {
      var voltou = estado.conexao !== 'ok';
      estado.conexao = 'ok';
      if (r.mudou) {
        estado.camp = r.camp;
        estado.versao = r.versao;
        salvar();
        aoMudar();
      } else if (voltou) {
        aoMudar();
      }
    }).catch(function (e) {
      if (e && e.status === 404) {
        estado.codigo = null;
        avisar('essa sala nao existe mais no servidor — seguindo offline');
        salvar();
        aoMudar();
        return;
      }
      if (estado.conexao !== 'caiu') { estado.conexao = 'caiu'; aoMudar(); }
    }).then(agendar, agendar);
  }

  function iniciarSync(callback) {
    aoMudar = callback || function () {};
    api.vivo().then(function (ok) {
      estado.backend = ok ? 'ok' : 'ausente';
      aoMudar();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { clearTimeout(timer); bater(); }
      });
    }
    agendar();
  }

  function sincronizarAgora() {
    clearTimeout(timer);
    bater();
  }

  /* ---------------- acoes ---------------- */

  function despachar(acao) {
    if (!estado.camp) return Promise.resolve(false);

    var antes = N.clonar(estado.camp);
    var r = N.aplicar(estado.camp, acao);
    if (!r.ok) {
      estado.camp = antes;
      avisar(r.erro);
      aoMudar();
      return Promise.resolve(false);
    }
    salvar();
    aoMudar();

    if (!estado.codigo) return Promise.resolve(true);

    enviando++;
    return api.enviar(estado.codigo, acao).then(function (resp) {
      estado.camp = resp.camp;
      estado.versao = resp.versao;
      estado.conexao = 'ok';
      salvar();
      return true;
    }).catch(function (e) {
      /* o servidor recusou (ex: outro aparelho ja fez isso): vale o que ele diz */
      if (e && e.dados && e.dados.camp) {
        estado.camp = e.dados.camp;
        estado.versao = e.dados.versao || estado.versao;
        avisar(e.message || 'jogada recusada pelo servidor');
      } else {
        estado.camp = antes;
        estado.conexao = 'caiu';
        avisar('sem conexao com o servidor — a jogada nao foi salva');
      }
      salvar();
      return false;
    }).then(function (ok) {
      enviando--;
      aoMudar();
      if (estado.codigo) sincronizarAgora();
      return ok;
    });
  }

  /* ---------------- salas ---------------- */

  function criarCampeonato(dados, online) {
    if (online && estado.backend === 'ok') {
      return api.criar(dados).then(function (r) {
        estado.codigo = r.codigo;
        estado.versao = r.versao;
        estado.camp = r.camp;
        estado.tela = 'campeonato';
        estado.jogoAberto = null;
        salvar();
        sincronizarAgora();
        return { ok: true, online: true };
      }).catch(function (e) {
        return { ok: false, erro: e.message };
      });
    }
    estado.camp = N.criarCampeonato(dados);
    estado.codigo = null;
    estado.versao = 0;
    estado.tela = 'campeonato';
    estado.jogoAberto = null;
    salvar();
    return Promise.resolve({ ok: true, online: false });
  }

  function entrarNaSala(codigo) {
    codigo = String(codigo || '').trim().toUpperCase();
    if (!codigo) return Promise.resolve({ ok: false, erro: 'informe o codigo' });
    return api.buscar(codigo, 0).then(function (r) {
      estado.codigo = codigo;
      estado.camp = r.camp;
      estado.versao = r.versao;
      estado.tela = 'campeonato';
      estado.jogoAberto = null;
      salvar();
      sincronizarAgora();
      return { ok: true };
    }).catch(function (e) {
      return { ok: false, erro: e.status === 404 ? 'codigo nao encontrado' : e.message };
    });
  }

  function sairDaSala() {
    estado.codigo = null;
    estado.camp = null;
    estado.versao = 0;
    estado.jogoAberto = null;
    estado.tela = 'inicio';
    salvar();
  }

  /* ---------------- atalhos de leitura ---------------- */
  function camp() { return estado.camp; }
  function nome(idJog) { return estado.camp ? N.jogador(estado.camp, idJog) : '?'; }
  function nomes(ids) { return estado.camp ? N.nomes(estado.camp, ids) : ''; }
  function presente(idJog) { return estado.camp ? N.presente(estado.camp, idJog) : true; }
  function proximoJogo() { return estado.camp ? N.proximoJogo(estado.camp) : null; }
  function adiados() { return estado.camp ? N.adiados(estado.camp) : []; }
  function emAndamento() { return estado.camp ? N.emAndamento(estado.camp) : []; }
  function progresso() { return estado.camp ? N.progresso(estado.camp) : { feitos: 0, total: 0, andamento: 0 }; }
  function classificacao() { return estado.camp ? N.classificacao(estado.camp) : []; }
  function empatadosNoTopo() { return estado.camp ? N.empatadosNoTopo(estado.camp) : []; }
  function jogo(n) { return estado.camp ? N.acharJogo(estado.camp, n) : null; }
  function partida(n) { return estado.camp && estado.camp.partidas ? estado.camp.partidas[n] : null; }
  function ausentesDoJogo(j) { return estado.camp ? N.ausentesDoJogo(estado.camp, j) : []; }
  function jogoLiberado(j) { return estado.camp ? N.jogoLiberado(estado.camp, j) : true; }

  function exportar() {
    return JSON.stringify({ codigo: estado.codigo, camp: estado.camp }, null, 2);
  }
  function importar(texto) {
    var d = JSON.parse(texto);
    var c = d.camp || d.campeonato;
    if (!c) throw new Error('arquivo sem campeonato');
    estado.camp = c;
    estado.codigo = null;   // backup vira copia local; pra compartilhar, crie a sala de novo
    estado.versao = 0;
    estado.jogoAberto = null;
    salvar();
  }

  CLT.store = {
    carregar: carregar, salvar: salvar, get: get, avisar: avisar,
    iniciarSync: iniciarSync, sincronizarAgora: sincronizarAgora,
    despachar: despachar,
    criarCampeonato: criarCampeonato, entrarNaSala: entrarNaSala, sairDaSala: sairDaSala,
    camp: camp, nome: nome, nomes: nomes, presente: presente,
    proximoJogo: proximoJogo, adiados: adiados, emAndamento: emAndamento,
    progresso: progresso, classificacao: classificacao, empatadosNoTopo: empatadosNoTopo,
    jogo: jogo, partida: partida, ausentesDoJogo: ausentesDoJogo, jogoLiberado: jogoLiberado,
    exportar: exportar, importar: importar
  };
})(window.CLT);
