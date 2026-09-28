# CLT — Champions League de Truco

Marcador de truco paulista + campeonato com rodízio automático de duplas/trios, com **placar
compartilhado ao vivo**: todo mundo abre o mesmo link no próprio celular e vê o mesmo placar,
sem recarregar a página.

Site estático (HTML + CSS + JavaScript puro, sem framework e sem build) + três funções
serverless na Vercel + um Postgres no Neon.

---

## O que ele faz

### Placar da partida
- Partida até **12 pontos**.
- Mão normal vale **1**; escada de aposta **3 (truco) → 6 → 9 → 12**.
- Quem **corre** entrega o valor anterior: correu do truco dá 1, do seis dá 3, do nove dá 6, do doze dá 9.
- Só o time que **aceitou** o último pedido pode aumentar depois.
- **Mão de 11**: o time que chega a 11 decide jogar (vale 3, ninguém pede truco) ou correr (entrega 1 ponto).
- **11 a 11 (mão de ferro)**: vale 3 por padrão (dá para trocar para 1 no menu ⋯) e quem ganhar leva a partida.
- Com um truco pendente na tela, os botões de "quem ganhou a mão" somem: primeiro resolve
  correu / aceitou / aumentou. É o que evita marcar ponto errado no meio da discussão.
- `−` / `+` em cada placar e **Desfazer** para corrigir qualquer coisa contada errada.

### Partida pausada — retomar no dia seguinte
Partida não se perde. O botão **⏸ Pausar** guarda o placar exatamente onde está e devolve para o
painel. A partida fica listada em "Partidas em andamento" com o placar parcial e um botão
**Retomar**, e continua lá no dia seguinte, na semana que vem, em qualquer aparelho da sala.

Se alguém da partida pausada não veio, é só desmarcar a presença dessa pessoa: a partida passa a
mostrar "esperando Fulano" (sem botão de retomar) e a fila pula direto para os jogos em que
Fulano não entra. Quando ele chega e você marca a presença de volta, a partida parada volta a
ser a primeira da fila.

### Campeonato
- Você cadastra os participantes (4, 5, 6…) e a quantidade de jogos (padrão 30).
- O rodízio é montado automaticamente buscando, nesta ordem: mesma quantidade de jogos para todo
  mundo, parceiros sempre diferentes, confrontos espalhados, e ninguém de fora duas vezes seguidas.

  | Pessoas | Jogos de cada um (em 30) | Repetição de cada dupla |
  | --- | --- | --- |
  | 4 | 30 (todos jogam sempre) | 10x — exato |
  | 5 | 24 (6 de folga cada) | 6x — exato |
  | 6 em duplas | 20 | 4x — exato |
  | 6 em trios | 30 | 12x — exato |

- Antes de cada partida o app pergunta se está todo mundo na mesa.
- Classificação por **vitórias → saldo de pontos → pontos feitos**.
- Empate na liderança no fim: o app gera o **X1** entre os empatados (todos contra todos).
- Mostra o **pote** (valor da aposta × número de participantes).

### Placar compartilhado (a "sala")
Ao criar o campeonato com a opção **Sala compartilhada** ligada, o app gera um código de 6
caracteres (ex.: `77SYWB`). Quem abrir o link `…/?sala=77SYWB` — ou digitar o código em
"Entrar com código da sala" — passa a ver e mexer no mesmo campeonato.

- Qualquer um pode marcar ponto e pedir truco; a tela dos outros se atualiza sozinha.
- O servidor é quem manda: cada toque vira uma "ação" aplicada no servidor com controle de
  versão, então dois celulares clicando ao mesmo tempo não se atropelam nem perdem jogada.
- A atualização é por consulta rápida e repetida: **cerca de 2 segundos** com uma partida aberta
  na tela, 4 segundos no painel e 20 segundos com o app em segundo plano. Não é WebSocket porque
  função serverless na Vercel tem limite de 10 segundos por requisição — na prática, para placar
  de truco, a diferença não aparece.
- Sem internet no momento, o app avisa ("sem conexão") e continua marcando local; assim que
  voltar, ele sincroniza.

Sem backend configurado (por exemplo publicando só no GitHub Pages), o app funciona igual, mas
só naquele aparelho — a opção de sala some sozinha e aparece um selo "offline".

### Apelido e registro de quem fez o quê
Ao entrar numa sala compartilhada pela primeira vez, o app pergunta um apelido (ex.: "Rai").
Não é login nem senha — é só um rótulo salvo naquele aparelho, que passa a aparecer em:

- **Histórico de cada partida** ("O que rolou"): cada linha mostra quem tocou o botão.
- **Histórico de uma partida já encerrada**: o ícone 👁 no card do jogo concluído abre o
  mão-a-mão completo, preservado mesmo depois de salvo no campeonato.
- **Registro do campeonato** (aba "Registro"): quem marcou presença, iniciou, cancelou ou
  reabriu um jogo, sorteou o rodízio de novo, etc.

