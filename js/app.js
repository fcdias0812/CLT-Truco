/* CLT — interface */
(function (CLT) {
  'use strict';

  var S = CLT.store, M = CLT.match, SC = CLT.scheduler, N = CLT.nucleo, API = CLT.api;
  var tela = document.getElementById('tela');
  var modalFundo = document.getElementById('modalFundo');
  var modal = document.getElementById('modal');
  var btnVoltar = document.getElementById('btnVoltar');
  var btnMenu = document.getElementById('btnMenu');
  var selo = document.getElementById('selo');
  var torrada = document.getElementById('torrada');
  var E = null;
  var timerTorrada = null;

  var rascunho = {
    nome: 'CLT — Temporada 1', nomes: [], tamanhoTime: 2,
    totalJogos: 30, valorAposta: 10, online: true, senha: ''
  };

  /* campeonatos compartilhados que aparecem na tela inicial (cada um entra com a senha) */
  var salas = { itens: null, carregando: false, em: 0, erro: null };
  function carregarSalas(forcar) {
    if (salas.carregando || E.backend !== 'ok') return;
    if (!forcar && salas.itens && Date.now() - salas.em < 20000) return;
    salas.carregando = true;
    S.listarSalas().then(function (itens) {
      salas.itens = itens;
      salas.erro = null;
    }, function (e) {
      salas.erro = e.message;
    }).then(function () {
      salas.carregando = false;
      salas.em = Date.now();
      if (E.tela === 'inicio') render();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function moeda(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
  function ir(t) { E.tela = t; S.salvar(); render(); }

  /* ---------------- avisos e modal ---------------- */
  function mostrarTorrada() {
    if (!E.aviso) { torrada.hidden = true; return; }
    torrada.textContent = E.aviso.texto;
    torrada.className = 'torrada ' + (E.aviso.tipo || 'erro');
    torrada.hidden = false;
    clearTimeout(timerTorrada);
    timerTorrada = setTimeout(function () {
      S.avisar(null);
      torrada.hidden = true;
    }, 4000);
  }
  function abrirModal(html) { modal.innerHTML = html; modalFundo.hidden = false; }
  function fecharModal() { modalFundo.hidden = true; modal.innerHTML = ''; }
  modalFundo.addEventListener('click', function (ev) { if (ev.target === modalFundo) fecharModal(); });

  function partidaAtual() {
    if (E.jogoAberto) return S.partida(E.jogoAberto);
    if (E.avulsa) return E.avulsa;
    return null;
  }

  /* ---------------- tela inicial ---------------- */
  function viewInicio() {
    var h = '';
    var c = E.camp;

    if (c) {
      h += '<div class="cartao cartao-atual">' +
        '<p class="rotulo">Você está no campeonato</p>' +
        '<h2 class="nome-camp">' + esc(c.nome) + '</h2>' +
        barraProgresso(S.progresso()) +
        '<button class="botao primario grande" data-acao="campeonato">Continuar ›</button>' +
        '</div>';
    }

    if (E.backend === 'ok') h += listaSalas();

    h += '<div class="titulo-secao">Começar algo novo</div>';
    h += '<button class="botao botao-escolha' + (c ? '' : ' primario') + '" data-acao="novo">' +
      '<span class="emoji">🏆</span><span><b>Criar campeonato</b>' +
      '<small>vários jogos, rodízio de duplas e classificação</small></span></button>';
    h += '<button class="botao botao-escolha" data-acao="avulsa">' +
      '<span class="emoji">🃏</span><span><b>Partida rápida</b>' +
      '<small>só marcar os pontos de um jogo</small></span></button>';

    if (E.backend === 'ausente') {
      h += '<div class="aviso" style="margin-top:14px">Sem servidor neste endereço: tudo fica salvo só neste celular.</div>';
    }

    h += '<button class="botao fantasma pequeno link-centro" data-acao="regras">📖 Regras do truco</button>';
    return h;
  }

  function barraProgresso(pr, extra) {
    var pct = pr.total ? Math.round(pr.feitos * 100 / pr.total) : 0;
    return '<div class="progresso"><div style="width:' + pct + '%"></div></div>' +
      '<p class="sub progresso-texto">' + pr.feitos + ' de ' + pr.total + ' jogos feitos' + (extra || '') + '</p>';
  }

  /* o campeonato aberto neste aparelho ja aparece no cartao "Continuar", entao sai da lista */
  function listaSalas() {
    var outras = (salas.itens || []).filter(function (s) { return s.codigo !== E.codigo; });
    var h = '<div class="titulo-secao">' + (E.camp ? 'Outros campeonatos' : 'Entrar num campeonato') + '</div>';
    if (!salas.itens) {
      return h + '<div class="vazio">' + (salas.erro ? 'não consegui buscar a lista: ' + esc(salas.erro) : 'buscando...') + '</div>';
    }
    if (!outras.length) return E.camp ? '' : h + '<div class="vazio">nenhum campeonato por enquanto</div>';
    return h + outras.map(function (s) {
      return '<button class="jogo sala-item" data-acao="abrir-sala" data-arg="' + esc(s.codigo) + '">' +
        '<div class="times"><b>' + esc(s.nome) + '</b><br>' +
        '<span class="fora">' + s.jogadores + ' jogadores · ' +
        (s.encerrado ? 'encerrado' : s.feitos + ' de ' + s.total + ' jogos') + '</span></div>' +
        '<span class="entrar">Entrar ›</span>' +
        '</button>';
    }).join('');
  }

  /* ---------------- novo campeonato ---------------- */
  function viewNovo() {
    var r = rascunho;
    var minimo = r.tamanhoTime * 2;
    var h = '<h2 class="titulo-tela">Novo campeonato</h2>';

    h += '<div class="cartao">' +
      '<div class="passo"><span class="passo-n">1</span>Quem vai jogar?</div>' +
      '<div class="linha-botoes" style="margin-bottom:12px">' +
      '<input id="fNovoJogador" class="entrada" placeholder="nome do jogador" enterkeyhint="done" style="flex:2">' +
      '<button class="botao pequeno" data-acao="add-jogador" style="flex:0 0 auto">+ Adicionar</button>' +
      '</div>' +
      '<div class="chips">' +
      (r.nomes.length ? r.nomes.map(function (n, i) {
        return '<span class="chip on">' + esc(n) +
          '<button class="x" data-acao="rm-jogador" data-arg="' + i + '" aria-label="remover ' + esc(n) + '">×</button></span>';
      }).join('') : '<span class="dica" style="margin:0">ninguém ainda — digite um nome e toque em Adicionar</span>') +
      '</div></div>';

    h += '<div class="cartao">' +
      '<div class="passo"><span class="passo-n">2</span>Como vai ser?</div>' +
      '<label class="campo"><span>Nome do campeonato</span>' +
      '<input id="fNome" value="' + esc(r.nome) + '" data-campo="nome" placeholder="CLT — Temporada 1"></label>' +
      '<div class="campo"><span>Cada jogo é de</span><div class="segmentado">' +
      '<button class="' + (r.tamanhoTime === 2 ? 'on' : '') + '" data-acao="formato" data-arg="2">Duplas<small>2 contra 2</small></button>' +
      '<button class="' + (r.tamanhoTime === 3 ? 'on' : '') + '" data-acao="formato" data-arg="3">Trios<small>3 contra 3</small></button>' +
      '</div></div>' +
      '<div class="linha-botoes">' +
      '<label class="campo" style="flex:1"><span>Quantos jogos</span>' +
      '<input type="number" inputmode="numeric" min="1" max="200" value="' + r.totalJogos + '" data-campo="totalJogos"></label>' +
      '<label class="campo" style="flex:1"><span>Aposta por pessoa (R$)</span>' +
      '<input type="number" inputmode="numeric" min="0" step="1" value="' + r.valorAposta + '" data-campo="valorAposta"></label>' +
      '</div></div>';

    if (E.backend === 'ok') {
      h += '<div class="cartao">' +
        '<div class="passo"><span class="passo-n">3</span>Onde vai acompanhar?</div>' +
        '<div class="segmentado">' +
        '<button class="' + (r.online ? 'on' : '') + '" data-acao="online" data-arg="1">Todo mundo<small>cada um no seu celular</small></button>' +
        '<button class="' + (r.online ? '' : 'on') + '" data-acao="online" data-arg="0">Só aqui<small>só neste celular</small></button>' +
        '</div>' +
        (r.online
          ? '<label class="campo" style="margin:14px 0 6px"><span>Senha para entrar</span>' +
            '<input value="' + esc(r.senha) + '" data-campo="senha" placeholder="ex.: 1234" autocomplete="off"></label>' +
            '<p class="dica" style="margin:0">O campeonato aparece na tela inicial de todo mundo. Quem souber a senha entra.</p>'
          : '') +
        '</div>';
    }

    if (r.nomes.length >= minimo) {
      h += resumoRodizio();
      h += '<button class="botao primario grande" data-acao="criar-campeonato">Criar e começar</button>';
    } else {
      h += '<div class="aviso">Adicione pelo menos ' + minimo + ' jogadores para ' +
        (r.tamanhoTime === 2 ? 'duplas' : 'trios') + ' (falta' + (minimo - r.nomes.length > 1 ? 'm ' : ' ') +
        (minimo - r.nomes.length) + ').</div>';
    }
    return h;
  }

  function resumoRodizio() {
    var r = rascunho;
    var ids = r.nomes.map(function (n, i) { return 'p' + i; });
    var st = SC.estatisticasRodizio(SC.gerarRodizio(ids, r.tamanhoTime, r.totalJogos, 7), ids);
    var faixaJogos = st.minJogos === st.maxJogos ? st.minJogos + ' jogos'
      : 'de ' + st.minJogos + ' a ' + st.maxJogos + ' jogos';
    return '<p class="dica centro">Cada pessoa vai jogar <b>' + faixaJogos + '</b>' +
      (r.valorAposta ? ' · pote de <b>' + moeda(r.nomes.length * r.valorAposta) + '</b>' : '') + '</p>';
  }

  /* ---------------- campeonato ----------------
   * Tres abas: Jogar (o que fazer agora), Classificacao e Jogos (a tabela inteira).
   * O que e de uso raro (registro, equilibrio do rodizio, backup) fica no menu ⋯. */
  var filtroJogos = 'faltam';
  var ABAS = [['jogar', 'Jogar'], ['tabela', 'Classificação'], ['jogos', 'Jogos']];

  function viewCampeonato() {
    var c = E.camp;
    var aba = ABAS.some(function (a) { return a[0] === E.aba; }) ? E.aba : 'jogar';
    var h = '<h2 class="titulo-tela">' + esc(c.nome) + '</h2>' +
      barraProgresso(S.progresso(), c.valorAposta ? ' · pote ' + moeda(c.jogadores.length * c.valorAposta) : '');

    h += '<div class="abas">' + ABAS.map(function (a) {
      return '<button class="' + (aba === a[0] ? 'on' : '') + '" data-acao="aba" data-arg="' + a[0] + '">' + a[1] + '</button>';
    }).join('') + '</div>';

    if (aba === 'tabela') h += viewTabela();
    else if (aba === 'jogos') h += viewJogos();
    else h += viewJogar();
    return h;
  }

  function confronto(j, pontos) {
    return '<div class="confronto">' +
      '<div class="lado a">' + esc(S.nomes(j.a)) + (pontos ? '<b>' + pontos.A + '</b>' : '') + '</div>' +
      '<div class="contra">contra</div>' +
      '<div class="lado b">' + esc(S.nomes(j.b)) + (pontos ? '<b>' + pontos.B + '</b>' : '') + '</div>' +
      '</div>';
  }

  function viewJogar() {
    var c = E.camp;
    var tab = S.classificacao();
    var prox = S.proximoJogo();
    var adi = S.adiados();
    var h = '';

    S.emAndamento().forEach(function (j) {
      var p = S.partida(j.n);
      var falta = S.ausentesDoJogo(j);
      h += '<div class="cartao cartao-jogo pausado">' +
        '<p class="rotulo">⏸ Jogo ' + j.n + ' parado no meio</p>' +
        confronto(j, p ? p.pontos : null) +
        (falta.length
          ? '<p class="dica centro" style="margin:0">Esperando ' + esc(S.nomes(falta)) + ' voltar</p>'
          : '<button class="botao primario grande" data-acao="abrir-partida" data-arg="' + j.n + '">Continuar jogo</button>') +
        '</div>';
    });

    if (c.encerrado && !prox) {
      var emp = S.empatadosNoTopo();
      if (emp.length) {
        h += '<div class="cartao centro" style="border-color:var(--ouro)"><div class="confete">⚔️</div>' +
          '<h2>Empate na liderança</h2><p class="sub">' +
          emp.map(function (l) { return esc(l.nome); }).join(', ') +
          ' terminaram com ' + emp[0].v + ' vitórias e saldo ' + emp[0].sd + '. Hora do desempate (X1).</p>' +
          '<div style="height:12px"></div>' +
          '<button class="botao primario grande" data-acao="gerar-x1">Criar desempate (' +
          (emp.length * (emp.length - 1) / 2) + ' jogo' + (emp.length > 2 ? 's' : '') + ')</button></div>';
      } else if (tab.length) {
        h += '<div class="cartao centro" style="border-color:var(--ouro)"><div class="confete">🏆</div>' +
          '<p class="sub">Campeão</p><h2 style="font-size:28px;color:var(--ouro)">' + esc(tab[0].nome) + '</h2>' +
          (c.valorAposta ? '<p class="sub">leva ' + moeda(c.jogadores.length * c.valorAposta) + '</p>' : '') +
          '<p class="sub" style="margin-top:8px">Todos os ' + c.jogos.length + ' jogos foram disputados.</p></div>';
      }
    } else if (prox && prox.status !== 'em_andamento') {
      h += '<div class="cartao cartao-jogo">' +
        '<p class="rotulo">Próximo jogo · ' + prox.n + ' de ' + c.jogos.length + (prox.tipo === 'x1' ? ' · desempate' : '') + '</p>' +
        confronto(prox) +
        (prox.fora && prox.fora.length
          ? '<p class="dica centro">Descansa' + (prox.fora.length > 1 ? 'm' : '') + ': ' + esc(S.nomes(prox.fora)) + '</p>' : '') +
        '<button class="botao primario grande" data-acao="conferir-presenca" data-arg="' + prox.n + '">▶ Começar jogo</button>' +
        '</div>';
    } else if (!prox) {
      h += '<div class="aviso">Nenhum jogo pode começar agora: os que faltam têm alguém que não está aqui. ' +
        'Marque abaixo quem chegou.</div>';
    }

    if (adi.length) {
      h += '<p class="dica">⏭️ ' + adi.length + ' jogo' + (adi.length > 1 ? 's ficaram' : ' ficou') +
        ' para depois porque falta gente. Volta' + (adi.length > 1 ? 'm' : '') + ' sozinho' + (adi.length > 1 ? 's' : '') +
        ' quando a pessoa chegar.</p>';
    }

    var ativos = c.jogadores.filter(function (j) { return !j.inativo; });
    h += '<div class="titulo-secao">Quem está aqui hoje?</div>' +
      '<p class="dica">Toque no nome de quem não veio. Os jogos dessa pessoa ficam para depois.</p>' +
      '<div class="chips">' + ativos.map(function (j) {
        var on = S.presente(j.id);
        return '<button class="chip ' + (on ? 'on' : 'off') + '" data-acao="presenca" data-arg="' + j.id + '">' +
          (on ? '✓ ' : '✕ ') + esc(j.nome) + '</button>';
      }).join('') + '</div>';
    return h;
  }

  function viewTabela() {
    var tab = S.classificacao();
    return '<div class="cartao" style="padding:6px 10px"><table class="tabela">' +
      '<tr><th class="pos"></th><th class="nome">Jogador</th><th>Vitórias</th><th>Jogos</th><th>Saldo</th></tr>' +
      tab.map(function (l, i) {
        var lider = i === 0 && l.j;
        return '<tr class="' + (lider ? 'top1' : '') + '">' +
          '<td class="pos">' + (lider ? '👑' : i + 1) + '</td>' +
          '<td class="nome">' + esc(l.nome) + (l.inativo ? ' <small>saiu do campeonato</small>' : '') + '</td>' +
          '<td class="destaque">' + l.v + '</td><td>' + l.j + '</td>' +
          '<td>' + (l.sd > 0 ? '+' : '') + l.sd + '</td></tr>';
      }).join('') + '</table></div>' +
      '<p class="dica">Quem tem mais vitórias fica na frente. Se empatar, vale o saldo (pontos feitos menos pontos sofridos).</p>';
  }

  function viewJogos() {
    var c = E.camp;
    var faltam = c.jogos.filter(function (j) { return j.status !== 'concluido' && j.status !== 'pulado'; });
    var feitos = c.jogos.filter(function (j) { return j.status === 'concluido' || j.status === 'pulado'; }).reverse();
    var lista = filtroJogos === 'feitos' ? feitos : faltam;
    return '<div class="segmentado compacto">' +
      '<button class="' + (filtroJogos === 'feitos' ? '' : 'on') + '" data-acao="filtro-jogos" data-arg="faltam">Faltam (' + faltam.length + ')</button>' +
      '<button class="' + (filtroJogos === 'feitos' ? 'on' : '') + '" data-acao="filtro-jogos" data-arg="feitos">Já jogados (' + feitos.length + ')</button>' +
      '</div>' +
      (lista.length ? lista.map(cartaoJogo).join('') : '<div class="vazio">nada por aqui ainda</div>') +
      (filtroJogos === 'feitos' && feitos.length ? '<p class="dica centro">Toque num jogo para ver como foi ou corrigir o placar.</p>' : '');
  }

  /* registro de auditoria do campeonato inteiro: quem presenteou, iniciou,
     cancelou, mudou config etc — o mao-a-mao de cada partida fica dentro
     dela mesma (historico()/modalJogoFeito), pra nao duplicar aqui */
  function viewRegistro() {
    var registro = S.log();
    if (!registro.length) return '<div class="vazio">nenhuma ação registrada ainda</div>';
    return '<ul class="historico" style="max-height:55vh">' + listaHistorico(registro) + '</ul>';
  }

  function cartaoJogo(j) {
    var feito = j.status === 'concluido';
    var pulado = j.status === 'pulado';
    var aberto = j.status === 'em_andamento';
    var p = aberto ? S.partida(j.n) : null;
    var ausentes = S.ausentesDoJogo(j);
    var classe = 'jogo' + (feito ? ' feito' : '') + (pulado ? ' pulado' : '') +
      (ausentes.length && !feito && !pulado ? ' bloqueado' : '') + (aberto ? ' pausada' : '');
    var miolo =
      '<div class="num">' + (feito ? '✓' : pulado ? '⏭' : (aberto ? '⏸' : j.n)) + '</div>' +
      '<div class="times">' +
      '<span class="' + (j.vencedor === 'A' ? 'ganhou' : '') + '">' + esc(S.nomes(j.a)) + '</span>' +
      '<span class="vs"> contra </span>' +
      '<span class="' + (j.vencedor === 'B' ? 'ganhou' : '') + '">' + esc(S.nomes(j.b)) + '</span>' +
      (j.tipo === 'x1' ? '<div class="fora">desempate</div>' : '') +
      (pulado ? '<div class="fora">pulado — alguém saiu do campeonato</div>' : '') +
      (!feito && !pulado && ausentes.length ? '<div class="fora">esperando ' + esc(S.nomes(ausentes)) + '</div>' : '') +
      '</div>';
    if (feito) {
      return '<button class="' + classe + ' sala-item" data-acao="ver-jogo" data-arg="' + j.n + '">' + miolo +
        '<div class="res">' + j.placar.A + '<span style="color:var(--texto-fraco)"> × </span>' + j.placar.B + '</div></button>';
    }
    if (aberto) {
      miolo += '<div class="res">' + (p ? p.pontos.A + '×' + p.pontos.B : '—') + '</div>' +
        (ausentes.length ? '' : '<button class="botao pequeno primario" data-acao="abrir-partida" data-arg="' + j.n + '">Continuar</button>');
    }
    return '<div class="' + classe + '">' + miolo + '</div>';
  }

  function viewEquilibrio() {
    var c = E.camp;
    var ids = c.jogadores.map(function (j) { return j.id; });
    var st = SC.estatisticasRodizio(c.jogos, ids);
    var h = '<div class="cartao" style="padding:6px 10px"><div class="rolagem"><table class="tabela">' +
      '<tr><th class="nome">Jogador</th><th>Jogos</th><th>Fora</th><th class="nome">Parceiros</th></tr>';
    ids.forEach(function (i) {
      var d = st.porJogador[i];
      var parc = Object.keys(d.parceiros).map(function (k) {
        return S.nome(k) + ' ' + d.parceiros[k] + 'x';
      }).join(', ');
      h += '<tr><td class="nome">' + esc(S.nome(i)) + '</td><td>' + d.jogos + '</td><td>' + d.folgas + '</td>' +
        '<td class="nome" style="font-weight:400;font-size:12px">' + esc(parc) + '</td></tr>';
    });
    h += '</table></div></div>';
    h += '<div class="cartao"><p class="sub">' +
      (st.minJogos === st.maxJogos
        ? '✅ Todo mundo joga exatamente <b>' + st.minJogos + '</b> jogos.'
        : 'Diferença de jogos entre o que mais joga e o que menos joga: <b>' + (st.maxJogos - st.minJogos) + '</b>.') +
      '<br>' +
      (st.minDupla === st.maxDupla
        ? '✅ Toda combinação de parceiros aparece <b>' + st.minDupla + '</b> vezes.'
        : 'Cada combinação de parceiros aparece entre <b>' + st.minDupla + '</b> e <b>' + st.maxDupla + '</b> vezes.') +
      '</p></div>';
    return h;
  }

  /* ---------------- partida ---------------- */
  function viewPartida(p) {
    var m = p.mao;
    var h = '';
    var lider = p.pontos.A === p.pontos.B ? null : (p.pontos.A > p.pontos.B ? 'A' : 'B');
    var doCampeonato = !!E.jogoAberto;

    h += '<div class="placar">' +
      placarTime(p, 'A', lider) +
      '<div class="placar-meio"><div class="vale">mão vale</div><div class="valor">' + m.valor + '</div></div>' +
      placarTime(p, 'B', lider) +
      '</div>';

    h += '<div class="faixa-mao">mão ' + p.numeroMao + ' · partida até ' + p.limite + ' pontos' +
      (doCampeonato ? ' · jogo ' + p.origem.n + (p.origem.x1 ? ' (X1)' : '') : '') +
      (E.codigo && doCampeonato ? ' · <span class="ponto-vivo"></span>ao vivo para todos' : '') + '</div>';

    h += faixaNarrador();

    if (p.vencedor) {
      h += '<div class="cartao" style="text-align:center;border-color:var(--ouro)">' +
        '<div class="confete">🏆</div>' +
        '<h2 style="color:var(--ouro)">' + esc(p.times[p.vencedor].nome) + ' venceu!</h2>' +
        '<p class="sub">' + p.pontos.A + ' x ' + p.pontos.B + '</p>' +
        '<div style="height:14px"></div>' +
        (doCampeonato
          ? '<button class="botao primario grande" data-acao="finalizar">Salvar no campeonato</button>'
          : '<button class="botao primario grande" data-acao="nova-avulsa">Jogar de novo</button>') +
        '<div style="height:8px"></div>' +
        '<button class="botao fantasma" data-acao="lance" data-arg="desfazer">Desfazer última ação</button>' +
        '</div>';
      h += historico(p);
      return h;
    }

    if (m.especial === 'ferro') {
      h += '<div class="aviso">🔥 <b>MÃO DE FERRO</b> — ' + (p.limite - 1) + ' a ' + (p.limite - 1) +
        '. Vale ' + m.valor + ' pontos, ninguém pede truco e quem vencer leva a partida.</div>';
    }

    if (m.decisao11) {
      var adv = M.outro(m.decisao11);
      h += '<div class="aposta">' +
        '<div class="frase"><em>MÃO DE 11</em> para ' + esc(p.times[m.decisao11].nome) + '</div>' +
        '<div class="dica">Os parceiros podem ver as cartas um do outro. Se jogarem, a mão vale 3 e não pode pedir truco.</div>' +
        '<div class="grade-acoes duas">' +
        '<button class="botao ok" data-acao="lance" data-arg="m11:jogar">Vamos jogar (vale 3)</button>' +
        '<button class="botao perigo" data-acao="lance" data-arg="m11:correr">Correr (+1 para ' + esc(p.times[adv].nome) + ')</button>' +
        '</div></div>';
      h += rodape();
      h += historico(p);
      return h;
    }

    if (m.aposta) {
      var quemPediu = m.aposta.time, quemResponde = M.outro(quemPediu);
      var prox = M.proximo(m.aposta.valor);
      h += '<div class="aposta">' +
        '<div class="frase">' + esc(p.times[quemPediu].nome) + ' pediu <em>' + M.nomeAposta(m.aposta.valor) + '</em></div>' +
        '<div class="dica">' + esc(p.times[quemResponde].nome) + ' responde — se correr, ' +
        esc(p.times[quemPediu].nome) + ' leva ' + m.aposta.anterior + ' ponto' + (m.aposta.anterior > 1 ? 's' : '') + '.</div>' +
        '<div class="grade-acoes">' +
        '<div class="grade-acoes duas">' +
        '<button class="botao perigo" data-acao="lance" data-arg="correr">Correu</button>' +
        '<button class="botao ok" data-acao="lance" data-arg="aceitar">Aceitou (' + m.aposta.valor + ')</button>' +
        '</div>' +
        (prox ? '<button class="botao-truco" data-acao="lance" data-arg="aumentar">Pediu ' + M.nomeAposta(prox) + ' 🔥</button>' : '') +
        '</div></div>';
      h += rodape();
      h += historico(p);
      return h;
    }

    h += '<div class="titulo-secao">Quem ganhou esta mão?<span class="vale-mao">vale ' + m.valor + '</span></div>' +
      '<div class="grade-acoes duas" style="margin-bottom:18px">' +
      '<button class="botao botao-time grande a" data-acao="lance" data-arg="venceu:A">' + esc(p.times.A.nome) + '<small>+' + m.valor + '</small></button>' +
      '<button class="botao botao-time grande b" data-acao="lance" data-arg="venceu:B">' + esc(p.times.B.nome) + '<small>+' + m.valor + '</small></button>' +
      '</div>';

    if (!m.trucoBloqueado) {
      if (m.valor === 1) {
        h += '<div class="titulo-secao">Alguém pediu truco?</div>' +
          '<div class="grade-acoes duas" style="margin-bottom:14px">' +
          '<button class="botao-truco" data-acao="lance" data-arg="pedir:A">TRUCO<br><small>' + esc(p.times.A.nome) + ' pediu</small></button>' +
          '<button class="botao-truco" data-acao="lance" data-arg="pedir:B">TRUCO<br><small>' + esc(p.times.B.nome) + ' pediu</small></button>' +
          '</div>';
      } else if (m.podeAumentar && M.proximo(m.valor)) {
        h += '<div style="margin-bottom:14px">' +
          '<button class="botao-truco" style="width:100%" data-acao="lance" data-arg="pedir:' + m.podeAumentar + '">' +
          esc(p.times[m.podeAumentar].nome) + ' pediu ' + M.nomeAposta(M.proximo(m.valor)) + ' 🔥</button>' +
          '<div class="faixa-mao" style="margin:8px 0 0">só quem aceitou o último pedido pode aumentar</div></div>';
      } else if (m.valor >= 12) {
        h += '<div class="aviso">Mão valendo 12 — não tem mais pra onde subir.</div>';
      }
    }

    h += rodape();
    h += historico(p);
    return h;
  }

  function placarTime(p, t, lider) {
    var membros = (p.times[t].jogadores || []).join(' + ');
    var mostra = membros && membros !== p.times[t].nome;
    return '<div class="placar-time ' + t.toLowerCase() + (lider === t ? ' lider' : '') + '">' +
      '<div class="nome">' + esc(p.times[t].nome) + '</div>' +
      '<div class="membros">' + (mostra ? esc(membros) : '&nbsp;') + '</div>' +
      '<div class="pts">' + p.pontos[t] + '</div>' +
      '<div class="ajuste-pontos">' +
      '<button class="botao-ajuste" data-acao="lance" data-arg="ajuste:' + t + ':-1" aria-label="tirar um ponto de ' + esc(p.times[t].nome) + '">−</button>' +
      '<button class="botao-ajuste" data-acao="lance" data-arg="ajuste:' + t + ':1" aria-label="somar um ponto para ' + esc(p.times[t].nome) + '">+</button>' +
      '</div></div>';
  }

  /* narrador de voz + botões de zoar: ficam recolhidos por padrão pra não poluir a tela */
  var zoarAberto = false;
  var ANIMAIS = [
    { chave: 'pato', emoji: '🦆' }, { chave: 'vaca', emoji: '🐄' },
    { chave: 'galo', emoji: '🐓' }, { chave: 'porco', emoji: '🐷' },
    { chave: 'burro', emoji: '🫏' }
  ];
  function faixaNarrador() {
    var narrador = CLT.narrador;
    var ligado = narrador && narrador.suportado() && narrador.ativo();
    var h = '<div class="faixa-narrador">' +
      '<button class="botao-mini' + (ligado ? ' on' : '') + '" data-acao="narrador-toggle"' +
      (narrador && narrador.suportado() ? '' : ' disabled title="esse navegador não tem narrador por voz"') + '>' +
      (ligado ? '🔊 Narrador' : '🔈 Narrador') + '</button>' +
      '<button class="botao-mini' + (zoarAberto ? ' on' : '') + '" data-acao="zoar-toggle">🎪 Zoar</button>' +
      '</div>';
    if (zoarAberto) {
      h += '<div class="faixa-zoar">' + ANIMAIS.map(function (a) {
        return '<button class="botao-animal" data-acao="tocar-som" data-arg="' + a.chave + '" title="' + a.chave + '">' + a.emoji + '</button>';
      }).join('') + '</div>';
    }
    return h;
  }

  /* cancelar a partida (apaga o placar) fica no menu ⋯, longe do dedo */
  function rodape() {
    return '<div class="linha-botoes" style="margin-bottom:12px">' +
      '<button class="botao fantasma pequeno" data-acao="lance" data-arg="desfazer">↩ Desfazer</button>' +
      (E.jogoAberto
        ? '<button class="botao fantasma pequeno" data-acao="pausar">⏸ Pausar</button>'
        : '<button class="botao fantasma pequeno" data-acao="sair-avulsa">Sair</button>') +
      '</div>';
  }

  var historicoAberto = false;
  function historico(p) {
    if (!p.historico.length) return '';
    if (!historicoAberto) {
      return '<button class="botao fantasma pequeno" data-acao="historico-toggle" style="margin-bottom:14px">📜 Ver o que rolou (' + p.historico.length + ')</button>';
    }
    return '<div class="titulo-secao">O que rolou' +
      '<button class="botao-mini" data-acao="historico-toggle">ocultar</button></div>' +
      '<div class="cartao"><ul class="historico">' + listaHistorico(p.historico) + '</ul></div>';
  }

  /* usado tanto pelo historico mao-a-mao de uma partida (tem placar) quanto
     pelo registro geral do campeonato (tem so data/hora) */
  function formatarQuando(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function listaHistorico(lista) {
    return lista.slice(0, 80).map(function (l) {
      var extra = l.placar != null ? l.placar : formatarQuando(l.em);
      return '<li>' + (l.autor ? '<span class="autor">' + esc(l.autor) + '</span> ' : '') +
        '<b>' + esc(l.texto) + '</b>' + (extra ? ' · <span>' + esc(extra) + '</span>' : '') + '</li>';
    }).join('');
  }

  /* ---------------- narrador: compara o placar antes/depois e fala o que mudou ----------------
   * Roda no render(), pra pegar tanto jogadas feitas neste aparelho quanto as que
   * chegaram da sala pela sincronização — cada aparelho narra so o que ele mesmo esta vendo. */
  var FRASE_NIVEL = { 3: 'no truco', 6: 'na seizada', 9: 'na novena', 12: 'na dozena' };
  function fraseNivel(valor) { return FRASE_NIVEL[valor] || ('em ' + valor); }
  function nomeParaFala(nomeTime) { return String(nomeTime || '').replace(/\s*\+\s*/g, ' e '); }

  function chavePartidaAtual() {
    if (E.jogoAberto) return 'jogo:' + E.jogoAberto;
    if (E.avulsa) return 'avulsa:' + E.avulsa.id;
    return null;
  }
  function snapshotNarracao(p) {
    return {
      A: p.pontos.A, B: p.pontos.B,
      valor: p.mao ? p.mao.valor : null,
      especial: p.mao ? p.mao.especial : null,
      decisao11: p.mao ? p.mao.decisao11 : null,
      apostaValor: p.mao && p.mao.aposta ? p.mao.aposta.valor : null,
      vencedor: p.vencedor
    };
  }

  var ultimoEstadoNarrado = null; // { chave, dados }
  function reiniciarNarracaoDaTela() {
    ultimoEstadoNarrado = null;
    historicoAberto = false;
    zoarAberto = false;
  }

  function verificarNarracao(p) {
    var narrador = CLT.narrador;
    var chave = chavePartidaAtual();
    if (!p || !chave || !narrador) { ultimoEstadoNarrado = null; return; }

    var atual = snapshotNarracao(p);
    var antes = (ultimoEstadoNarrado && ultimoEstadoNarrado.chave === chave) ? ultimoEstadoNarrado.dados : null;
    ultimoEstadoNarrado = { chave: chave, dados: atual };
    if (!antes || !narrador.ativo()) return; // tela recem-aberta: nao narra o passado

    var terminouAgora = atual.vencedor && !antes.vencedor;
    var quemGanhou = atual.A > antes.A ? 'A' : (atual.B > antes.B ? 'B' : null);

    if (quemGanhou) {
      if (antes.apostaValor) {
        var quemCorreu = quemGanhou === 'A' ? 'B' : 'A';
        narrador.narrarComSom(nomeParaFala(p.times[quemCorreu].nome) + ' perdeu ' + fraseNivel(antes.apostaValor), 'pato');
      } else if (antes.decisao11) {
        narrador.falar(nomeParaFala(p.times[antes.decisao11].nome) + ' correu da mão de onze');
      } else if (antes.especial !== 'ferro' && antes.especial !== 'm11' && antes.valor >= 3) {
        narrador.narrarComSom(nomeParaFala(p.times[quemGanhou].nome) + ' ganhou ' + fraseNivel(antes.valor), 'zoeira');
      }
      if (!terminouAgora) {
        narrador.falar(atual.A === atual.B
          ? 'O placar está empatado em ' + atual.A
          : 'O placar está ' + Math.max(atual.A, atual.B) + ' a ' + Math.min(atual.A, atual.B) +
            ' para ' + nomeParaFala(p.times[atual.A > atual.B ? 'A' : 'B'].nome));
      }
    }

    if (!atual.vencedor) {
      if (atual.especial === 'm11' && antes.especial !== 'm11') {
        narrador.falar('Mão de onze pra ' + nomeParaFala(p.times[atual.decisao11].nome) + ' — decide aí!');
      } else if (atual.especial === 'ferro' && antes.especial !== 'ferro') {
        narrador.falar('Mão de ferro! Ninguém pede truco, vale tudo!');
      }
    }

    if (terminouAgora) {
      narrador.narrarComSom(
        'Fim de jogo! ' + nomeParaFala(p.times[atual.vencedor].nome) + ' venceu por ' +
        Math.max(atual.A, atual.B) + ' a ' + Math.min(atual.A, atual.B),
        'fimdejogo'
      );
    }
  }

  /* ---------------- modais ---------------- */
  function modalPresenca(n) {
    var j = S.jogo(n);
    if (!j) return;
    abrirModal(
      '<h3>Está todo mundo na mesa?</h3>' +
      confronto(j) +
      '<button class="botao primario grande" data-acao="iniciar" data-arg="' + j.n + '">Sim, começar</button>' +
      '<div style="height:8px"></div>' +
      '<button class="botao" data-acao="marcar-falta" data-arg="' + j.n + '">Faltou alguém</button>' +
      '<div style="height:8px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Cancelar</button>'
    );
  }

  function modalFalta(n) {
    var c = E.camp;
    abrirModal(
      '<h3>Quem não está?</h3>' +
      '<p>Toque em quem faltou. Os jogos dessa pessoa ficam para depois e o app pula para o próximo.</p>' +
      '<div class="chips" style="margin-bottom:16px">' + c.jogadores.map(function (jg) {
        var on = S.presente(jg.id);
        return '<button class="chip ' + (on ? 'on' : 'off') + '" data-acao="presenca-modal" data-arg="' + jg.id + ':' + n + '">' +
          (on ? '✓ ' : '✕ ') + esc(jg.nome) + '</button>';
      }).join('') + '</div>' +
      '<button class="botao primario" data-acao="fechar-e-render">Pronto</button>'
    );
  }

  function modalAvulsa() {
    abrirModal(
      '<h3>Partida rápida</h3><p>Só o placar de um jogo, salvo neste celular.</p>' +
      '<label class="campo"><span>Nome de um time</span><input id="avA" value="Nós"></label>' +
      '<label class="campo"><span>Nome do outro time</span><input id="avB" value="Eles"></label>' +
      '<button class="botao primario" data-acao="criar-avulsa">Começar partida</button>'
    );
  }

  function modalSenha(codigo, nome, motivo) {
    abrirModal(
      '<h3>' + esc(nome || 'Entrar no campeonato') + '</h3>' +
      '<p>' + esc(motivo || 'Digite a senha do campeonato — quem criou sabe qual é.') + '</p>' +
      '<label class="campo"><span>Senha</span>' +
      '<input id="fSenha" type="password" autocomplete="off" data-arg="' + esc(codigo) + '"></label>' +
      '<button class="botao primario" data-acao="confirmar-senha" data-arg="' + esc(codigo) + '">Entrar</button>' +
      '<div style="height:8px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Cancelar</button>'
    );
  }

  function modalApelido(motivo) {
    abrirModal(
      '<h3>Como você quer aparecer?</h3>' +
      '<p>' + esc(motivo || 'Esse apelido aparece no histórico de jogadas, pra saber quem marcou o quê. Fica salvo só neste aparelho — dá pra trocar quando quiser.') + '</p>' +
      '<label class="campo"><span>Apelido</span>' +
      '<input id="fApelido" value="' + esc(S.apelido() || '') + '" placeholder="ex.: Rai" maxlength="30"></label>' +
      '<button class="botao primario" data-acao="salvar-apelido">Salvar</button>' +
      '<div style="height:8px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Pular por agora</button>'
    );
  }

  function modalJogadores() {
    var c = E.camp;
    abrirModal(
      '<h3>Jogadores</h3>' +
      '<p>Renomeie ou marque quem saiu de vez do campeonato — os jogos pendentes dessa pessoa viram "pulado" e o campeonato consegue fechar mesmo sem ela.</p>' +
      c.jogadores.map(function (j) {
        return '<div class="linha-jogador' + (j.inativo ? ' inativo' : '') + '">' +
          '<span class="nome-jogador">' + esc(j.nome) + (j.inativo ? ' <small>fora do campeonato</small>' : '') + '</span>' +
          '<div class="linha-botoes" style="gap:6px;flex:none">' +
          '<button class="botao pequeno fantasma" data-acao="renomear-jogador" data-arg="' + j.id + '" title="renomear">✎</button>' +
          (j.inativo
            ? '<button class="botao pequeno ok" data-acao="reativar-jogador" data-arg="' + j.id + '">Voltou</button>'
            : '<button class="botao pequeno perigo" data-acao="inativar-jogador" data-arg="' + j.id + '">Saiu</button>') +
          '</div></div>';
      }).join('') +
      '<div style="height:8px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Fechar</button>'
    );
  }

  /* jogo ja salvo: mostra o mao-a-mao e a opcao de corrigir */
  function modalJogoFeito(n) {
    var j = S.jogo(n);
    if (!j) return;
    abrirModal(
      '<h3>Jogo ' + j.n + '</h3>' +
      confronto(j, j.placar) +
      (j.historico && j.historico.length
        ? '<p class="rotulo">Como foi</p><ul class="historico" style="max-height:40vh;margin-bottom:14px">' + listaHistorico(j.historico) + '</ul>'
        : '') +
      (j.status === 'concluido'
        ? '<button class="botao" data-acao="reabrir" data-arg="' + j.n + '">✎ Corrigir o placar</button><div style="height:8px"></div>'
        : '') +
      '<button class="botao fantasma" data-acao="fechar">Fechar</button>'
    );
  }

  function modalRegras() {
    var ferro = E.camp ? E.camp.config.maoDeFerroVale : 3;
    abrirModal(
      '<h3>Regras do truco</h3>' +
      '<ul class="regras">' +
      '<li>Ganha quem fizer <b>12 pontos</b> primeiro.</li>' +
      '<li>Cada mão vale <b>1 ponto</b>. Com truco vale 3, e dá pra subir pra 6, 9 e 12.</li>' +
      '<li>Quem <b>corre</b> entrega o valor de antes: correu do truco dá 1, do seis dá 3, do nove dá 6, do doze dá 9.</li>' +
      '<li>Só quem aceitou o último pedido pode aumentar.</li>' +
      '<li><b>Mão de 11</b>: o time que chega a 11 olha as cartas do parceiro e decide se joga (vale 3, sem truco) ou corre (o outro time ganha 1).</li>' +
      '<li><b>11 a 11</b> (mão de ferro): vale ' + ferro + ' e quem ganhar leva a partida.</li>' +
      '</ul>' +
      '<button class="botao fantasma" data-acao="fechar">Fechar</button>'
    );
  }

  function modalConvidar() {
    abrirModal(
      '<h3>Chamar mais gente</h3>' +
      '<p>Para entrar, a pessoa abre o site, toca em <b>' + esc(E.camp.nome) + '</b> na lista e digita a senha. ' +
      'Ou mande o link direto, que já abre o pedido de senha:</p>' +
      '<button class="botao primario" data-acao="copiar-link">Copiar link</button>' +
      '<div style="height:8px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Fechar</button>'
    );
  }

  function modalTexto(titulo, html) {
    abrirModal('<h3>' + titulo + '</h3>' + html +
      '<div style="height:12px"></div><button class="botao fantasma" data-acao="fechar">Fechar</button>');
  }

  /* ⋯ — separado por assunto; o que quase ninguem usa fica escondido em "Mais opções" */
  var menuMais = false;
  function itemMenu(acao, icone, titulo, sub, classe) {
    return '<button class="item-menu' + (classe ? ' ' + classe : '') + '" data-acao="' + acao + '">' +
      '<span class="icone-menu">' + icone + '</span>' +
      '<span>' + titulo + (sub ? '<small>' + sub + '</small>' : '') + '</span></button>';
  }
  function grupoMenu(titulo, itens) {
    var miolo = itens.filter(Boolean).join('');
    if (!miolo) return '';
    return (titulo ? '<div class="rotulo-menu">' + titulo + '</div>' : '') + '<div class="grupo-menu">' + miolo + '</div>';
  }

  function modalMenu() {
    var temCamp = !!E.camp;
    var naPartida = E.tela === 'partida' && E.jogoAberto;
    var narrador = CLT.narrador.suportado()
      ? itemMenu('narrador-toggle', CLT.narrador.ativo() ? '🔊' : '🔈',
        'Narrador: ' + (CLT.narrador.ativo() ? 'ligado' : 'desligado'), 'fala os pontos em voz alta')
      : '';
    abrirModal(
      '<h3>Menu</h3>' +
      '<p>' + (E.codigo
        ? (E.conexao === 'ok' ? '<span class="ponto-vivo"></span>Conectado: todo mundo vê o mesmo placar.' : 'Sem conexão agora — tentando de novo.')
        : (temCamp ? 'Este campeonato está salvo só neste celular.' : '')) + '</p>' +
      (naPartida ? grupoMenu('Esta partida', [
        itemMenu('cancelar-partida', '✕', 'Cancelar esta partida', 'apaga o placar e o jogo volta para a fila', 'perigo')
      ]) : '') +
      (temCamp ? grupoMenu('Campeonato', [
        E.codigo ? itemMenu('convidar', '📨', 'Chamar mais gente', 'como os outros entram') : '',
        itemMenu('jogadores', '👥', 'Jogadores', 'mudar nome ou tirar alguém'),
        itemMenu('registro', '📜', 'Quem fez o quê', 'tudo que foi marcado, com o apelido'),
        E.codigo ? itemMenu('trocar-senha', '🔑', 'Trocar a senha') : '',
        itemMenu('sair-camp', '🚪', 'Sair do campeonato', E.codigo ? 'ele continua salvo no servidor' : 'apaga deste celular', 'perigo')
      ]) : '') +
      grupoMenu('Este celular', [
        itemMenu('apelido', '👤', 'Seu apelido: ' + (S.apelido() ? esc(S.apelido()) : 'nenhum'), 'aparece em quem fez o quê'),
        narrador
      ]) +
      '<button class="menu-mais" data-acao="menu-mais">' + (menuMais ? '▾' : '▸') + ' Mais opções</button>' +
      (menuMais ? grupoMenu('', [
        itemMenu('regras', '📖', 'Regras do truco'),
        temCamp ? itemMenu('equilibrio', '⚖️', 'Equilíbrio do rodízio', 'quantos jogos e parceiros cada um tem') : '',
        temCamp ? itemMenu('config-ferro', '⚙️', 'Mão de ferro vale ' + E.camp.config.maoDeFerroVale, 'toque para trocar entre 3 e 1') : '',
        temCamp ? itemMenu('regerar', '🎲', 'Sortear os jogos de novo', 'só antes do primeiro jogo') : '',
        temCamp ? itemMenu('exportar', '⤓', 'Salvar cópia (backup)') : '',
        itemMenu('importar', '⤒', 'Abrir cópia (backup)'),
        itemMenu('config-api', '🔌', 'Endereço do servidor', API.base() ? esc(API.base()) : 'o mesmo do site')
      ]) : '') +
      '<div style="height:12px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Fechar</button>'
    );
  }

  /* ---------------- ações ---------------- */
  function lerCampos() {
    document.querySelectorAll('[data-campo]').forEach(function (el) {
      var k = el.dataset.campo;
      var v = el.value;
      if (k === 'tamanhoTime' || k === 'totalJogos' || k === 'valorAposta') v = parseInt(v, 10) || 0;
      rascunho[k] = v;
    });
  }

  function copiar(texto, oque) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        S.avisar(oque + ' copiado', 'ok'); render();
      }, function () {
        S.avisar(texto); render();
      });
    } else {
      S.avisar(texto); render();
    }
  }

  function aplicarLance(arg) {
    var partes = String(arg).split(':');
    var l = { lance: partes[0] };
    if (partes[0] === 'pedir' || partes[0] === 'venceu') l.time = partes[1];
    if (partes[0] === 'm11') l.decisao = partes[1];
    if (partes[0] === 'ajuste') { l.time = partes[1]; l.delta = parseInt(partes[2], 10); }

    if (E.jogoAberto) {
      S.despachar(Object.assign({ tipo: 'lance', n: E.jogoAberto }, l));
    } else if (E.avulsa) {
      var r = N.lanceNaPartida(E.avulsa, l);
      if (!r.ok && r.erro) S.avisar(r.erro);
      S.salvar();
      render();
    }
  }

  function acao(nome, arg) {
    switch (nome) {
      case 'inicio': ir('inicio'); break;
      case 'novo': lerCampos(); ir('novo'); break;
      case 'campeonato': E.jogoAberto = null; ir('campeonato'); break;
      case 'fechar': fecharModal(); break;
      case 'fechar-e-render': fecharModal(); render(); break;

      case 'add-jogador': {
        lerCampos();
        var campo = document.getElementById('fNovoJogador');
        var v = (campo && campo.value || '').trim();
        if (v) {
          rascunho.nomes.push(v);
          render();
          setTimeout(function () {
            var c2 = document.getElementById('fNovoJogador');
            if (c2) c2.focus();
          }, 0);
        }
        break;
      }
      case 'rm-jogador': lerCampos(); rascunho.nomes.splice(parseInt(arg, 10), 1); render(); break;
      case 'online': lerCampos(); rascunho.online = arg === '1'; render(); break;
      case 'formato': lerCampos(); rascunho.tamanhoTime = arg === '3' ? 3 : 2; render(); break;
      case 'criar-campeonato': {
        lerCampos();
        if (rascunho.nomes.length < rascunho.tamanhoTime * 2) return;
        var online = rascunho.online && E.backend === 'ok';
        if (online && !rascunho.senha) { S.avisar('defina uma senha para a sala'); render(); return; }
        var botao = document.querySelector('[data-acao="criar-campeonato"]');
        if (botao) { botao.disabled = true; botao.textContent = 'criando...'; }
        S.criarCampeonato({
          nome: rascunho.nome, nomes: rascunho.nomes, tamanhoTime: rascunho.tamanhoTime,
          totalJogos: Math.max(1, rascunho.totalJogos), valorAposta: rascunho.valorAposta,
          senha: online ? rascunho.senha : undefined
        }, online).then(function (r) {
          if (!r.ok) { S.avisar('não consegui criar a sala: ' + r.erro); render(); return; }
          filtroJogos = 'faltam';
          render();
          if (r.online && !S.apelido()) {
            modalApelido('Antes de começar: como você quer aparecer no histórico desta sala?');
          }
        });
        break;
      }

      case 'ver-salas': fecharModal(); salas.em = 0; ir('inicio'); break;
      case 'abrir-sala': {
        if (arg === E.codigo) { ir('campeonato'); break; }
        var sala = (salas.itens || []).filter(function (x) { return x.codigo === arg; })[0];
        modalSenha(arg, sala ? sala.nome : null);
        setTimeout(function () { var f = document.getElementById('fSenha'); if (f) f.focus(); }, 0);
        break;
      }
      case 'confirmar-senha': {
        var inp = document.getElementById('fSenha');
        var senhaDigitada = inp ? inp.value : '';
        var nomeSala = modal.querySelector('h3') ? modal.querySelector('h3').textContent : null;
        var b = document.querySelector('[data-acao="confirmar-senha"]');
        if (b) { b.disabled = true; b.textContent = 'entrando...'; }
        S.entrarNaSala(arg, senhaDigitada).then(function (r) {
          if (r.ok) {
            filtroJogos = 'faltam';
            fecharModal(); render();
            if (!S.apelido()) modalApelido('Antes de começar: como você quer aparecer no histórico desta sala?');
          } else {
            S.avisar(r.erro); modalSenha(arg, nomeSala); render();
          }
        });
        break;
      }
      case 'copiar-link': copiar(location.origin + location.pathname + '?sala=' + E.codigo, 'link'); break;

      case 'avulsa': modalAvulsa(); break;
      case 'criar-avulsa': {
        var a = (document.getElementById('avA').value || 'Time A').trim();
        var bb = (document.getElementById('avB').value || 'Time B').trim();
        E.avulsa = M.criar({
          times: { A: { nome: a, jogadores: [] }, B: { nome: bb, jogadores: [] } },
          limite: 12, usarMaoDe11: true, maoDeFerroVale: 3, origem: { tipo: 'avulsa' }
        });
        E.jogoAberto = null;
        reiniciarNarracaoDaTela();
        fecharModal(); ir('partida');
        break;
      }
      case 'nova-avulsa': {
        var ant = E.avulsa;
        E.avulsa = M.criar({
          times: {
            A: { nome: ant.times.A.nome, jogadores: ant.times.A.jogadores },
            B: { nome: ant.times.B.nome, jogadores: ant.times.B.jogadores }
          },
          limite: ant.limite, usarMaoDe11: ant.usarMaoDe11,
          maoDeFerroVale: ant.maoDeFerroVale, origem: { tipo: 'avulsa' }
        });
        reiniciarNarracaoDaTela();
        S.salvar(); render();
        break;
      }
      case 'sair-avulsa': {
        if (E.avulsa && (E.avulsa.pontos.A || E.avulsa.pontos.B) && !E.avulsa.vencedor) {
          if (!confirm('Sair e descartar esta partida avulsa?')) return;
        }
        E.avulsa = null;
        ir(E.camp ? 'campeonato' : 'inicio');
        break;
      }

      case 'presenca': S.despachar({ tipo: 'presenca', jogador: arg, valor: !S.presente(arg) }); break;
      case 'presenca-modal': {
        var partes = arg.split(':');
        S.despachar({ tipo: 'presenca', jogador: partes[0], valor: !S.presente(partes[0]) })
          .then(function () { modalFalta(parseInt(partes[1], 10)); });
        break;
      }
      case 'conferir-presenca': modalPresenca(parseInt(arg, 10)); break;
      case 'marcar-falta': modalFalta(parseInt(arg, 10)); break;

      case 'iniciar': {
        var n = parseInt(arg, 10);
        fecharModal();
        S.despachar({ tipo: 'iniciar', n: n }).then(function () {
          if (S.partida(n)) { E.jogoAberto = n; reiniciarNarracaoDaTela(); ir('partida'); }
        });
        break;
      }
      case 'abrir-partida': E.jogoAberto = parseInt(arg, 10); reiniciarNarracaoDaTela(); ir('partida'); break;
      case 'pausar': E.jogoAberto = null; ir('campeonato'); break;
      case 'cancelar-partida': {
        fecharModal();
        if (!confirm('Cancelar esta partida? O placar dela será apagado e o jogo volta para a fila.')) return;
        var nn = E.jogoAberto;
        E.jogoAberto = null;
        E.tela = 'campeonato';
        S.despachar({ tipo: 'cancelar', n: nn });
        break;
      }
      case 'finalizar': {
        var nf = E.jogoAberto;
        E.jogoAberto = null;
        E.tela = 'campeonato';
        S.despachar({ tipo: 'finalizar', n: nf });
        break;
      }
      case 'lance': aplicarLance(arg); break;

      case 'aba': E.aba = arg; S.salvar(); render(); window.scrollTo(0, 0); break;
      case 'filtro-jogos': filtroJogos = arg; render(); break;
      case 'ver-jogo': modalJogoFeito(parseInt(arg, 10)); break;
      case 'regras': modalRegras(); break;
      case 'convidar': modalConvidar(); break;
      case 'registro': modalTexto('Quem fez o quê', viewRegistro()); break;
      case 'equilibrio': modalTexto('Equilíbrio do rodízio', viewEquilibrio()); break;
      case 'menu-mais': menuMais = !menuMais; modalMenu(); break;
      case 'reabrir': {
        if (confirm('Corrigir o jogo ' + arg + '? O placar salvo é apagado e o jogo volta para a fila.')) {
          fecharModal();
          S.despachar({ tipo: 'reabrir', n: parseInt(arg, 10) });
        }
        break;
      }
      case 'gerar-x1': {
        var emp = S.empatadosNoTopo();
        if (emp.length) {
          E.aba = 'jogar';
          S.despachar({ tipo: 'x1', jogadores: emp.map(function (l) { return l.id; }) });
        }
        break;
      }
      case 'regerar':
        if (!confirm('Sortear todos os jogos de novo? Só funciona se nenhum jogo começou.')) return;
        fecharModal(); S.despachar({ tipo: 'regerar' });
        break;
      case 'config-ferro':
        S.despachar({ tipo: 'config', config: { maoDeFerroVale: E.camp.config.maoDeFerroVale === 3 ? 1 : 3 } })
          .then(modalMenu);
        break;
      case 'sair-camp': {
        if (!confirm(E.codigo
          ? 'Sair da sala neste aparelho? O campeonato continua no servidor e dá para voltar pela lista da tela inicial, com a senha.'
          : 'Apagar este campeonato? Ele só existe neste aparelho.')) return;
        S.sairDaSala(); fecharModal(); render();
        break;
      }
      case 'config-api': {
        var novo = prompt('Endereço do servidor (vazio = mesmo endereço do site):', API.base() || '');
        if (novo === null) return;
        API.definirBase(novo.trim());
        fecharModal();
        location.reload();
        break;
      }

      case 'historico-toggle': historicoAberto = !historicoAberto; render(); break;
      case 'zoar-toggle': zoarAberto = !zoarAberto; render(); break;
      case 'tocar-som': CLT.narrador.tocarSom(arg); break;
      case 'narrador-toggle': {
        var ligar = !CLT.narrador.ativo();
        CLT.narrador.ativar(ligar);
        if (ligar) CLT.narrador.destravar(); // precisa ser chamado dentro do toque, senao o iPhone bloqueia o som depois
        if (!modalFundo.hidden) modalMenu(); else render();
        break;
      }

      case 'apelido': fecharModal(); modalApelido(); break;
      case 'salvar-apelido': {
        var inpApelido = document.getElementById('fApelido');
        S.definirApelido(inpApelido ? inpApelido.value : '');
        fecharModal(); render();
        break;
      }

      case 'jogadores': fecharModal(); modalJogadores(); break;
      case 'renomear-jogador': {
        var jogAtual = E.camp.jogadores.filter(function (x) { return x.id === arg; })[0];
        var novoNome = prompt('Novo nome:', jogAtual ? jogAtual.nome : '');
        if (novoNome === null) return;
        S.despachar({ tipo: 'renomear-jogador', jogador: arg, nome: novoNome }).then(function () { modalJogadores(); });
        break;
      }
      case 'inativar-jogador': {
        if (!confirm('Marcar esse jogador como fora do campeonato? Os jogos pendentes dele viram "pulado" (dá pra desfazer depois).')) return;
        S.despachar({ tipo: 'jogador-inativo', jogador: arg, valor: true }).then(function () { modalJogadores(); });
        break;
      }
      case 'reativar-jogador':
        S.despachar({ tipo: 'jogador-inativo', jogador: arg, valor: false }).then(function () { modalJogadores(); });
        break;

      case 'trocar-senha': {
        var novaSenha = prompt('Senha nova da sala (quem já está dentro vai precisar digitar a nova):', '');
        if (novaSenha === null) return;
        if (!novaSenha) { alert('A senha não pode ficar vazia.'); return; }
        fecharModal();
        S.trocarSenha(novaSenha).then(function (r) {
          S.avisar(r.ok ? 'senha trocada — avise o grupo da senha nova' : 'não consegui trocar: ' + r.erro, r.ok ? 'ok' : 'erro');
          render();
        });
        break;
      }


      case 'exportar': {
        var blob = new Blob([S.exportar()], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'clt-' + (E.camp.nome || 'campeonato').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        fecharModal();
        break;
      }
      case 'importar': {
        var inpf = document.createElement('input');
        inpf.type = 'file'; inpf.accept = 'application/json,.json';
        inpf.onchange = function () {
          var f = inpf.files[0];
          if (!f) return;
          var fr = new FileReader();
          fr.onload = function () {
            try { S.importar(fr.result); fecharModal(); ir('campeonato'); }
            catch (e) { alert('Não consegui ler esse arquivo: ' + e.message); }
          };
          fr.readAsText(f);
        };
        inpf.click();
        break;
      }
    }
  }

  /* ---------------- eventos ---------------- */
  function clique(ev) {
    var alvo = ev.target.closest && ev.target.closest('[data-acao]');
    if (!alvo || alvo.disabled) return;
    ev.preventDefault();
    acao(alvo.dataset.acao, alvo.dataset.arg);
  }
  tela.addEventListener('click', clique);
  modal.addEventListener('click', clique);

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'fNovoJogador') { ev.preventDefault(); acao('add-jogador'); }
    if (ev.target.id === 'fSenha') { ev.preventDefault(); acao('confirmar-senha', ev.target.dataset.arg); }
  });

  btnVoltar.addEventListener('click', function () {
    if (E.tela === 'partida') acao(E.jogoAberto ? 'pausar' : 'sair-avulsa');
    else if (E.tela === 'novo') ir(E.camp ? 'campeonato' : 'inicio');
    else ir('inicio');
  });
  btnMenu.addEventListener('click', modalMenu);

  /* ---------------- render ---------------- */
  function atualizarSelo() {
    if (!E.codigo) {
      selo.hidden = E.backend !== 'ausente';
      selo.className = 'selo local';
      selo.textContent = 'offline';
      return;
    }
    selo.hidden = false;
    if (E.conexao === 'ok') {
      selo.className = 'selo vivo';
      selo.innerHTML = '<span class="ponto-vivo"></span>ao vivo';
    } else {
      selo.className = 'selo caiu';
      selo.textContent = 'sem conexão';
    }
  }

  function render() {
    E = S.get();
    /* se outro aparelho encerrou ou cancelou a partida que eu estava vendo, volto pro painel */
    if (E.tela === 'partida' && E.jogoAberto && !S.partida(E.jogoAberto)) {
      E.jogoAberto = null;
      E.tela = 'campeonato';
    }
    if (E.tela === 'partida' && !E.jogoAberto && !E.avulsa) E.tela = E.camp ? 'campeonato' : 'inicio';
    if (E.tela === 'campeonato' && !E.camp) E.tela = 'inicio';

    btnVoltar.hidden = E.tela === 'inicio';
    atualizarSelo();
    mostrarTorrada();

    var p = partidaAtual();
    if (E.tela === 'partida' && p) { verificarNarracao(p); tela.innerHTML = viewPartida(p); }
    else if (E.tela === 'campeonato') tela.innerHTML = viewCampeonato();
    else if (E.tela === 'novo') tela.innerHTML = viewNovo();
    else { E.tela = 'inicio'; tela.innerHTML = viewInicio(); carregarSalas(); }

    /* o servidor pediu a senha (sala aberta antes de ter senha, ou senha trocada) */
    if (E.pedirSenha && modalFundo.hidden) {
      var ps = E.pedirSenha;
      E.pedirSenha = null;
      modalSenha(ps.codigo, ps.nome, 'Este campeonato agora pede senha (ou ela foi trocada). Digite a senha para continuar.');
    }
  }

  /* ---------------- partida ---------------- */
  S.carregar();
  E = S.get();

  var daUrl = new URLSearchParams(location.search).get('sala');
  render();
  S.iniciarSync(render);

  if (daUrl) {
    history.replaceState(null, '', location.pathname);
    if (daUrl.toUpperCase() !== E.codigo) modalSenha(daUrl.toUpperCase(), null);
  }

  CLT._debug = { S: S, M: M, SC: SC, N: N, render: render, acao: acao };
})(window.CLT);
