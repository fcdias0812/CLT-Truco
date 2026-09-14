/* CLT — conversa com o backend (funcoes serverless na Vercel + Postgres no Neon) */
window.CLT = window.CLT || {};
(function (CLT) {
  'use strict';

  /* Por padrao o backend e o mesmo endereco do site. Se o site estiver no GitHub Pages
     e a API na Vercel, da pra apontar pra la pelo menu (fica salvo no aparelho). */
  function base() {
    try {
      var salvo = localStorage.getItem('clt.api');
      if (salvo) return salvo.replace(/\/+$/, '');
    } catch (e) {}
    return '';
  }

  function definirBase(url) {
    try {
      if (url) localStorage.setItem('clt.api', String(url).replace(/\/+$/, ''));
      else localStorage.removeItem('clt.api');
    } catch (e) {}
  }

  function pedir(caminho, opcoes) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var prazo = setTimeout(function () { if (ctrl) ctrl.abort(); }, (opcoes && opcoes.prazo) || 12000);
    return fetch(base() + caminho, {
      method: (opcoes && opcoes.metodo) || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opcoes && opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(prazo);
      return r.text().then(function (txt) {
        var dados;
        try { dados = txt ? JSON.parse(txt) : {}; } catch (e) { dados = { erro: txt }; }
        if (!r.ok) {
          var err = new Error(dados.erro || ('erro ' + r.status));
          err.status = r.status;
          err.dados = dados;
          throw err;
        }
        return dados;
      });
    }, function (e) {
      clearTimeout(prazo);
      throw new Error(e && e.name === 'AbortError' ? 'servidor demorou demais' : 'sem conexao');
    });
  }

  CLT.api = {
    definirBase: definirBase,
    base: base,
    /* o app usa isso pra descobrir se existe backend (no GitHub Pages puro, nao existe) */
    vivo: function () {
      return pedir('/api/estado', { prazo: 6000 })
        .then(function (r) { return !!(r && r.backend); })
        .catch(function () { return false; });
    },
    criar: function (dados) {
      return pedir('/api/criar', { metodo: 'POST', corpo: dados });
    },
    buscar: function (codigo, versao) {
      return pedir('/api/estado?codigo=' + encodeURIComponent(codigo) + '&versao=' + (versao || 0),
        { prazo: 9000 });
    },
    enviar: function (codigo, acao) {
      return pedir('/api/acao', { metodo: 'POST', corpo: { codigo: codigo, acao: acao } });
    }
  };
})(window.CLT);