Dá para trocar o apelido a qualquer momento pelo menu **⋯**. Não impede ninguém de agir por
outra pessoa (continua sendo "qualquer um pode marcar", como o grupo escolheu) — é só o
rastro de quem fez o quê, útil se algum placar ficar em dúvida.

### Código vazou? Alguém saiu no meio?
- **Trocar código da sala** (menu ⋯): gera um código novo pra mesma sala e desativa o antigo
  na hora, sem perder nada do campeonato — para quando o link foi parar em grupo errado.
- **Gerenciar jogadores** (botão na tela do campeonato): renomear alguém, ou marcar que
  **saiu do campeonato**. Diferente de só desmarcar presença (isso é "não veio hoje"), marcar
  como "saiu" resolve os jogos pendentes dessa pessoa como **pulados** — assim o campeonato
  consegue fechar mesmo que alguém desista no meio. É reversível: dá pra marcar "voltou" e os
  jogos pulados dela voltam para a fila.

---

## Rodar na sua máquina

Com a sala compartilhada funcionando (usa um arquivo `.dev-data.json` no lugar do Postgres,
não precisa criar conta em nada):

```bash
node dev-server.js
```

Depois acesse `http://localhost:4173`.

Só o site, sem sala compartilhada: abrir o `index.html` direto no navegador já funciona.

---

## Publicar na Vercel (com o Neon)

### 1. Criar o banco no Neon
1. Crie uma conta em [neon.com](https://neon.com) e um projeto novo (região mais perto: `sa-east-1`).
2. No painel do projeto, em **Connect**, copie a *connection string* (começa com `postgresql://`).

Não precisa criar tabela na mão: a primeira chamada da API cria a tabela `clt_campeonatos`
sozinha. Se preferir criar antes:

```sql
CREATE TABLE IF NOT EXISTS clt_campeonatos (
  codigo        text PRIMARY KEY,
  dados         jsonb NOT NULL,
  versao        integer NOT NULL DEFAULT 1,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
```

### 2. Subir na Vercel
1. **Add New → Project** e importe o repositório do GitHub.
2. **Framework Preset: Other**; deixe o **Build Command** e o **Output Directory** em branco.
3. Em **Environment Variables**, adicione:
   - Nome: `DATABASE_URL`
   - Valor: a connection string do Neon
4. Deploy. As rotas `/api/criar`, `/api/estado` e `/api/acao` sobem junto, direto da pasta `api/`.

Se mudar a variável depois, é preciso um novo deploy (ou *Redeploy*) para ela valer.

### Custo
Tudo cabe no plano gratuito dos dois serviços: a Vercel (Hobby) dá 1 milhão de chamadas de
função por mês e o Neon dá 100 CU-horas por mês (≈400 horas do banco ligado) e 0,5 GB. Um
campeonato inteiro ocupa alguns KB. Atenção a um detalhe do contrato: o plano Hobby da Vercel é
para uso pessoal/não comercial — um bolão de truco entre amigos se encaixa, um produto da
empresa não.

### Alternativa: site no GitHub Pages e API na Vercel
Dá para manter o site no GitHub Pages e só a API na Vercel: publique os dois, e no app vá em
**⋯ → Endereço do servidor** e cole a URL da Vercel (ex.: `https://gerenciador-truco.vercel.app`).
Fica salvo no aparelho. As funções já respondem com CORS liberado.

### Só GitHub Pages (sem sala compartilhada)
1. Suba os arquivos na branch `main` (o `index.html` na raiz).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O arquivo `.nojekyll` já está aqui para o GitHub não processar o site com Jekyll.

Em qualquer caso, abra o link no celular e use "Adicionar à tela de início" — o
`manifest.webmanifest` faz o app abrir em tela cheia, como se fosse um aplicativo.

---

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Casca da página |
| `css/style.css` | Todo o visual |
| `js/scheduler.js` | Monta o rodízio equilibrado e os jogos de desempate X1 |
| `js/match.js` | Regras do truco: escada de aposta, correr, mão de 11, mão de ferro, desfazer |
| `js/nucleo.js` | O "cérebro" compartilhado: aplica as ações no campeonato. **Roda igual no navegador e no servidor** |
| `js/api.js` | Conversa com o backend |
| `js/store.js` | Estado do aparelho, sincronização e fila de ações |
| `js/app.js` | Telas e botões |
| `api/criar.js` | `POST /api/criar` — cria a sala e devolve o código |
| `api/estado.js` | `GET /api/estado` — devolve o campeonato só quando mudou |
| `api/acao.js` | `POST /api/acao` — aplica uma ação com controle de versão |
| `api/trocar-codigo.js` | `POST /api/trocar-codigo` — gera um código novo pra mesma sala |
| `lib/db.js` | Conexão com o Neon e utilidades das funções |
| `dev-server.js` | Servidor local de testes (não vai para produção) |

O navegador e o servidor usam **o mesmo arquivo de regras** (`js/nucleo.js`), então não existe
risco de a conta bater diferente de um lado e do outro.

Nenhuma biblioteca no front-end. A única dependência do projeto é o driver do Postgres
(`@neondatabase/serverless`), usado só pelas funções da API.
