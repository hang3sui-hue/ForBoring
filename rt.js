// ForBoring shared shell for real-time 2-player games.
// It handles the lobby, the room connection and who is in the room; each game runs its own rounds.
// cfg = { key, name, localLabel, passLabel, start(L), event(d, L), peers(L) }
// L = { mode: 'online'|'bot'|'pass', myId, emit(t, data), isHost(), both(), opp(), nameOf(id), connected() }
window.FBLive = cfg => {
  'use strict';
  const ui = FB.ui, $ = id => document.getElementById(id);
  const L = { mode: null, myId: FB.id(), net: null, code: '' };
  L.emit = (t, d) => { if (L.mode === 'online' && L.net) L.net.emit(t, d); };
  L.connected = () => L.mode !== 'online' || (L.net && L.net.connected());
  L.pair = () => L.mode === 'online' ? L.net.order() : ['me', L.mode === 'bot' ? 'bot' : 'p2'];
  L.both = () => L.mode !== 'online' || (L.net.connected() && L.pair().length === 2 && L.pair().includes(L.myId));
  L.isHost = () => L.mode !== 'online' || L.pair()[0] === L.myId;
  L.me = () => L.mode === 'online' ? L.myId : 'me';
  L.opp = () => L.mode === 'online' ? (L.pair().find(i => i !== L.myId) || null) : (L.mode === 'bot' ? 'bot' : 'p2');
  L.nameOf = id => L.mode === 'pass' ? (id === 'me' ? '一号玩家' : '二号玩家') : id === 'bot' ? '电脑' : id === L.me() ? '你' : L.net ? L.net.nameOf(id) : 'TA';
  L.watching = () => L.mode === 'online' && L.net.connected() && L.pair().length === 2 && !L.pair().includes(L.myId);
  function tag(){ ui.roomTag(L.mode === 'online' ? L.net : null, L.code, L.mode === 'pass' ? '同一台手机 · 双人对战' : L.mode === 'bot' ? '和电脑玩' : ''); }
  if ($('local') && typeof cfg.localLabel === 'string') $('local').textContent = cfg.localLabel;
  if ($('pass') && typeof cfg.passLabel === 'string') $('pass').textContent = cfg.passLabel;
  if ($('pass') && cfg.passLabel === false) $('pass').classList.add('hidden');
  if ($('local') && cfg.localLabel === false) $('local').classList.add('hidden');
  if (cfg.localLabel === false && cfg.passLabel === false && $('local')) $('local').closest('.card').querySelector('.divider').classList.add('hidden');
  function show(){ $('lobby').classList.add('hidden'); $('game').classList.remove('hidden'); $('copy').classList.toggle('hidden', L.mode !== 'online'); $('reacts').classList.toggle('hidden', L.mode !== 'online'); tag(); }
  function local(kind){ L.mode = kind; show(); cfg.start(L); }
  if ($('pass')) $('pass').onclick = () => local('pass');
  $('copy').onclick = () => ui.copyInvite(L.code, cfg.name);
  $('leave').onclick = () => { if (L.net) L.net.close(); location.href = '../' + (L.mode === 'online' ? '#' + L.code : ''); };
  ui.reacts(() => L.net, 9);
  ui.lobby({ onJoin(c){ L.mode = 'online'; L.code = c; show();
    L.net = FB.net(cfg.key, c, {
      onConn(){ tag(); cfg.peers && cfg.peers(L); },
      onPeers(){ tag(); cfg.peers && cfg.peers(L); },
      onState(s){ cfg.state && cfg.state(s, L); },
      onEvent(d){ if (d.t === 'react' && ui.EMO.slice(0, 9).includes(d.e)) { ui.float(d.e); return; } cfg.event && cfg.event(d, L); }
    });
    setInterval(tag, 5000); cfg.start(L);
  }, onLocal(){ local('bot'); } });
  return L;
};
