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
    totalJogos: 30, valorAposta: 10, online: true
  };

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
    h += '<div class="cartao">' +
      '<h2>🏆 Champions League de Truco</h2>' +
      '<p class="sub">Marcador de truco paulista — 12 pontos, escada 1 / 3 / 6 / 9 / 12 e mão de 11 — ' +
      'com campeonato de rodízio automático e placar compartilhado: todo mundo acompanha pelo próprio celular.</p>' +
      '</div>';

    if (c) {
      var pr = S.progresso();
      var tab = S.classificacao();
      h += '<div class="cartao">' +
        '<h2>' + esc(c.nome) + '</h2>' +
        '<p class="sub">' + pr.feitos + ' de ' + pr.total + ' jogos concluídos' +
        (pr.andamento ? ' · ' + pr.andamento + ' em andamento' : '') +
        ' · pote ' + moeda(c.jogadores.length * c.valorAposta) + '</p>' +
        (E.codigo ? '<p class="sub" style="margin-top:6px">Sala <b class="codigo">' + esc(E.codigo) + '</b></p>' : '') +
        (tab.length && tab[0].j ? '<p class="sub" style="margin-top:6px">Líder: <b style="color:var(--ouro)">' +
          esc(tab[0].nome) + '</b> (' + tab[0].v + ' vitórias)</p>' : '') +
        '<div style="height:12px"></div>' +
        '<button class="botao primario" data-acao="campeonato">Continuar campeonato</button>' +
        '</div>';
    }

    h += '<div class="titulo-secao">Começar</div>';
    h += '<button class="botao ' + (c ? '' : 'primario') + '" data-acao="novo" style="margin-bottom:10px">' +
      (c ? 'Criar outro campeonato' : 'Criar campeonato') + '</button>';
    if (E.backend === 'ok') {
      h += '<button class="botao" data-acao="entrar" style="margin-bottom:10px">Entrar com código da sala</button>';
    }
    h += '<button class="botao" data-acao="avulsa">Partida avulsa (só o placar)</button>';

    if (E.backend === 'ausente') {
      h += '<div class="aviso" style="margin-top:14px">Este endereço não tem servidor: o app funciona normal, ' +
        'mas só neste aparelho. Para o placar compartilhado, publique na Vercel (ou aponte para a API no menu ⋯).</div>';
    }

    h += '<div class="titulo-secao">Como o placar funciona</div>' +
      '<div class="cartao"><p class="sub">' +
      '• Mão normal vale <b>1 ponto</b>. Truco = 3, e a escada sobe para 6, 9 e 12.<br>' +
      '• Quem <b>corre</b> entrega o valor anterior: correu do truco dá 1, do seis dá 3, do nove dá 6, do doze dá 9.<br>' +
      '• Quem aceita o pedido é quem pode aumentar depois.<br>' +
      '• <b>Mão de 11</b>: o time que chega a 11 vê as cartas do parceiro e escolhe jogar (vale 3, sem truco) ou correr (dá 1 ponto).<br>' +
      '• <b>11 a 11</b>: mão de ferro, vale ' + (c ? c.config.maoDeFerroVale : 3) +
      ' e quem ganhar leva a partida.' +
      '</p></div>';
    return h;
  }

  /* ---------------- novo campeonato ---------------- */
  function viewNovo() {
    var r = rascunho;
    var minimo = r.tamanhoTime * 2;
    var h = '<div class="cartao"><h2>Novo campeonato</h2>' +
      '<p class="sub">Coloque todo mundo que vai participar. O rodízio é montado sozinho.</p></div>';

    h += '<div class="cartao">' +
      '<label class="campo"><span>Nome do campeonato</span>' +
      '<input id="fNome" value="' + esc(r.nome) + '" data-campo="nome" placeholder="CLT — Temporada 1"></label>' +

      '<div class="campo"><span>Jogadores (' + r.nomes.length + ')</span>' +
      '<div class="chips" style="margin-bottom:10px">' +
      (r.nomes.length ? r.nomes.map(function (n, i) {
        return '<span class="chip on">' + esc(n) +
          '<button class="x" data-acao="rm-jogador" data-arg="' + i + '" aria-label="remover">×</button></span>';
      }).join('') : '<span style="color:var(--texto-fraco);font-size:13px">ninguém ainda</span>') +
      '</div>' +
      '<div class="linha-botoes">' +
      '<input id="fNovoJogador" placeholder="nome do jogador" style="flex:2;padding:12px;border-radius:10px;background:var(--verde-900);border:1px solid var(--linha);color:var(--texto)">' +
      '<button class="botao pequeno" data-acao="add-jogador" style="flex:0 0 auto">Adicionar</button>' +
      '</div></div>' +

      '<label class="campo"><span>Formato de cada jogo</span>' +
      '<select data-campo="tamanhoTime">' +
      '<option value="2"' + (r.tamanhoTime === 2 ? ' selected' : '') + '>Duplas (2 contra 2)</option>' +
      '<option value="3"' + (r.tamanhoTime === 3 ? ' selected' : '') + '>Trios (3 contra 3)</option>' +
      '</select></label>' +

      '<div class="linha-botoes">' +
      '<label class="campo" style="flex:1"><span>Quantidade de jogos</span>' +
      '<input type="number" min="1" max="200" value="' + r.totalJogos + '" data-campo="totalJogos"></label>' +
      '<label class="campo" style="flex:1"><span>Aposta por pessoa (R$)</span>' +
      '<input type="number" min="0" step="1" value="' + r.valorAposta + '" data-campo="valorAposta"></label>' +
      '</div>';

    if (E.backend === 'ok') {
      h += '<button class="opcao ' + (r.online ? 'on' : '') + '" data-acao="alternar-online">' +
        '<span class="marca-caixa">' + (r.online ? '✓' : '') + '</span>' +
        '<span><b>Sala compartilhada</b><br><small>gera um código; todo mundo abre no próprio celular e vê o placar ao vivo</small></span>' +
        '</button>';
    }

    if (r.nomes.length >= minimo) {
      h += previaRodizio();
      h += '<button class="botao primario" data-acao="criar-campeonato">Gerar rodízio e começar</button>';
    } else {
      h += '<div class="aviso">Faltam jogadores: são necessários pelo menos ' + minimo +
        ' para o formato escolhido (hoje tem ' + r.nomes.length + ').</div>';
    }
    h += '</div>';
    return h;
  }

  function previaRodizio() {
    var r = rascunho;
    var ids = r.nomes.map(function (n, i) { return 'p' + i; });
    var jogos = SC.gerarRodizio(ids, r.tamanhoTime, r.totalJogos, 7);
    var st = SC.estatisticasRodizio(jogos, ids);
    var foraPorJogo = ids.length - r.tamanhoTime * 2;
    var faixaJogos = st.minJogos === st.maxJogos ? st.minJogos + ' jogos cada'
      : 'entre ' + st.minJogos + ' e ' + st.maxJogos + ' jogos';
    var faixaDupla = st.minDupla === st.maxDupla ? st.minDupla + 'x cada dupla'
      : 'de ' + st.minDupla + 'x a ' + st.maxDupla + 'x cada dupla';
    return '<div class="cartao" style="background:var(--verde-900)">' +
      '<p class="sub"><b style="color:var(--ouro)">Prévia do rodízio</b><br>' +
      '• Cada pessoa joga: <b>' + faixaJogos + '</b> (de ' + r.totalJogos + ')<br>' +
      '• Cada combinação de parceiros se repete: <b>' + faixaDupla + '</b><br>' +
      (foraPorJogo > 0 ? '• ' + foraPorJogo + ' de fora por jogo, revezando<br>' : '') +
      '• Pote total: <b>' + moeda(r.nomes.length * r.valorAposta) + '</b></p></div>';
  }

  /* ---------------- campeonato ---------------- */
  function viewCampeonato() {
    var c = E.camp;
    var pr = S.progresso();
    var tab = S.classificacao();
    var prox = S.proximoJogo();
    var adi = S.adiados();
    var pausadas = S.emAndamento();
    var h = '';

    if (E.codigo) {
      h += '<div class="cartao sala">' +
        '<p class="sub">Código da sala — quem digitar isso vê o mesmo placar, ao vivo</p>' +
        '<div class="codigo-grande">' + esc(E.codigo) + '</div>' +
        '<div class="linha-botoes">' +
        '<button class="botao pequeno" data-acao="copiar-link">Copiar link</button>' +
        '<button class="botao pequeno" data-acao="copiar-codigo">Copiar código</button>' +
        '</div></div>';
    }

    h += '<div class="stats">' +
      '<div class="stat"><div class="n">' + moeda(c.jogadores.length * c.valorAposta).replace('R$ ', '') + '</div><div class="r">Pote R$</div></div>' +
      '<div class="stat"><div class="n">' + pr.feitos + '/' + pr.total + '</div><div class="r">Jogos</div></div>' +
      '<div class="stat"><div class="n">' + c.jogadores.filter(function (j) { return S.presente(j.id); }).length +
      '/' + c.jogadores.length + '</div><div class="r">Presentes</div></div>' +
      '</div>';

    h += '<div class="titulo-secao">Quem está na mesa agora<span style="font-weight:400;text-transform:none;letter-spacing:0">toque para marcar</span></div>';
    h += '<div class="chips" style="margin-bottom:14px">' + c.jogadores.map(function (j) {
      var on = S.presente(j.id);
      return '<button class="chip ' + (on ? 'on' : 'off') + '" data-acao="presenca" data-arg="' + j.id + '">' +
        (on ? '✓ ' : '✕ ') + esc(j.nome) + '</button>';
    }).join('') + '</div>';

    if (pausadas.length) {
      h += '<div class="titulo-secao">Partidas em andamento</div>';
      h += pausadas.map(function (j) {
        var p = S.partida(j.n);
        var falta = S.ausentesDoJogo(j);
        return '<div class="jogo pausada">' +
          '<div class="num">⏸</div>' +
          '<div class="times">' + esc(S.nomes(j.a)) + '<span class="vs"> VS </span>' + esc(S.nomes(j.b)) +
          '<div class="fora">jogo ' + j.n +
          (falta.length ? ' · esperando ' + esc(S.nomes(falta)) : ' · parada no meio') + '</div>' +
          '</div>' +
          '<div class="res">' + (p ? p.pontos.A + '×' + p.pontos.B : '—') + '</div>' +
          (falta.length ? '' : '<button class="botao pequeno primario" data-acao="abrir-partida" data-arg="' + j.n + '">Retomar</button>') +
          '</div>';
      }).join('');
    }

    if (adi.length) {
      h += '<div class="aviso">⏭️ ' + adi.length + ' jogo' + (adi.length > 1 ? 's foram adiados' : ' foi adiado') +
        ' porque falta gente. Volta' + (adi.length > 1 ? 'm' : '') + ' sozinho assim que todo mundo estiver presente.</div>';
    }

    h += '<div class="titulo-secao">Próximo jogo</div>';
    if (c.encerrado && !prox) {
      h += '<div class="cartao" style="text-align:center"><div class="confete">🏆</div>' +
        '<h2>Campeonato encerrado</h2><p class="sub">Todos os ' + pr.total + ' jogos foram disputados.</p></div>';
      var emp = S.empatadosNoTopo();
      if (emp.length) {
        h += '<div class="cartao" style="border-color:var(--ouro)">' +
          '<h2>Empate na liderança</h2><p class="sub">' +
          emp.map(function (l) { return esc(l.nome); }).join(', ') +
          ' terminaram com ' + emp[0].v + ' vitórias e saldo ' + emp[0].sd + '. Hora do X1.</p>' +
          '<div style="height:12px"></div>' +
          '<button class="botao primario" data-acao="gerar-x1">Gerar desempate X1 (' +
          (emp.length * (emp.length - 1) / 2) + ' jogo' + (emp.length > 2 ? 's' : '') + ')</button></div>';
      } else if (tab.length) {
        h += '<div class="cartao" style="text-align:center;border-color:var(--ouro)">' +
          '<p class="sub">Campeão</p><h2 style="font-size:26px;color:var(--ouro)">' + esc(tab[0].nome) + '</h2>' +
          '<p class="sub">leva ' + moeda(c.jogadores.length * c.valorAposta) + '</p></div>';
      }
    } else if (!prox) {
      h += '<div class="cartao"><p class="sub">Nenhum jogo pode começar agora — todos os jogos que faltam ' +
        'dependem de alguém que não está na mesa. Marque a presença de quem chegou.</p></div>';
    } else {
      h += cartaoJogo(prox, true);
    }

    h += '<div class="titulo-secao">Classificação</div>';
    h += '<div class="cartao" style="padding:6px 10px"><div class="rolagem"><table class="tabela">' +
      '<tr><th class="pos"></th><th class="nome">Jogador</th><th>J</th><th>V</th><th>D</th><th>SD</th><th>%</th></tr>' +
      tab.map(function (l, i) {
        return '<tr class="' + (i === 0 && l.j ? 'top1' : '') + '">' +
          '<td class="pos">' + (i + 1) + '</td>' +
          '<td class="nome">' + (i === 0 && l.j ? '👑 ' : '') + esc(l.nome) +
          '<small>' + l.pf + ' pontos feitos · ' + l.ps + ' sofridos</small></td>' +
          '<td>' + l.j + '</td><td class="destaque">' + l.v + '</td><td>' + l.d + '</td>' +
          '<td>' + (l.sd > 0 ? '+' : '') + l.sd + '</td><td>' + l.ap + '%</td></tr>';
      }).join('') + '</table></div></div>';

    h += '<div class="titulo-secao">Tabela de jogos</div>';
    h += '<div class="abas">' +
      ['proximos', 'concluidos', 'rodizio'].map(function (a) {
        var rot = { proximos: 'A jogar', concluidos: 'Concluídos', rodizio: 'Equilíbrio' }[a];
        return '<button class="' + (E.aba === a ? 'on' : '') + '" data-acao="aba" data-arg="' + a + '">' + rot + '</button>';
      }).join('') + '</div>';

    if (E.aba === 'rodizio') {
      h += viewEquilibrio();
    } else {
      var lista = c.jogos.filter(function (j) {
        return E.aba === 'concluidos' ? j.status === 'concluido' : j.status !== 'concluido';
      });
      if (E.aba === 'concluidos') lista = lista.slice().reverse();
      h += lista.length ? lista.map(function (j) { return cartaoJogo(j, false); }).join('')
        : '<div class="vazio">nada por aqui ainda</div>';
    }
    return h;
  }

  function cartaoJogo(j, destaque) {
    var c = E.camp;
    var feito = j.status === 'concluido';
    var aberto = j.status === 'em_andamento';
    var p = aberto ? S.partida(j.n) : null;
    var ausentes = S.ausentesDoJogo(j);
    var classe = 'jogo' + (feito ? ' feito' : '') + (destaque ? ' prox' : '') +
      (ausentes.length ? ' bloqueado' : '') + (aberto ? ' pausada' : '');
    var h = '<div class="' + classe + '">' +
      '<div class="num">' + (feito ? '✓' : (aberto ? '⏸' : j.n)) + '</div>' +
      '<div class="times">' +
      '<span class="' + (j.vencedor === 'A' ? 'ganhou' : '') + '">' + esc(S.nomes(j.a)) + '</span>' +
      '<span class="vs"> VS </span>' +
      '<span class="' + (j.vencedor === 'B' ? 'ganhou' : '') + '">' + esc(S.nomes(j.b)) + '</span>' +
      (j.tipo === 'x1' ? '<div class="fora">desempate X1</div>' : '') +
      (!feito && j.fora && j.fora.length ? '<div class="fora">fora: ' + esc(S.nomes(j.fora)) + '</div>' : '') +
      (ausentes.length ? '<div class="fora">⏸ aguardando ' + esc(S.nomes(ausentes)) + '</div>' : '') +
      '</div>';
    if (feito) {
      h += '<div class="res">' + j.placar.A + '<span style="color:var(--texto-fraco)">×</span>' + j.placar.B + '</div>' +
        '<button class="icone" data-acao="reabrir" data-arg="' + j.n + '" title="corrigir resultado" style="width:32px;height:32px;font-size:14px">✎</button>';
    } else if (aberto) {
      h += '<div class="res">' + (p ? p.pontos.A + '×' + p.pontos.B : '—') + '</div>' +
        (ausentes.length ? '' : '<button class="botao pequeno primario" data-acao="abrir-partida" data-arg="' + j.n + '">Retomar</button>');
    } else if (destaque) {
      h += '<button class="botao pequeno primario" data-acao="conferir-presenca" data-arg="' + j.n + '">Começar</button>';
    }
    h += '</div>';
    if (destaque) {
      h = '<div class="cartao" style="padding:12px">' +
        '<p class="sub" style="margin-bottom:8px">' +
        (aberto ? 'Partida parada no meio — dá para continuar de onde parou'
                : 'Jogo ' + j.n + ' de ' + c.jogos.length) +
        (j.fora && j.fora.length ? ' · descansam: ' + esc(S.nomes(j.fora)) : '') + '</p>' + h + '</div>';
    }
    return h;
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

    if (p.vencedor) {
      h += '<div class="cartao" style="text-align:center;border-color:var(--ouro)">' +
        '<div class="confete">🏆</div>' +
        '<h2 style="color:var(--ouro)">' + esc(p.times[p.vencedor].nome) + ' venceu!</h2>' +
        '<p class="sub">' + p.pontos.A + ' x ' + p.pontos.B + '</p>' +
        '<div style="height:14px"></div>' +
        (doCampeonato
          ? '<button class="botao primario" data-acao="finalizar">Salvar no campeonato</button>'
          : '<button class="botao primario" data-acao="nova-avulsa">Jogar de novo</button>') +
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

    if (!m.trucoBloqueado) {
      if (m.valor === 1) {
        h += '<div class="grade-acoes duas" style="margin-bottom:14px">' +
          '<button class="botao-truco" data-acao="lance" data-arg="pedir:A">TRUCO<br><small style="font-weight:400">' + esc(p.times.A.nome) + '</small></button>' +
          '<button class="botao-truco" data-acao="lance" data-arg="pedir:B">TRUCO<br><small style="font-weight:400">' + esc(p.times.B.nome) + '</small></button>' +
          '</div>';
      } else if (m.podeAumentar && M.proximo(m.valor)) {
        h += '<div style="margin-bottom:14px">' +
          '<button class="botao-truco" style="width:100%" data-acao="lance" data-arg="pedir:' + m.podeAumentar + '">' +
          esc(p.times[m.podeAumentar].nome) + ' pede ' + M.nomeAposta(M.proximo(m.valor)) + ' 🔥</button>' +
          '<div class="faixa-mao" style="margin:8px 0 0">só quem aceitou o último pedido pode aumentar</div></div>';
      } else if (m.valor >= 12) {
        h += '<div class="aviso">Mão valendo 12 — não tem mais pra onde subir.</div>';
      }
    }

    h += '<div class="titulo-secao">Quem ganhou a mão? (+' + m.valor + ')</div>' +
      '<div class="grade-acoes duas" style="margin-bottom:14px">' +
      '<button class="botao botao-time a" data-acao="lance" data-arg="venceu:A">' + esc(p.times.A.nome) + '<br><small>+' + m.valor + '</small></button>' +
      '<button class="botao botao-time b" data-acao="lance" data-arg="venceu:B">' + esc(p.times.B.nome) + '<br><small>+' + m.valor + '</small></button>' +
      '</div>';
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
      '<div class="linha-botoes" style="gap:6px">' +
      '<button class="botao pequeno fantasma" data-acao="lance" data-arg="ajuste:' + t + ':-1" style="padding:4px">−</button>' +
      '<button class="botao pequeno fantasma" data-acao="lance" data-arg="ajuste:' + t + ':1" style="padding:4px">+</button>' +
      '</div></div>';
  }

  function rodape() {
    var doCampeonato = !!E.jogoAberto;
    return '<div class="linha-botoes" style="margin-bottom:10px">' +
      '<button class="botao fantasma pequeno" data-acao="lance" data-arg="desfazer">↩ Desfazer</button>' +
      (doCampeonato
        ? '<button class="botao fantasma pequeno" data-acao="pausar">⏸ Pausar</button>' +
          '<button class="botao fantasma pequeno" data-acao="cancelar-partida">✕ Cancelar</button>'
        : '<button class="botao fantasma pequeno" data-acao="sair-avulsa">Sair</button>') +
      '</div>' +
      (doCampeonato
        ? '<div class="faixa-mao" style="margin:0 0 14px">Pausar guarda o placar: dá para voltar hoje, amanhã, ou quando o time todo estiver de volta.</div>'
        : '');
  }

  function historico(p) {
    if (!p.historico.length) return '';
    return '<div class="titulo-secao">O que rolou</div><div class="cartao"><ul class="historico">' +
      p.historico.slice(0, 40).map(function (l) {
        return '<li><b>' + esc(l.texto) + '</b> · <span>' + l.placar + '</span></li>';
      }).join('') + '</ul></div>';
  }

  /* ---------------- modais ---------------- */
  function modalPresenca(n) {
    var j = S.jogo(n);
    if (!j) return;
    abrirModal(
      '<h3>Todo mundo do jogo ' + j.n + ' está aí?</h3>' +
      '<p>Confirme antes de começar. Quem não estiver presente sai da fila e o jogo volta depois.</p>' +
      '<div class="cartao" style="background:var(--verde-900);margin-bottom:14px"><p class="sub">' +
      '<b style="color:var(--timeA)">' + esc(S.nomes(j.a)) + '</b><br><span style="font-size:11px">VS</span><br>' +
      '<b style="color:var(--timeB)">' + esc(S.nomes(j.b)) + '</b></p></div>' +
      '<button class="botao primario" data-acao="iniciar" data-arg="' + j.n + '">Sim, todos presentes — começar</button>' +
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
      '<p>Desmarque quem faltou. O sistema pula para o próximo jogo em que essa pessoa não entra e guarda os jogos dela para depois.</p>' +
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
      '<h3>Partida avulsa</h3><p>Só o marcador, sem campeonato — fica só neste aparelho.</p>' +
      '<label class="campo"><span>Time A</span><input id="avA" value="Nós"></label>' +
      '<label class="campo"><span>Time B</span><input id="avB" value="Eles"></label>' +
      '<button class="botao primario" data-acao="criar-avulsa">Começar partida</button>'
    );
  }

  function modalEntrar() {
    abrirModal(
      '<h3>Entrar na sala</h3><p>Digite o código que aparece no celular de quem criou o campeonato.</p>' +
      '<label class="campo"><span>Código</span>' +
      '<input id="fCodigo" placeholder="ABC123" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.2em;font-size:20px;text-align:center"></label>' +
      '<button class="botao primario" data-acao="confirmar-entrar">Entrar</button>' +
      '<div style="height:8px"></div>' +
      '<button class="botao fantasma" data-acao="fechar">Cancelar</button>'
    );
  }

  function modalMenu() {
    var temCamp = !!E.camp;
    abrirModal(
      '<h3>Opções</h3>' +
      '<p>' + (E.codigo
        ? 'Sala <b class="codigo">' + esc(E.codigo) + '</b> — ' +
          (E.conexao === 'ok' ? 'conectada: todo mundo vê o mesmo placar.' : 'sem conexão no momento.')
        : 'Campeonato só neste aparelho.') + '</p>' +
      (temCamp ? '<button class="botao" data-acao="exportar">⤓ Exportar campeonato (backup)</button><div style="height:8px"></div>' : '') +
      '<button class="botao" data-acao="importar">⤒ Importar backup</button><div style="height:8px"></div>' +
      (E.backend === 'ok' ? '<button class="botao" data-acao="entrar">⌨ Entrar em outra sala</button><div style="height:8px"></div>' : '') +
      (temCamp ? '<button class="botao" data-acao="regerar">🎲 Sortear rodízio de novo</button><div style="height:8px"></div>' : '') +
      (temCamp ? '<button class="botao" data-acao="config-ferro">⚙️ Mão de ferro vale ' + E.camp.config.maoDeFerroVale + ' (trocar)</button><div style="height:8px"></div>' : '') +
      '<button class="botao" data-acao="config-api">🔌 Endereço do servidor' +
      (API.base() ? '<br><small>' + esc(API.base()) + '</small>' : '') + '</button><div style="height:8px"></div>' +
      (temCamp ? '<button class="botao perigo" data-acao="sair-camp">🚪 Sair deste campeonato</button><div style="height:8px"></div>' : '') +
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
      N.lanceNaPartida(E.avulsa, l);
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
      case 'alternar-online': lerCampos(); rascunho.online = !rascunho.online; render(); break;
      case 'criar-campeonato': {
        lerCampos();
        if (rascunho.nomes.length < rascunho.tamanhoTime * 2) return;
        var botao = document.querySelector('[data-acao="criar-campeonato"]');
        if (botao) { botao.disabled = true; botao.textContent = 'criando...'; }
        S.criarCampeonato({
          nome: rascunho.nome, nomes: rascunho.nomes, tamanhoTime: rascunho.tamanhoTime,
          totalJogos: Math.max(1, rascunho.totalJogos), valorAposta: rascunho.valorAposta
        }, rascunho.online).then(function (r) {
          if (!r.ok) S.avisar('não consegui criar a sala: ' + r.erro);
          render();
        });
        break;
      }

      case 'entrar': fecharModal(); modalEntrar(); break;
      case 'confirmar-entrar': {
        var inp = document.getElementById('fCodigo');
        var cod = inp ? inp.value : '';
        var b = document.querySelector('[data-acao="confirmar-entrar"]');
        if (b) { b.disabled = true; b.textContent = 'entrando...'; }
        S.entrarNaSala(cod).then(function (r) {
          if (r.ok) fecharModal();
          else { S.avisar(r.erro); modalEntrar(); }
          render();
        });
        break;
      }
      case 'copiar-link': copiar(location.origin + location.pathname + '?sala=' + E.codigo, 'link'); break;
      case 'copiar-codigo': copiar(E.codigo, 'código'); break;

      case 'avulsa': modalAvulsa(); break;
      case 'criar-avulsa': {
        var a = (document.getElementById('avA').value || 'Time A').trim();
        var bb = (document.getElementById('avB').value || 'Time B').trim();
        E.avulsa = M.criar({
          times: { A: { nome: a, jogadores: [] }, B: { nome: bb, jogadores: [] } },
          limite: 12, usarMaoDe11: true, maoDeFerroVale: 3, origem: { tipo: 'avulsa' }
        });
        E.jogoAberto = null;
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
          if (S.partida(n)) { E.jogoAberto = n; ir('partida'); }
        });
        break;
      }
      case 'abrir-partida': E.jogoAberto = parseInt(arg, 10); ir('partida'); break;
      case 'pausar': E.jogoAberto = null; ir('campeonato'); break;
      case 'cancelar-partida': {
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

      case 'aba': E.aba = arg; S.salvar(); render(); break;
      case 'reabrir': {
        if (confirm('Reabrir o jogo ' + arg + '? O resultado atual será apagado.')) {
          S.despachar({ tipo: 'reabrir', n: parseInt(arg, 10) });
        }
        break;
      }
      case 'gerar-x1': {
        var emp = S.empatadosNoTopo();
        if (emp.length) {
          E.aba = 'proximos';
          S.despachar({ tipo: 'x1', jogadores: emp.map(function (l) { return l.id; }) });
        }
        break;
      }
      case 'regerar': fecharModal(); S.despachar({ tipo: 'regerar' }); break;
      case 'config-ferro':
        S.despachar({ tipo: 'config', config: { maoDeFerroVale: E.camp.config.maoDeFerroVale === 3 ? 1 : 3 } })
          .then(modalMenu);
        break;
      case 'sair-camp': {
        if (!confirm(E.codigo
          ? 'Sair da sala neste aparelho? O campeonato continua no servidor e dá para voltar com o código ' + E.codigo + '.'
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
    if (ev.target.id === 'fCodigo') { ev.preventDefault(); acao('confirmar-entrar'); }
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
      selo.innerHTML = '<span class="ponto-vivo"></span>' + esc(E.codigo);
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
    if (E.tela === 'partida' && p) tela.innerHTML = viewPartida(p);
    else if (E.tela === 'campeonato') tela.innerHTML = viewCampeonato();
    else if (E.tela === 'novo') tela.innerHTML = viewNovo();
    else { E.tela = 'inicio'; tela.innerHTML = viewInicio(); }
  }

  /* ---------------- partida ---------------- */
  S.carregar();
  E = S.get();

  var daUrl = new URLSearchParams(location.search).get('sala');
  render();
  S.iniciarSync(render);

  if (daUrl && daUrl.toUpperCase() !== E.codigo) {
    S.entrarNaSala(daUrl).then(function (r) {
      if (!r.ok) S.avisar('não consegui entrar na sala ' + daUrl + ': ' + r.erro);
      history.replaceState(null, '', location.pathname);
      render();
    });
  }

  CLT._debug = { S: S, M: M, SC: SC, N: N, render: render, acao: acao };
})(window.CLT);
