// Multiplayer regression check against a running `wrangler dev` (BASE overrides the URL).
const BASE = process.env.BASE ?? 'http://localhost:8787';
const WS = BASE.replace('http', 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = () => `player-${crypto.randomUUID()}`;

const join = async (playerId) =>
  (await fetch(`${BASE}/queue/join`, { method: 'POST', body: JSON.stringify({ playerId, nickname: 'Tester' }) })).json();

const open = (gameId, playerId, token) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS}/game?gameId=${gameId}&playerId=${playerId}&token=${token}`);
    ws.msgs = [];
    ws.onmessage = (e) => ws.msgs.push(JSON.parse(e.data));
    ws.onopen = () => resolve(ws);
    ws.onerror = reject;
  });

const lastState = (ws) => [...ws.msgs].reverse().find((m) => m.type === 'GAME_STATE')?.payload;

async function match() {
  const a = id(), b = id();
  await join(a);
  const mb = await join(b);
  const ma = await join(a);
  return { a, b, ma, mb };
}

// A: a repeated join (client dropped the first response) returns the same match
{
  const { b, mb } = await match();
  const again = await join(b);
  console.log('A repeated join:', again.matched && again.gameId === mb.gameId && again.connectToken === mb.connectToken ? 'ok' : `BUG (${JSON.stringify(again)})`);
}

// B: a late close from a replaced socket must not mark the player disconnected
{
  const { a, b, ma, mb } = await match();
  const wa1 = await open(ma.gameId, a, ma.connectToken);
  const wb = await open(mb.gameId, b, mb.connectToken);
  await sleep(200);
  const wa2 = await open(ma.gameId, a, ma.connectToken);
  await sleep(200);
  wa1.close();
  await sleep(500);
  console.log('B reconnect:', lastState(wb)?.opponentConnected ? 'ok' : 'BUG (live player shown disconnected)');
  wa2.close(); wb.close();
}
// E: a player who stopped polling (closed tab) is never matched
{
  const ghost = id(), real = id();
  await join(ghost);
  await sleep(21_000);
  const r = await join(real);
  console.log('E ghost skipped:', r.matched ? 'BUG (matched a ghost)' : 'ok');
  await fetch(`${BASE}/queue/leave`, { method: 'POST', body: JSON.stringify({ playerId: real }) });
}

// C: the player to move loses on time; a move restarts the clock
const mc = await match();
const c = (async () => {
  const { a, b, ma, mb } = mc;
  const wa = await open(ma.gameId, a, ma.connectToken);
  const wb = await open(mb.gameId, b, mb.connectToken);
  await sleep(300);
  const left = lastState(wa)?.turnTimeLeftMs;
  console.log('C clock sent:', left > 85_000 && left <= 90_000 ? 'ok' : `BUG (${left})`);
  await sleep(60_000);
  wa.send(JSON.stringify({ type: 'MAKE_MOVE', payload: { boardIndex: 4, cellIndex: 4 } }));
  await sleep(500);
  const mr = wa.msgs.find((m) => m.type === 'MOVE_RESULT')?.payload;
  console.log('C move resets clock:', mr?.valid && mr.turnTimeLeftMs > 85_000 ? 'ok' : `BUG (${JSON.stringify(mr)})`);
  await sleep(40_000);
  console.log('C no early timeout:', wa.msgs.some((m) => m.type === 'GAME_OVER') ? 'BUG' : 'ok');
  await sleep(55_000);
  const over = wa.msgs.find((m) => m.type === 'GAME_OVER')?.payload;
  console.log('C timeout:', over?.reason === 'timeout' && over.winner === 'X' ? 'ok' : `BUG (${JSON.stringify(over)})`);
  wa.close(); wb.close();
})();

// D: a player who drops and stays gone forfeits after 60s, even mid-turn-clock
const md = await match();
const d = (async () => {
  const { a, b, ma, mb } = md;
  const wa = await open(ma.gameId, a, ma.connectToken);
  const wb = await open(mb.gameId, b, mb.connectToken);
  await sleep(300);
  wa.close();
  await sleep(1000);
  console.log('D drop shown:', lastState(wb)?.opponentConnected === false ? 'ok' : 'BUG');
  await sleep(61_000);
  const over = wb.msgs.find((m) => m.type === 'GAME_OVER')?.payload;
  console.log('D forfeit:', over?.reason === 'forfeit' && over.winner === 'O' ? 'ok' : `BUG (${JSON.stringify(over)})`);
  wb.close();
})();

await Promise.all([c, d]);
process.exit(0);
