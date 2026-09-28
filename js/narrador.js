/*
 * CLT — narrador de voz + efeitos sonoros de zoeira.
 * Usa o Text-to-Speech do proprio aparelho (Web Speech API) pra narrar os
 * lances em portugues, e toca efeitos sonoros curtos (pato, vaca, galo...)
 * pra zoeira. Nao depende de servidor nem de internet depois de carregado.
 *
 * Cada aparelho narra so o que ESSE aparelho esta vendo — nao existe um
 * "narrador oficial" central pra sala toda.
 */
window.CLT = window.CLT || {};
(function (CLT) {
  'use strict';

  var CHAVE_ATIVO = 'clt.narrador';
  var BASE_SONS = 'assets/sons/';
  var SONS = {
    pato: 'pato.mp3',
    vaca: 'vaca.mp3',
    galo: 'galo.mp3',
    porco: 'porco.mp3',
    burro: 'burro.mp3',
    zoeira: 'zoeira.mp3',
    fimdejogo: 'fimdejogo.mp3'
  };

  var temFala = typeof window !== 'undefined' && 'speechSynthesis' in window;
  var vozEscolhida = null;

  function escolherVoz() {
    if (!temFala) return null;
    var vozes = speechSynthesis.getVoices() || [];
    if (!vozes.length) return null;
    return vozes.filter(function (v) { return v.lang === 'pt-BR'; })[0] ||
      vozes.filter(function (v) { return /^pt/i.test(v.lang); })[0] ||
      vozes[0];
  }

  if (temFala) {
    vozEscolhida = escolherVoz();
    /* em muitos navegadores a lista de vozes carrega de forma assincrona */
    if (typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', function () {
        vozEscolhida = escolherVoz();
      });
    }
  }

  function ativo() {
    try { return localStorage.getItem(CHAVE_ATIVO) === '1'; } catch (e) { return false; }
  }
  function ativar(v) {
    try { localStorage.setItem(CHAVE_ATIVO, v ? '1' : '0'); } catch (e) {}
  }
  function suportado() { return temFala; }

  function falar(texto) {
    if (!ativo() || !temFala || !texto) return;
    try {
      var u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      if (vozEscolhida) u.voice = vozEscolhida;
      u.rate = 1.02;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  var cacheAudio = {};
  function pegarAudio(chave) {
    var arquivo = SONS[chave];
    if (!arquivo) return null;
    var a = cacheAudio[chave];
    if (!a) { a = new Audio(BASE_SONS + arquivo); cacheAudio[chave] = a; }
    return a;
  }

  function tocarSom(chave) {
    if (!ativo()) return;
    var a = pegarAudio(chave);
    if (!a) return;
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  /* toca o efeito de zoeira e fala a frase logo em seguida */
  function narrarComSom(texto, chaveSom) {
    tocarSom(chaveSom);
    falar(texto);
  }

  /*
   * "Destrava" o audio no aparelho: o Safari do iPhone (e o Chrome, em menor
   * grau) so deixa tocar som automaticamente depois de pelo menos um toque
   * do usuario na pagina. Chamar isso dentro do clique do botao "ligar
   * narrador" resolve pros efeitos sonoros e pra fala tocarem sozinhos
   * depois, quando o ponto for marcado.
   */
  function destravar() {
    if (temFala) {
      try {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch (e) {}
    }
    Object.keys(SONS).forEach(function (chave) {
      try {
        var a = pegarAudio(chave);
        a.muted = true;
        var p = a.play();
        var soltar = function () { a.pause(); a.currentTime = 0; a.muted = false; };
        if (p && p.then) p.then(soltar).catch(function () { a.muted = false; });
        else soltar();
      } catch (e) {}
    });
  }

  CLT.narrador = {
    ativo: ativo, ativar: ativar, suportado: suportado,
    falar: falar, tocarSom: tocarSom, narrarComSom: narrarComSom,
    destravar: destravar,
    SONS: SONS
  };
})(window.CLT);
