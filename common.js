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
  return { name, setName, cleanName, room, setRoom, randomRoom, cleanRoom, id, hubBeat };
})();
