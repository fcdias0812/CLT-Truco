/*
 * Servidor local de desenvolvimento — NAO e usado em producao.
 * Serve os arquivos do site e responde as mesmas rotas /api usando um arquivo JSON
 * no lugar do Postgres, pra dar pra testar a sala compartilhada sem criar conta em nada.
 *
 *   node dev-server.js        ->  http://localhost:4173
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const nucleo = require('./js/nucleo.js');

const PORTA = Number(process.env.PORT) || 4173;
const RAIZ = __dirname;
const ARQUIVO = path.join(RAIZ, '.dev-data.json');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8'
};

let banco = {};
try { banco = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); } catch (e) { banco = {}; }
function gravar() {
  try { fs.writeFileSync(ARQUIVO, JSON.stringify(banco, null, 2)); } catch (e) {}
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function novoCodigo() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}

function json(res, status, corpo) {
  const txt = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(txt);
}

function lerCorpo(req) {
  return new Promise(function (ok) {
    let b = '';
    req.on('data', function (d) { b += d; });
    req.on('end', function () {
      try { ok(b ? JSON.parse(b) : {}); } catch (e) { ok({}); }
    });
  });
}

const servidor = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;

  if (req.method === 'OPTIONS') { json(res, 204, {}); return; }

  if (rota === '/api/estado') {
    const codigo = (url.searchParams.get('codigo') || '').toUpperCase();
    if (!codigo) return json(res, 200, { ok: true, backend: true });
    const linha = banco[codigo];
    if (!linha) return json(res, 404, { erro: 'sala nao encontrada' });
    const versaoCliente = Number(url.searchParams.get('versao') || 0);
    if (versaoCliente === linha.versao) return json(res, 200, { mudou: false, versao: linha.versao });
    return json(res, 200, { mudou: true, versao: linha.versao, camp: linha.camp });
  }

  if (rota === '/api/criar' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    const nomes = (corpo.nomes || []).map(String).map(function (s) { return s.trim(); }).filter(Boolean);
    const tamanhoTime = Number(corpo.tamanhoTime) === 3 ? 3 : 2;
    if (nomes.length < tamanhoTime * 2) return json(res, 400, { erro: 'jogadores insuficientes' });
    const camp = nucleo.criarCampeonato({
      nome: corpo.nome, nomes: nomes, tamanhoTime: tamanhoTime,
      totalJogos: Math.min(200, Math.max(1, Number(corpo.totalJogos) || 30)),
      valorAposta: Math.max(0, Number(corpo.valorAposta) || 0),
      config: corpo.config || {}
    });
    let codigo;
    do { codigo = novoCodigo(); } while (banco[codigo]);
    camp.codigo = codigo;
    banco[codigo] = { versao: 1, camp: camp };
    gravar();
    return json(res, 200, { codigo: codigo, versao: 1, camp: camp });
  }

  if (rota === '/api/acao' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    const codigo = String(corpo.codigo || '').toUpperCase();
    const linha = banco[codigo];
    if (!linha) return json(res, 404, { erro: 'sala nao encontrada' });
    const r = nucleo.aplicar(linha.camp, corpo.acao);
    if (!r.ok) return json(res, 409, { erro: r.erro, versao: linha.versao, camp: linha.camp });
    linha.versao++;
    gravar();
    return json(res, 200, { versao: linha.versao, camp: linha.camp });
  }

  if (rota === '/api/trocar-codigo' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    const atual = String(corpo.codigo || '').toUpperCase();
    const linha = banco[atual];
    if (!linha) return json(res, 404, { erro: 'sala nao encontrada' });
    let novo;
    do { novo = novoCodigo(); } while (banco[novo]);
    linha.camp.codigo = novo;
    banco[novo] = linha;
    delete banco[atual];
    gravar();
    return json(res, 200, { codigo: novo, versao: linha.versao, camp: linha.camp });
  }

  /* arquivos estaticos */
  let arquivo = path.join(RAIZ, rota === '/' ? 'index.html' : decodeURIComponent(rota));
  if (!arquivo.startsWith(RAIZ)) { res.writeHead(403); res.end('nao'); return; }
  fs.readFile(arquivo, function (erro, dados) {
    if (erro) { res.writeHead(404); res.end('nao encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(dados);
  });
});

servidor.listen(PORTA, function () {
  console.log('CLT rodando em http://localhost:' + PORTA);
  console.log('(salas de teste ficam em .dev-data.json)');
});
