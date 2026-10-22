/*
 * CLT — senha das salas.
 * A senha nunca e guardada como texto: vai pro banco so o "hash" (scrypt com sal).
 * Quem acerta a senha recebe um token (HMAC do codigo com o hash), que o aparelho guarda
 * e manda em toda consulta. Se a senha mudar, o hash muda e os tokens antigos param de valer.
 * Usado pelas funcoes da Vercel e pelo dev-server.js.
 */
const crypto = require('crypto');

/* senha das salas que ja existiam antes de ter senha */
const SENHA_PADRAO = '1234';

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(senha), sal, 32).toString('hex');
  return 'scrypt$' + sal + '$' + h;
}

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function confereSenha(senha, hash) {
  const partes = String(hash || '').split('$');
  if (partes.length !== 3) return false;
  const h = crypto.scryptSync(String(senha), partes[1], 32).toString('hex');
  return iguais(h, partes[2]);
}

function tokenDaSala(codigo, hash) {
  return crypto.createHmac('sha256', String(hash)).update(String(codigo)).digest('hex');
}

function confereToken(token, codigo, hash) {
  if (!token || !hash) return false;
  return iguais(token, tokenDaSala(codigo, hash));
}

/* senha vazia nao vale; fora isso, qualquer coisa serve */
function senhaValida(senha) {
  return typeof senha === 'string' && senha.length > 0 && senha.length <= 200;
}

module.exports = { SENHA_PADRAO, hashSenha, confereSenha, tokenDaSala, confereToken, senhaValida };
