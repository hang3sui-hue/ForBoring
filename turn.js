// ForBoring shared engine for 2-player turn-based games (online / vs computer / pass-and-play).
// The whole game is a list of moves; every phone rebuilds the position by replaying it,
// so an illegal or out-of-order move can never get in.
// cfg = { key, name, maxMoves, replay(s) -> pos|null, bot(pos, st) -> move, draw(ctx), seat(p, ctx) -> text,
//         turnText(ctx) (optional), doneText(ctx) (optional), botDelay (ms), extra() -> extra state fields for a new game }
// pos must have: turn (0/1 index into players), done (bool), winner (0/1, -1 = draw, null while playing)
window.FBTurn = cfg => {
  'use strict';
  const ui = FB.ui, $ = id => document.getElementById(id);
  let mode = null, net = null, code = '', st = null, pos = null, ready = false, initT = null, botT = null, celebrated = '';
  const me = () => mode === 'online' ? net.myId : 'me';
  const nameOf = id => mode === 'pass' ? (id === 'me' ? '一号玩家' : '二号玩家') : id === 'bot' ? '电脑' : id === me() ? '你' : net.nameOf(id);
  const newer = s => !st || s.game > st.game || (s.game === st.game && s.v > st.v);
  const okId = id => typeof id === 'string' && /^[a-z0-9]{1,16}$/.test(id);
  function valid(s){
    if (!(s && Number.isSafeInteger(s.game) && s.game >= 0 && s.game <= 1e9 && Number.isSafeInteger(s.v) && Array.isArray(s.moves) && s.moves.length <= (cfg.maxMoves || 2000) && s.v === s.moves.length && Array.isArray(s.players) && s.players.length === 2 && s.players[0] !== s.players[1] && s.players.every(okId))) return false;
    try { return !!cfg.replay(s); } catch (_) { return false; }
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const compatible = s => !st || s.game > st.game || (s.players.join('|') === st.players.join('|') && st.moves.every((x, i) => same(s.moves[i], x)) && same(s.x, st.x));
  const seatsHere = () => mode !== 'online' || (ready && net.connected() && st && st.players.every(id => id === me() || net.alive().includes(id)));
  const ctx = () => ({ st, pos, mode, me: me(), nameOf, can: canMove(), play: m => move(m, mode === 'pass' ? st.players[pos.turn] : me()), ui });
  function canMove(){ return !!st && !pos.done && seatsHere() && (mode === 'pass' || st.players[pos.turn] === me()); }
  function accept(s, send){
    if (!valid(s) || !newer(s) || !compatible(s)) return;
    const old = st, prev = pos;
    st = JSON.parse(JSON.stringify({ game: s.game, v: s.v, players: s.players, moves: s.moves, x: s.x }));
    pos = cfg.replay(st); pos.prev = old && old.game === st.game ? prev : null;
    clearTimeout(botT); botT = null; if (!old || old.game !== st.game) ui.close();
    render(); if (send && mode === 'online') net.setState(st);
    after();
  }
  function move(m, by){
    if (!st || pos.done || st.players[pos.turn] !== by || !seatsHere()) return false;
    const s = Object.assign({}, st, { v: st.v + 1, moves: st.moves.concat([m]) });
    if (!valid(s)) return false;
    accept(s, true); return true;
  }
  function restart(){
    if (mode === 'online'){
      if (!ready || !net.connected()) return;
      if (st){ if (!st.players.includes(me()) || !seatsHere()){ ui.toast('等两位玩家都在线再开'); return; } if (me() !== st.players[0]){ net.emit('restart', { game: st.game }); return; } }
      else if (net.order().length !== 2 || net.order()[0] !== me()) return;
    }
    accept({ game: st ? st.game + 1 : 0, v: 0, players: st ? st.players.slice() : mode === 'online' ? net.order() : ['me', mode === 'bot' ? 'bot' : 'p2'], moves: [], x: cfg.extra ? cfg.extra() : undefined }, true);
  }
  function after(){
    if (pos.done){ const k = st.game + ':' + st.v; if (celebrated !== k){ celebrated = k; if (pos.winner >= 0) ui.burst('🎉'); } return; }
    if (mode === 'bot' && st.players[pos.turn] === 'bot'){
      const g = st.game, v = st.v;
      botT = setTimeout(() => { botT = null; if (st.game === g && st.v === v){ const m = cfg.bot(pos, st); if (m !== undefined && m !== null) move(m, 'bot'); } }, typeof cfg.botDelay === 'function' ? cfg.botDelay(pos) : (cfg.botDelay || 650));
    }
  }
  function render(){
    ui.roomTag(mode === 'online' ? net : null, code, mode === 'pass' ? '同一台手机 · 双人轮流' : '和电脑玩');
    $('copy').classList.toggle('hidden', mode !== 'online'); $('reacts').classList.toggle('hidden', mode !== 'online');
    const c = ctx(), can = c.can, S = $('status');
    S.className = 'status' + (can ? ' go' : '');
    if (!st) S.textContent = net && !net.connected() ? '连接中…' : '等 TA 进入同一个房间…';
    else if (pos.done) S.textContent = cfg.doneText ? cfg.doneText(c) : pos.winner < 0 ? '平手！🤝' : nameOf(st.players[pos.winner]) + '赢啦！🎉';
    else if (mode === 'online' && !st.players.includes(me())) S.textContent = '本局已有两位玩家，你正在观战';
    else if (!seatsHere()) S.textContent = !net.connected() ? '连接断开，正在重连…' : !ready ? '正在同步房间…' : '等 TA 回来，棋盘会留在这里';
    else S.textContent = cfg.turnText ? cfg.turnText(c) : can ? '轮到' + (mode === 'pass' ? nameOf(st.players[pos.turn]) : '你') : nameOf(st.players[pos.turn]) + '正在想…';
    $('round').textContent = st ? '第 ' + (st.game + 1) + ' 局 · 第 ' + (st.moves.length + (pos.done ? 0 : 1)) + ' 手' : '';
    for (let p = 0; p < 2; p++){
      const e = $('seat' + p);
      e.replaceChildren(...[].concat(cfg.seat(p, c)).map(x => typeof x === 'string' ? document.createTextNode(x) : x));
      e.classList.toggle('active', !!st && !pos.done && pos.turn === p);
    }
    if (st) cfg.draw(c);
    $('again').textContent = pos && pos.done ? '再来一局 · 交换先后手' : '重开一局';
    $('again').disabled = mode === 'online' && (!st || !seatsHere() || !st.players.includes(me()));
  }
  function scheduleInit(){ clearTimeout(initT); initT = setTimeout(() => { ready = true; if (!st) restart(); render(); }, 1200); }
  $('again').onclick = () => { if (st && !pos.done && st.moves.length) ui.modal('重开一局？', '当前这局会清空，并交换先后手。', [{ label: '取消' }, { label: '重开', primary: true, fn: restart }]); else restart(); };
  $('copy').onclick = () => ui.copyInvite(code, cfg.name);
  $('leave').onclick = () => { if (net) net.close(); location.href = '../' + (mode === 'online' ? '#' + code : ''); };
  ui.reacts(() => net, 9);
  function show(){ $('lobby').classList.add('hidden'); $('game').classList.remove('hidden'); }
  function local(kind){ mode = kind; show(); restart(); }
  $('pass').onclick = () => local('pass');
  ui.lobby({ onJoin(c){ mode = 'online'; code = c; show(); net = FB.net(cfg.key, c, {
    onConn(ok){ if (ok) scheduleInit(); else ready = false; render(); }, onPeers(j){ if (j.length) scheduleInit(); render(); }, onState(s){ accept(s, false); },
    onEvent(d){ if (!st || !st.players.includes(d.from)) return; if (d.t === 'react' && ui.EMO.slice(0, 9).includes(d.e)) ui.float(d.e); if (d.t === 'restart' && d.game === st.game && me() === st.players[0]) restart(); }
  }); render(); }, onLocal(){ local('bot'); } });
  return { render: () => st && render() };
};
