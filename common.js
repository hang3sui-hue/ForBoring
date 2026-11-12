// ForBoring shared helpers: username (cookie), room code, player id, hub presence
window.FB = (() => {
  const ADJ = ['开心的','困困的','暴躁的','软软的','神秘的','快乐的','认真的','迷糊的','傲娇的','勇敢的'];
  const ANI = ['小熊','小猫','小狗','兔子','企鹅','柴犬','海豹','仓鼠','水獭','考拉'];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function getCookie(k){ const m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); try { return m ? decodeURIComponent(m[1]) : null; } catch(_) { return null; } }
  function setCookie(k, v){ document.cookie = k + '=' + encodeURIComponent(v) + '; path=/; max-age=31536000; SameSite=Lax'; }
  function store(k, v){ setCookie(k, v); try { localStorage.setItem(k, v); } catch(_) {} }
  function read(k){ let v = getCookie(k); if (!v) { try { v = localStorage.getItem(k); } catch(_) {} } return v; }

  function cleanName(n){ return String(n || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮<>]/g, '').trim().slice(0, 12); }
  function name(){ let n = cleanName(read('fb_name')); if (!n) { n = pick(ADJ) + pick(ANI); store('fb_name', n); } return n; }
  function setName(n){ n = cleanName(n); if (n) store('fb_name', n); return name(); }

  const ALNUM = 'abcdefghjkmnpqrstuvwxyz23456789';
  function randomRoom(){ let s = ''; for (let i = 0; i < 5; i++) s += ALNUM[Math.floor(Math.random() * ALNUM.length)]; return s; }
  function cleanRoom(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12); }
  function room(){ let r = cleanRoom(read('fb_room')); if (!r) { r = randomRoom(); store('fb_room', r); } return r; }
  function setRoom(r){ r = cleanRoom(r); if (r) store('fb_room', r); return room(); }

  function id(){ let v; try { v = localStorage.getItem('wzq-id'); } catch(_) {} if (!v) { v = Math.random().toString(36).slice(2, 12); try { localStorage.setItem('wzq-id', v); } catch(_) {} } return v; }

  // let the home page know where you are
  function hubBeat(client, code, myId, at){
    try { client.publish('hub-duo-v1/' + code + '/p/' + myId, JSON.stringify({ t: Date.now(), n: name(), at }), { qos: 1, retain: true }); } catch(_) {}
  }
  // Generic room connection for newer games: presence with names, one retained state doc, live events
  function net(game, code, h){
    const BROKER = 'wss://broker-cn.emqx.io:8084/mqtt', ALIVE = 45000;
    const base = 'fb-' + game + '-v1/' + code, myId = id();
    let conn = false, peers = new Map(), names = new Map(), was = new Set(), hb = null, tick = null;
    const client = mqtt.connect(BROKER, { clientId: game + '_' + myId + '_' + Math.random().toString(36).slice(2, 6), clean: true, keepalive: 30, reconnectPeriod: 2000, connectTimeout: 10000,
      will: { topic: base + '/p/' + myId, payload: '', qos: 1, retain: true } });
    const self = { myId, code };
    function beat(){ if (!conn) return; client.publish(base + '/p/' + myId, JSON.stringify({ t: Date.now(), n: name() }), { qos: 1, retain: true }); hubBeat(client, code, myId, game); }
    function check(){
      const cur = new Set(self.alive()), joined = [], left = [];
      cur.forEach(i => { if (!was.has(i)) joined.push(i); }); was.forEach(i => { if (!cur.has(i)) left.push(i); });
      was = cur; h.onPeers && h.onPeers(joined, left);
    }
    self.alive = () => { const now = Date.now(), r = []; peers.forEach((t, i) => { if (now - t < ALIVE) r.push(i); }); return r.sort(); };
    self.order = () => self.alive().concat(conn ? [myId] : []).sort().slice(0, 2);
    self.opp = () => self.order().find(i => i !== myId) || self.alive()[0] || null;
    self.nameOf = i => (i && names.get(i)) || 'TA';
    self.connected = () => conn;
    self.setState = s => { if (conn) client.publish(base + '/state', JSON.stringify(s), { qos: 1, retain: true }); };
    self.emit = (t, data) => { if (conn) client.publish(base + '/e', JSON.stringify(Object.assign({ t, from: myId }, data || {})), { qos: 0 }); };
    self.close = () => {
      clearInterval(hb); clearInterval(tick);
      try { if (conn) { client.publish(base + '/p/' + myId, '', { qos: 1, retain: true }); client.publish('hub-duo-v1/' + code + '/p/' + myId, '', { qos: 1, retain: true }); } client.end(false); } catch(_) {}
      conn = false;
    };
    client.on('connect', () => { conn = true; client.subscribe(base + '/#', { qos: 1 }); beat(); h.onConn && h.onConn(true); });
    client.on('close', () => { if (conn) { conn = false; h.onConn && h.onConn(false); } });
    client.on('offline', () => { conn = false; h.onConn && h.onConn(false); });
    client.on('error', () => {});
    client.on('message', (topic, payload) => {
      const sub = topic.slice(base.length + 1), txt = payload.toString();
      let d = null; if (txt) { try { d = JSON.parse(txt); } catch(_) { return; } }
      if (sub.startsWith('p/')) {
        const pid = sub.slice(2); if (!/^[a-z0-9]{1,16}$/.test(pid) || pid === myId) return;
        if (!d) peers.delete(pid); else if (typeof d.t === 'number') { peers.set(pid, d.t); const n = cleanName(d.n); if (n) names.set(pid, n); }
        check();
      } else if (sub === 'state') { if (d && h.onState) h.onState(d); }
      else if (sub === 'e') { if (d && d.from !== myId && typeof d.t === 'string' && h.onEvent) h.onEvent(d); }
    });
    hb = setInterval(beat, 15000); tick = setInterval(check, 5000);
    window.addEventListener('pagehide', () => self.close());
    return self;
  }

  // ---- small UI helpers shared by newer games (expects common.css + #toast/#modal markup) ----
  const $ = i => document.getElementById(i);
  const ui = {
    toast(m){ const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1900); },
    modal(title, text, btns){
      $('mT').textContent = title; $('mP').textContent = text || ''; const b = $('mBtns'); b.innerHTML = '';
      btns.forEach(x => { const e = document.createElement('button'); e.textContent = x.label; if (x.primary) e.className = 'primary'; e.onclick = () => { ui.close(); x.fn && x.fn(); }; b.appendChild(e); });
      $('modal').classList.remove('hidden');
    },
    close(){ $('modal').classList.add('hidden'); },
    float(e){ const el = document.createElement('div'); el.className = 'float'; el.textContent = e; el.style.left = (10 + Math.random() * 75) + 'vw'; document.body.appendChild(el); setTimeout(() => el.remove(), 2300); },
    burst(e){ for (let i = 0; i < 8; i++) setTimeout(() => ui.float(e), i * 120); },
    EMO: ['❤️','😘','😂','😤','👍','🥺','🎉','🥲','💥','😱'],
    // standard lobby: #code #rand #join (#local optional). onJoin(code) / onLocal()
    lobby(opt){
      const inp = $('code');
      inp.addEventListener('input', e => { const c = cleanRoom(e.target.value); if (c !== e.target.value) e.target.value = c; });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
      $('rand').onclick = () => { inp.value = randomRoom(); };
      $('join').onclick = () => {
        const c = cleanRoom(inp.value); if (!c) { ui.toast('先输入一个房间号'); inp.focus(); return; }
        if (!window.mqtt) { ui.toast('联机组件没加载出来，刷新试试'); return; }
        setRoom(c); try { history.replaceState(null, '', '#' + c); } catch(_) {}
        opt.onJoin(c);
      };
      if ($('local') && opt.onLocal) $('local').onclick = opt.onLocal;
      const h = cleanRoom(location.hash.slice(1)); inp.value = h || room();
      if (h) setTimeout(() => $('join').click(), 0);
    },
    reacts(getNet){
      const box = $('reacts'); if (!box) return;
      box.innerHTML = ui.EMO.slice(0, 8).map(e => '<button>' + e + '</button>').join('');
      box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const n = Date.now(); if (n - (b._t || 0) < 400) return; b._t = n; ui.float(b.textContent); const net = getNet(); net && net.emit('react', { e: b.textContent }); });
    },
    roomTag(net, code, label){
      const el = $('roomtag');
      if (!net) { el.textContent = label || ''; return; }
      el.innerHTML = '<span class="dot ' + (net.connected() && net.alive().length ? 'on' : '') + '"></span>房间 <b></b>'; el.querySelector('b').textContent = code;
    },
    copyInvite(code, gameName){
      const link = location.origin + location.pathname + '#' + code;
      const txt = name() + ' 喊你来玩' + gameName + '！打开 ' + link + ' ，房间号：' + code;
      try { navigator.clipboard.writeText(txt).then(() => ui.toast('邀请已复制，发给 TA 吧'), () => ui.toast('房间号：' + code)); } catch(_) { ui.toast('房间号：' + code); }
    }
  };

  return { name, setName, cleanName, room, setRoom, randomRoom, cleanRoom, id, hubBeat, net, ui };
})();
