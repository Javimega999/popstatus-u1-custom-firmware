// Interfaz propia del PopStatus v3 (sustituye a la pagina generica de ESPHome).
// Habla con el firmware por /events (estado en directo) y POST /<tipo>/<nombre>/set.
(() => {
  const ESTADOS = [
    { id: 'Imprimiendo', ico: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z', txt: 'Mientras imprime' },
    { id: 'Preparando', ico: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1', txt: 'Nivelando y calibrando' },
    { id: 'Calentando', ico: 'M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z', txt: 'Antes de empezar' },
    { id: 'Pausa', ico: 'M8 5h3v14H8zM13 5h3v14h-3z', txt: 'Impresión en pausa' },
    { id: 'Terminado', ico: 'M5 12l4 4 10-10', txt: 'Al acabar' },
    { id: 'Enfriando', ico: 'M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7M9 4l3 2 3-2M9 20l3-2 3 2', txt: 'CryoGrip caliente: espera' },
    { id: 'Listo para despegar', ico: 'M7 11V6a2 2 0 1 1 4 0v5M11 10V4a2 2 0 1 1 4 0v6M15 10V6a2 2 0 1 1 4 0v8a7 7 0 0 1-14 0v-3a2 2 0 1 1 4 0', txt: 'CryoGrip fría: ya se suelta' },
    { id: 'Error', ico: 'M12 4l9 16H3zM12 10v4M12 17v.5', txt: 'Si algo falla' },
    { id: 'Cama caliente', ico: 'M4 18h16M7 14c0-2 2-2 2-4M12 14c0-2 2-2 2-4M17 14c0-2 2-2 2-4', txt: 'Cama a más de 50 °C' },
    { id: 'Reposo', ico: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z', txt: 'Encendida sin imprimir' },
    { id: 'Sin impresora', ico: 'M3 3l18 18M8 8H4v8h12M20 16V8h-8', txt: 'Impresora apagada' },
  ];
  const INFO = Object.fromEntries(ESTADOS.map(e => [e.id, e]));
  // valores de fabrica (los mismos que popstatus.yaml)
  const DEF = {
    'Reposo': ['Respirar', 'FFFFFF', 70, 60], 'Preparando': ['Onda', '8A5CFF', 70, 40],
    'Calentando': ['Barra de progreso', 'FF6A00', 70, 50], 'Imprimiendo': ['Barra de progreso', '00C8FF', 70, 50],
    'Pausa': ['Respirar', 'FFB000', 70, 50], 'Terminado': ['Fijo', '00FF3C', 80, 50],
    'Error': ['Parpadeo', 'FF0000', 100, 70], 'Listo para despegar': ['Respirar', '00FF3C', 80, 50], 'Enfriando': ['Barra de progreso', '7FDBFF', 70, 35], 'Cama caliente': ['Respirar', 'FF3000', 50, 25],
    'Sin impresora': ['Apagado', '3040FF', 20, 30],
  };
  const EFECTOS = ['Apagado', 'Fijo', 'Respirar', 'Parpadeo', 'Onda', 'Marquesina', 'Ciclo de color', 'Arcoíris', 'Barra de progreso', 'Cometa'];
  const PALETA = ['#FFFFFF', '#38C6FF', '#00C8FF', '#00FF3C', '#B6FF00', '#FFB000', '#FF6A00', '#FF0000', '#FF2E97', '#8A5CFF', '#3040FF'];
  const S = {};            // estado de todas las entidades: S['select/Reposo · Efecto'] = {...}
  const N = 27;
  let abierto = null, conectado = false;

  document.title = 'PopStatus';
  document.head.insertAdjacentHTML('beforeend', `
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0b0d10">
  <style>
  :root{--bg:#0b0d10;--card:#14171c;--card2:#1b1f26;--line:#242933;--tx:#eef1f5;--mut:#8d95a3;--dim:#596170;--acc:#38c6ff;--ok:#3ddc84;--bad:#ff5a5a;--glow:56,198,255}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  body{background:radial-gradient(900px 420px at 50% -120px,rgba(var(--glow),.16),transparent 70%) var(--bg) no-repeat}
  esp-app{display:none!important}
  button{font:inherit;color:inherit}
  .w{max-width:580px;margin:0 auto;padding:0 16px 56px}
  header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:12px 0;background:rgba(11,13,16,.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin:0 -16px;padding-left:16px;padding-right:16px}
  .logo{display:flex;align-items:center;gap:10px}
  .logo i{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,rgb(var(--glow)),#8a5cff);box-shadow:0 0 18px rgba(var(--glow),.5)}
  .logo h1{font-size:16px;margin:0;line-height:1.15}.logo small{display:block;font-size:12px;color:var(--mut);font-weight:500}
  .pill{display:flex;gap:7px;align-items:center;font-size:12px;color:var(--mut);background:var(--card);border:1px solid var(--line);padding:6px 11px;border-radius:99px}
  button.pill{cursor:pointer;font:inherit;font-size:12px;transition:.2s}button.pill:hover{border-color:var(--mut);color:var(--tx)}
  .modal{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s}
  .modal.on{opacity:1;pointer-events:auto}
  .modal .card{width:100%;max-width:460px;margin:0;max-height:calc(100vh - 32px);overflow:auto;transform:translateY(16px) scale(.98);transition:transform .25s}
  .modal.on .card{transform:none}
  .mcab{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:16px}
  .x{background:var(--card2);border:1px solid var(--line);border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--mut)}
  .pill i{width:7px;height:7px;border-radius:50%;background:var(--bad)}.pill.ok i{background:var(--ok);box-shadow:0 0 8px var(--ok)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;margin-top:12px}
  .hero{padding:18px;position:relative;overflow:hidden}
  .hero:before{content:"";position:absolute;inset:0;background:radial-gradient(420px 160px at 20% 0,rgba(var(--glow),.18),transparent 70%);pointer-events:none}
  .top{display:flex;align-items:center;gap:14px;position:relative}
  .ico{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(var(--glow),.14);border:1px solid rgba(var(--glow),.35);flex:none}
  .ico svg{width:24px;height:24px;stroke:rgb(var(--glow));fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .top .t{flex:1;min-width:0}
  .top b{font-size:24px;letter-spacing:-.02em;display:block;line-height:1.15}
  .top span{color:var(--mut);font-size:13px}
  .pct{font-size:34px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
  .pct small{font-size:16px;color:var(--mut);font-weight:600}
  .chips{display:flex;gap:6px;flex-wrap:wrap;position:relative}
  .chip{font-size:11.5px;padding:3px 9px;border-radius:99px;background:var(--card2);border:1px solid var(--line);color:var(--mut);margin-top:12px}
  .chip.y{color:#ffd27a;border-color:#5a4520;background:#2a2213}
  canvas.barra{display:block;width:100%;height:58px;margin:16px 0 4px}
  .prog{height:4px;border-radius:4px;background:var(--card2);overflow:hidden;margin-top:6px;display:none}
  .prog i{display:block;height:100%;width:0;background:rgb(var(--glow));transition:width .8s}
  .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;position:relative}
  .tile{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:10px 12px;min-width:0}
  .tile small{display:block;color:var(--mut);font-size:11.5px}
  .tile b{font-size:17px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
  .dot{display:inline-block;width:11px;height:11px;border-radius:50%;vertical-align:-1px;margin-right:5px;border:1px solid #555}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);margin:28px 4px 0;font-weight:600}
  .fila{display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--line)}
  .fila:first-child{border-top:0;padding-top:2px}.fila:last-child{padding-bottom:2px}
  .fila .t{flex:1;min-width:0}.fila .t small{display:block;color:var(--mut);font-size:12px}
  .sw{width:48px;height:28px;border-radius:99px;background:var(--line);position:relative;flex:none;cursor:pointer;transition:.25s;border:0;padding:0}
  .sw:after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#c9ced6;transition:.25s cubic-bezier(.3,1.4,.6,1)}
  .sw.on{background:var(--acc)}.sw.on:after{left:23px;background:#fff}
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;margin:12px 0 4px;background:linear-gradient(90deg,var(--acc) var(--p,50%),var(--line) var(--p,50%));outline:none}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 6px #0008;cursor:pointer}
  input[type=range]::-moz-range-thumb{width:20px;height:20px;border:0;border-radius:50%;background:#fff;cursor:pointer}
  .val{font-variant-numeric:tabular-nums;color:var(--tx);font-size:13px;min-width:44px;text-align:right;font-weight:600}
  .step{display:flex;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;flex:none}
  .step button{width:34px;height:34px;background:none;border:0;font-size:18px;cursor:pointer;color:var(--mut)}
  .step button:active{color:var(--tx)}
  .step span{min-width:52px;text-align:center;font-variant-numeric:tabular-nums;font-weight:600;font-size:14px}
  input[type=text],input[type=password]{background:var(--card2);color:var(--tx);border:1px solid var(--line);border-radius:12px;padding:9px 11px;font:inherit;width:100%}
  .estado{border-top:1px solid var(--line)}.estado:first-child{border-top:0}
  .cab{display:flex;align-items:center;gap:12px;padding:12px 0;cursor:pointer}
  .cab svg{width:20px;height:20px;stroke:var(--mut);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
  .cab .t{flex:1;min-width:0}.cab .t small{display:block;color:var(--mut);font-size:12px}
  .ahora{display:none;font-size:10.5px;margin-left:6px;padding:1px 7px;border-radius:99px;background:rgba(var(--glow),.18);color:rgb(var(--glow));vertical-align:2px}
  .estado.ya .ahora{display:inline}
  canvas.mini{width:78px;height:14px;flex:none}
  .flecha{color:var(--dim);transition:transform .25s;font-size:18px;width:10px}
  .estado.ab .flecha{transform:rotate(90deg)}
  .det{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
  .det>div{overflow:hidden;padding-left:32px}
  .estado.ab .det{grid-template-rows:1fr}
  .det .lb{display:flex;justify-content:space-between;color:var(--mut);font-size:12px;margin:14px 0 0}
  .det .lb b{color:var(--tx);font-weight:600}
  .efs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .efs button{background:var(--card2);border:1px solid var(--line);border-radius:99px;padding:6px 11px;font-size:13px;cursor:pointer;transition:.15s}
  .efs button.on{background:var(--tx);color:var(--bg);border-color:var(--tx);font-weight:600}
  .cols{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center}
  .cols button{width:30px;height:30px;border-radius:50%;border:2px solid var(--card);outline:2px solid transparent;cursor:pointer;padding:0;transition:.15s}
  .cols button.on{outline-color:#fff;transform:scale(1.08)}
  .pick{position:relative;width:30px;height:30px;border-radius:50%;background:conic-gradient(red,#ff0,lime,cyan,blue,#f0f,red);cursor:pointer}
  .pick input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
  .dos{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .acc{display:flex;gap:8px;margin:16px 0 14px}
  .btn{flex:1;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--card2);cursor:pointer;font-size:13.5px;font-weight:600}
  .btn.p{background:rgba(var(--glow),.16);border-color:rgba(var(--glow),.5);color:rgb(var(--glow))}
  .btn:disabled{opacity:.6;cursor:default}
  .pie{text-align:center;color:var(--dim);font-size:12px;margin-top:28px}
  .toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,30px);opacity:0;background:#f2f4f7;color:#111;padding:9px 16px;border-radius:99px;font-size:13px;font-weight:600;transition:.3s;pointer-events:none;z-index:9;box-shadow:0 6px 24px #0008}
  .toast.on{transform:translate(-50%,0);opacity:1}
  .aviso{display:none;margin-top:12px;padding:10px 14px;border-radius:14px;background:#2a1517;border:1px solid #5a2a2e;color:#ffb4b4;font-size:13px}
  .aviso.on{display:block}
  .cols2>.col>h2:first-child{margin-top:22px}
  .wifi input{margin-top:8px}
  .ojo{position:relative}.ojo button{position:absolute;right:6px;top:13px;background:none;border:0;color:var(--mut);cursor:pointer;font-size:12px;padding:6px}
  .nota{color:var(--mut);font-size:12px;margin:10px 0 0;line-height:1.5}
  .nota b{color:var(--tx)}
  .tile em{font-style:normal;font-size:11px;color:var(--mut);font-weight:500;margin-left:4px}
  @media (min-width:760px){.tiles{grid-template-columns:repeat(6,1fr)}}
  @media (min-width:1000px){
    .w{max-width:1180px;padding:0 28px 56px}
    .cols2{display:grid;grid-template-columns:1fr 1.2fr;gap:22px;align-items:start}
    .hero{display:grid;grid-template-columns:minmax(260px,1fr) 2fr;gap:6px 28px;align-items:center}
    .hero .top{grid-row:1}.hero canvas.barra{grid-column:2;grid-row:1;margin:0}
    .hero .prog,.hero .chips{grid-column:1/-1}.hero .tiles{grid-column:1/-1}
  }
  @media (max-width:420px){.tiles{grid-template-columns:repeat(2,1fr)}.top b{font-size:21px}.pct{font-size:28px}.det>div{padding-left:0}}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
  </style>`);

  const app = document.createElement('div');
  app.className = 'w';
  document.body.appendChild(app);

  const icono = d => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const k = (tipo, nombre) => `${tipo}/${nombre}`;
  const v = (tipo, nombre) => (S[k(tipo, nombre)] || {});
  const num = (tipo, nombre) => { const x = v(tipo, nombre).value; return (x == null || Number.isNaN(+x)) ? null : +x; };
  const hex = s => '#' + String(s || 'FFFFFF').replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const tiempo = m => m == null ? '—' : m < 60 ? Math.round(m) + ' min' : Math.floor(m / 60) + ' h ' + String(Math.round(m % 60)).padStart(2, '0') + ' min';

  let tt;
  const toast = txt => { const t = app.querySelector('.toast'); t.textContent = txt; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1600); };
  const enviar = (tipo, nombre, accion, param, aviso = 'Guardado ✓') =>
    fetch(`/${tipo}/${encodeURIComponent(nombre)}/${accion}`, { method: 'POST', body: new URLSearchParams(param || {}), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(r => { if (!r.ok) throw 0; if (aviso) toast(aviso); })
      .catch(() => toast('No se pudo guardar ✗'));

  const relleno = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  const paso = (n, min, max, inc, suf) =>
    `<div class="step" data-step="${n}" data-min="${min}" data-max="${max}" data-inc="${inc}" data-suf="${suf}"><button data-d="-1">−</button><span>—</span><button data-d="1">+</button></div>`;

  function pintarPagina() {
    app.innerHTML = `
    <header><div class="logo"><i></i><h1>PopStatus<small>Snapmaker U1</small></h1></div><button class="pill" id="wifi" title="Ajustes de WiFi"><i></i><span>Conectando…</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></header>
    <div class="aviso" id="aviso">Se ha perdido la conexión con el PopStatus. Reintentando…</div>

    <div class="card hero" id="hero">
      <div class="top"><div class="ico" id="hico"></div><div class="t"><b id="estado">—</b><span id="sub">—</span></div><div class="pct" id="pct"></div></div>
      <canvas class="barra" id="barra"></canvas>
      <div class="prog" id="prog"><i></i></div>
      <div class="chips" id="chips"></div>
      <div class="tiles">
        <div class="tile"><small>Boquilla</small><b id="boq">—</b></div>
        <div class="tile"><small>Cama</small><b><span id="cama">—</span><em id="placa"></em></b></div>
        <div class="tile"><small>Filamento</small><b id="fil">—</b></div>
        <div class="tile"><small>Capa</small><b id="capa">—</b></div>
        <div class="tile"><small>Imprimiendo</small><b id="dur">—</b></div>
        <div class="tile"><small>Queda</small><b id="queda">—</b></div>
      </div>
    </div>

    <div class="cols2"><div class="col">
    <h2>General</h2>
    <div class="card">
      <div class="fila"><div class="t">Luz encendida<small>Apaga la barra del todo</small></div><button class="sw" data-sw="Luz activa"></button></div>
      <div class="fila"><div class="t">Brillo general<input type="range" min="5" max="100" step="5" data-num="Brillo general"></div><span class="val" data-val="Brillo general"></span></div>
      <div class="fila"><div class="t">Color del filamento<small>Al imprimir, la barra usa el color del filamento en uso</small></div><button class="sw" data-sw="Color del filamento al imprimir"></button></div>
      <div class="fila"><div class="t">Invertir dirección<small>La barra se llena desde el otro lado</small></div><button class="sw" data-sw="Invertir dirección"></button></div>
      <div class="fila"><div class="t">Apagar en reposo tras<small>Minutos sin imprimir</small></div>${paso('Apagar en reposo tras (min, 0 = nunca)', 0, 240, 5, ' min')}</div>
      <div class="fila"><div class="t">Aviso de terminado<small>Minutos que dura el color de «Terminado»</small></div>${paso('Aviso de terminado durante (min)', 1, 240, 1, ' min')}</div>
    </div>

    <h2>Modo noche</h2>
    <div class="card">
      <div class="fila"><div class="t">Modo noche<small>Baja el brillo o la apaga por la noche</small></div><button class="sw" data-sw="Modo noche"></button></div>
      <div class="fila"><div class="t">Desde las</div>${paso('Noche desde (hora)', 0, 23, 1, ':00')}</div>
      <div class="fila"><div class="t">Hasta las</div>${paso('Noche hasta (hora)', 0, 23, 1, ':00')}</div>
      <div class="fila"><div class="t">Brillo de noche<small>0 = apagada</small><input type="range" min="0" max="100" step="5" data-num="Brillo de noche (0 = apagada)"></div><span class="val" data-val="Brillo de noche (0 = apagada)"></span></div>
    </div>

    </div><div class="col">

    <h2>Luces por estado</h2>
    <div class="card" style="padding-top:6px;padding-bottom:6px">
      ${ESTADOS.map(e => `
      <div class="estado" data-est="${e.id}">
        <div class="cab">${icono(e.ico)}<div class="t">${e.id}<span class="ahora">ahora</span><small>${e.txt}</small></div><canvas class="mini"></canvas><span class="flecha">›</span></div>
        <div class="det"><div>
          <div class="lb">Efecto</div><div class="efs">${EFECTOS.map(f => `<button data-ef="${f}">${f}</button>`).join('')}</div>
          <div class="lb">Color <b data-hex></b></div><div class="cols">${PALETA.map(c => `<button data-col="${c}" style="background:${c}" title="${c}"></button>`).join('')}<label class="pick" title="Otro color"><input type="color" data-pick></label></div>
          <div class="dos">
            <div><div class="lb">Brillo <b data-v="Brillo"></b></div><input type="range" min="0" max="100" step="5" data-r="Brillo"></div>
            <div><div class="lb">Velocidad <b data-v="Velocidad"></b></div><input type="range" min="5" max="100" step="5" data-r="Velocidad"></div>
          </div>
          <div class="acc"><button class="btn p" data-probar>▶ Probar en la barra</button><button class="btn" data-reset>Restablecer</button></div>
        </div></div>
      </div>`).join('')}
    </div>

    <h2>Impresora</h2>
    <div class="card">
      <div class="fila"><div class="t">IP de la impresora<small>Moonraker, puerto 7125</small></div><input type="text" style="width:150px" inputmode="decimal" data-txt="IP de la impresora"></div>
      <div class="fila"><div class="t">Despegar a<small>Con la CryoGrip, avisa cuando la cama baja de aquí</small></div>${paso('Despegar a (°C)', 15, 40, 1, ' °C')}</div>
      <div class="fila"><div class="t">Placa CryoGrip<small>Si la cama va a esta temperatura o menos, es la CryoGrip; si va a más, la PEI</small></div>${paso('CryoGrip hasta (°C)', 20, 60, 1, ' °C')}</div>
    </div>

    </div></div>
    <div class="pie" id="pie">Firmware propio · ESPHome</div>
    <div class="modal" id="wmodal">    <div class="card wifi" role="dialog" aria-label="WiFi"><div class="mcab"><b>📶 WiFi</b><button class="x" id="wcerrar" aria-label="Cerrar">✕</button></div>
      <div class="fila"><div class="t">Conectado a <b id="ssid">—</b><small id="wdet">—</small></div><button class="btn" style="flex:none" data-reiniciar>Reiniciar</button></div>
      <div class="fila" style="display:block">
        <div class="t">Cambiar de red<small>Escribe la red y la contraseña nuevas</small></div>
        <input type="text" id="wred" placeholder="Nombre de la red (SSID)" autocomplete="off" maxlength="32">
        <div class="ojo"><input type="password" id="wclave" placeholder="Contraseña" autocomplete="new-password" maxlength="64"><button type="button" id="wver">ver</button></div>
        <div class="acc" style="margin-bottom:0"><button class="btn p" id="wcambiar">Conectar a esta red</button></div>
        <p class="nota">Si la red nueva falla, en 30 s <b>vuelve sola a la de antes</b>.<br>Si cambias la contraseña del router sin hacer esto antes, el PopStatus crea la red <b>«PopStatus rescate»</b>: conéctate a ella con el móvil y te saldrá una página para elegir tu WiFi.</p>
      </div>
    </div>
</div>
    <div class="toast"></div>`;

    // eventos
    app.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
      const n = b.dataset.sw, on = !(v('switch', n).value);
      S[k('switch', n)] = { ...v('switch', n), value: on };   // respuesta inmediata
      refrescar();
      enviar('switch', n, on ? 'turn_on' : 'turn_off', null, null);
    });
    app.querySelectorAll('input[data-num]').forEach(i => {
      i.oninput = () => { relleno(i); const s = app.querySelector(`[data-val="${i.dataset.num}"]`); if (s) s.textContent = i.value + ' %'; };
      i.onchange = () => enviar('number', i.dataset.num, 'set', { value: i.value });
    });
    app.querySelectorAll('.step').forEach(st => {
      const n = st.dataset.step, min = +st.dataset.min, max = +st.dataset.max, inc = +st.dataset.inc;
      let espera;
      st.querySelectorAll('button').forEach(b => b.onclick = () => {
        const x = Math.min(max, Math.max(min, (num('number', n) ?? min) + inc * +b.dataset.d));
        S[k('number', n)] = { ...v('number', n), value: x };   // se ve al momento
        refrescar();
        clearTimeout(espera); espera = setTimeout(() => enviar('number', n, 'set', { value: x }), 500);
      });
    });
    const modal = app.querySelector('#wmodal');
    const abrirW = on => { modal.classList.toggle('on', on); if (on) setTimeout(() => app.querySelector('#wred').focus(), 250); };
    app.querySelector('#wifi').onclick = () => abrirW(true);
    app.querySelector('#wcerrar').onclick = () => abrirW(false);
    modal.onclick = e => { if (e.target === modal) abrirW(false); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') abrirW(false); });
    app.querySelector('#wver').onclick = ev => { const i = app.querySelector('#wclave'); i.type = i.type === 'password' ? 'text' : 'password'; ev.target.textContent = i.type === 'password' ? 'ver' : 'ocultar'; };
    app.querySelector('[data-reiniciar]').onclick = () => enviar('button', 'Reiniciar', 'press', null, 'Reiniciando… vuelve en unos segundos');
    app.querySelector('#wcambiar').onclick = async () => {
      const red = app.querySelector('#wred').value.trim(), clave = app.querySelector('#wclave').value;
      if (!red) return toast('Escribe el nombre de la red');
      if (clave && clave.length < 8) return toast('La contraseña debe tener 8 caracteres o más');
      await enviar('text', 'Nueva red WiFi', 'set', { value: red }, null);
      await enviar('text', 'Nueva contraseña WiFi', 'set', { value: clave }, null);
      await enviar('button', 'Cambiar WiFi', 'press', null, `Conectando a «${red}»…`);
      app.querySelector('#wclave').value = '';
    };
    app.querySelector('[data-txt]').onchange = e => enviar('text', e.target.dataset.txt, 'set', { value: e.target.value.trim() });
    app.querySelectorAll('.estado').forEach(el => {
      const e = el.dataset.est;
      el.querySelector('.cab').onclick = () => { abierto = abierto === e ? null : e; refrescar(); };
      el.querySelectorAll('[data-ef]').forEach(b => b.onclick = () => enviar('select', `${e} · Efecto`, 'set', { option: b.dataset.ef }));
      el.querySelectorAll('[data-col]').forEach(b => b.onclick = () => enviar('text', `${e} · Color (HEX)`, 'set', { value: b.dataset.col.slice(1) }));
      el.querySelector('[data-pick]').onchange = ev => enviar('text', `${e} · Color (HEX)`, 'set', { value: ev.target.value.slice(1).toUpperCase() });
      el.querySelectorAll('[data-r]').forEach(r => {
        r.oninput = () => { relleno(r); el.querySelector(`[data-v="${r.dataset.r}"]`).textContent = r.value + ' %'; };
        r.onchange = () => enviar('number', `${e} · ${r.dataset.r}`, 'set', { value: r.value });
      });
      el.querySelector('[data-probar]').onclick = () => enviar('select', 'Probar estado', 'set', { option: e }, 'Mira la barra 👀');
      el.querySelector('[data-reset]').onclick = async () => {
        const [ef, col, br, ve] = DEF[e];
        await Promise.all([
          enviar('select', `${e} · Efecto`, 'set', { option: ef }, null),
          enviar('text', `${e} · Color (HEX)`, 'set', { value: col }, null),
          enviar('number', `${e} · Brillo`, 'set', { value: br }, null),
          enviar('number', `${e} · Velocidad`, 'set', { value: ve }, null),
        ]);
        toast('Restablecido ✓');
      };
    });
  }

  function ajustes(e) {
    const d = DEF[e] || DEF['Reposo'];
    return {
      efecto: v('select', `${e} · Efecto`).state || d[0],
      color: hex(v('text', `${e} · Color (HEX)`).state || d[1]),
      brillo: Math.round(num('number', `${e} · Brillo`) ?? d[2]),
      vel: Math.round(num('number', `${e} · Velocidad`) ?? d[3]),
    };
  }

  // estado que se ve en la barra ahora mismo (el de prueba manda)
  const probando = () => { const p = v('select', 'Probar estado').state; return p && p !== 'No' ? p : null; };
  const actual = () => probando() || v('text_sensor', 'Estado').state || 'Sin impresora';
  function colorDe(e) {
    const a = ajustes(e), fc = v('text_sensor', 'Color filamento').state;
    if (e === 'Imprimiendo' && fc && v('switch', 'Color del filamento al imprimir').value && Math.max(...rgb('#' + fc)) > 40) a.color = '#' + fc;
    return a;
  }
  function esNoche() {
    if (!v('switch', 'Modo noche').value) return false;
    const h = new Date().getHours(), a = num('number', 'Noche desde (hora)') ?? 23, b = num('number', 'Noche hasta (hora)') ?? 8;
    return a <= b ? (h >= a && h < b) : (h >= a || h < b);
  }

  function refrescar() {
    const real = v('text_sensor', 'Estado').state || '—', est = actual(), pr = probando();
    const inf = INFO[est] || INFO['Sin impresora'];
    const listo = real !== '—';
    app.querySelector('#estado').textContent = pr ? `Probando: ${pr}` : listo ? real : 'Cargando…';
    app.querySelector('#hico').innerHTML = icono(inf.ico);
    const p = num('sensor', 'Progreso'), cal = num('sensor', 'Calentado'), imp = real === 'Imprimiendo';
    app.querySelector('#pct').innerHTML = imp && p != null ? `${Math.floor(p)}<small>%</small>` : real === 'Calentando' && cal != null ? `${Math.floor(cal)}<small>%</small>` : '';
    const capa = num('sensor', 'Capa'), tot = num('sensor', 'Capas totales'), rest = num('sensor', 'Tiempo restante'), dur = num('sensor', 'Tiempo imprimiendo');
    let sub = listo ? inf.txt : 'Leyendo el PopStatus';
    if (pr) sub = 'Se ve en la barra unos segundos';
    else if (imp) sub = (capa > 0 && tot > 0 ? `Capa ${capa} de ${tot}` : 'Imprimiendo') + (rest != null ? ` · quedan ${tiempo(rest)}` : '');
    else if (real === 'Calentando') sub = 'Calentando cama y boquilla';
    else if (real === 'Enfriando' && num('sensor', 'Temperatura cama') != null)
      sub = `Espera: ${Math.round(num('sensor', 'Temperatura cama'))} °C → ${num('number', 'Despegar a (°C)') ?? 28} °C`;
    else if (real === 'Listo para despegar') sub = 'Ya puedes quitar la pieza ❄️';
    app.querySelector('#sub').textContent = sub;
    const pg = app.querySelector('#prog'); pg.style.display = imp ? 'block' : 'none'; pg.firstChild.style.width = (p || 0) + '%';

    const chips = [];
    if (listo && !v('switch', 'Luz activa').value) chips.push('<span class="chip">💡 Luz apagada</span>');
    if (esNoche()) chips.push(`<span class="chip y">🌙 Modo noche · ${num('number', 'Brillo de noche (0 = apagada)') ?? 0} %</span>`);
    app.querySelector('#chips').innerHTML = chips.join('');

    const t = (id, x) => app.querySelector(id).innerHTML = x;
    const boq = num('sensor', 'Temperatura boquilla'), cama = num('sensor', 'Temperatura cama');
    const viva = real !== 'Sin impresora' && real !== '—';
    t('#boq', viva && boq != null ? Math.round(boq) + ' °C' : '—');
    t('#cama', viva && cama != null ? Math.round(cama) + ' °C' : '—');
    const pl = v('text_sensor', 'Placa').state;
    t('#placa', pl ? '· ' + pl : '');
    t('#ssid', v('text_sensor', 'Red WiFi').state || '—');
    const chip = num('sensor', 'Temperatura chip');
    const chipTxt = chip == null ? '' : `chip ${Math.round(chip)} °C${chip >= 70 ? ' ⚠️' : ''}`;
    t('#wdet', [v('text_sensor', 'IP').state, num('sensor', 'WiFi') != null ? Math.round(num('sensor', 'WiFi')) + ' dBm' : '', chipTxt].filter(Boolean).join(' · ') || '—');
    const fc = v('text_sensor', 'Color filamento').state;
    t('#fil', fc ? `<i class="dot" style="background:#${fc}"></i>${fc}` : '—');
    const hubo = imp || real === 'Pausa' || real === 'Terminado' || real === 'Listo para despegar' || real === 'Enfriando';
    t('#capa', hubo && capa > 0 ? `${capa}<small style="display:inline;font-size:12px"> / ${tot || '?'}</small>` : '—');
    t('#dur', hubo && dur > 0 ? tiempo(dur) : '—');
    t('#queda', imp ? tiempo(rest) : '—');

    const w = num('sensor', 'WiFi'), wi = app.querySelector('#wifi');
    wi.className = 'pill' + (conectado ? ' ok' : '');
    wi.querySelector('span').textContent = !conectado ? 'Sin conexión' : w != null ? `WiFi ${w > -60 ? 'buena' : w > -72 ? 'normal' : 'débil'} · ${Math.round(w)} dBm` : 'Conectado';
    const ver = v('text_sensor', 'Versión').state; if (ver) app.querySelector('#pie').textContent = 'Firmware propio v3 · ESPHome ' + ver.split(' ')[0] + (chipTxt ? ' · 🌡️ ' + chipTxt : '');

    app.querySelectorAll('[data-sw]').forEach(b => b.classList.toggle('on', !!v('switch', b.dataset.sw).value));
    app.querySelectorAll('input[data-num]').forEach(i => {
      const x = num('number', i.dataset.num);
      if (x == null || document.activeElement === i) return;
      i.value = x; relleno(i);
      const s = app.querySelector(`[data-val="${i.dataset.num}"]`); if (s) s.textContent = Math.round(x) + ' %';
    });
    app.querySelectorAll('.step').forEach(st => {
      const x = num('number', st.dataset.step);
      st.querySelector('span').textContent = x == null ? '—' : st.dataset.suf === ':00' ? String(x).padStart(2, '0') + ':00' : x === 0 && st.dataset.min === '0' ? 'nunca' : x + st.dataset.suf;
    });
    const ip = app.querySelector('[data-txt]'); const ipv = v('text', 'IP de la impresora').state;
    if (ipv && document.activeElement !== ip) ip.value = ipv;

    app.querySelectorAll('.estado').forEach(el => {
      const e = el.dataset.est, a = ajustes(e);
      el.classList.toggle('ab', abierto === e);
      el.classList.toggle('ya', e === est);
      el.style.setProperty('--glow', rgb(a.color).join(','));
      el.querySelectorAll('[data-ef]').forEach(b => b.classList.toggle('on', b.dataset.ef === a.efecto));
      el.querySelectorAll('[data-col]').forEach(b => b.classList.toggle('on', b.dataset.col.toUpperCase() === a.color));
      el.querySelector('[data-hex]').textContent = a.color;
      const pk = el.querySelector('[data-pick]'); if (document.activeElement !== pk) pk.value = a.color.toLowerCase();
      el.querySelectorAll('[data-r]').forEach(r => {
        const x = r.dataset.r === 'Brillo' ? a.brillo : a.vel;
        if (document.activeElement !== r) { r.value = x; relleno(r); el.querySelector(`[data-v="${r.dataset.r}"]`).textContent = x + ' %'; }
      });
      const b = el.querySelector('[data-probar]');
      b.disabled = pr === e; b.textContent = pr === e ? '● Probando…' : '▶ Probar en la barra';
    });
  }

  // --- vista previa: los mismos efectos que el firmware (popstatus_fx.h) ---
  const tono = h => { h -= Math.floor(h); const c = x => 255 * Math.min(1, Math.max(0, x));
    return [c(Math.abs(h * 6 - 3) - 1), c(2 - Math.abs(h * 6 - 2)), c(2 - Math.abs(h * 6 - 4))]; };
  const sv = x => x * x * (3 - 2 * x);
  function leds(a, t, prog, kk) {
    const vel = a.vel / 50, base = rgb(a.color), out = [];
    for (let i = 0; i < N; i++) {
      let c = base, f = 1;
      switch (a.efecto) {
        case 'Apagado': f = 0; break;
        case 'Respirar': f = .30 + .70 * sv(.5 + .5 * Math.sin(t * 3 * vel)); break;
        case 'Parpadeo': { const x = .5 + .5 * Math.sin(t * 2 * Math.PI * 2 * vel); f = .06 + .94 * sv(Math.min(1, Math.max(0, (x - .25) * 2))); break; }
        case 'Onda': f = .1 + .9 * sv(.5 + .5 * Math.sin(i * .45 - t * 4 * vel)); break;
        case 'Marquesina': { const d = (i + t * 8 * vel) % 4; f = .06 + .94 * sv(Math.max(0, 1 - Math.min(d, 4 - d))); break; }
        case 'Ciclo de color': c = tono(t * .08 * vel); break;
        case 'Arcoíris': c = tono(i / N + t * .15 * vel); break;
        case 'Barra de progreso': { const p = prog * N, ll = Math.floor(p);
          f = i < ll ? 1 : i === ll ? Math.max(p - ll, .2) * (.55 + .45 * sv(.5 + .5 * Math.sin(t * 4 * vel))) : .05; break; }
        case 'Cometa': { const d = (t * 12 * vel) % (N + 8) - i; f = d >= 0 && d < 8 ? sv(1 - d / 8) : 0; break; }
      }
      out.push([c[0] * f * kk, c[1] * f * kk, c[2] * f * kk]);
    }
    return out;
  }
  // de "potencia del LED" a color en pantalla (la pantalla no brilla como un LED)
  const pantalla = ([r, g, b]) => { const m = Math.max(r, g, b); if (m < 3) return null;
    const s = Math.min(1, Math.pow(m / 255, .55) * 1.15) * 255 / m; return [r * s, g * s, b * s].map(Math.round); };

  function ajustar(cv) {
    const d = devicePixelRatio || 1, w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return cv.getContext('2d');
  }
  const rr = (x, X, Y, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, w, h, r); else x.rect(X, Y, w, h); x.fill(); };
  function dibujar(cv, cols, grande) {
    const x = ajustar(cv), W = cv.width, H = cv.height; if (!W || !H) return;
    x.clearRect(0, 0, W, H);
    const pad = grande ? H * .22 : 0, gap = W * (grande ? .006 : .012), w = (W - pad * 2 - gap * (N - 1)) / N, h = H - pad * 2;
    x.save();
    if (grande) { x.fillStyle = '#07080a'; rr(x, 0, 0, W, H, H * .22); x.clip(); }
    cols.forEach((c, i) => {
      const p = pantalla(c), X = pad + i * (w + gap);
      if (grande && p) {               // halo, como si tuviera difusor
        const g = x.createRadialGradient(X + w / 2, H / 2, 0, X + w / 2, H / 2, H * .9);
        g.addColorStop(0, `rgba(${p},.35)`); g.addColorStop(1, `rgba(${p},0)`);
        x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(X - H, 0, w + H * 2, H); x.globalCompositeOperation = 'source-over';
      }
      x.fillStyle = p ? `rgb(${p})` : '#1a1d23';
      rr(x, X, pad, w, h, Math.min(w, h) * .3);
    });
    x.restore();
  }

  let glowCol = '';
  function animar() {
    const t = performance.now() / 1000, est = actual(), pr = probando();
    const a = colorDe(est);
    const kk = (num('number', 'Brillo general') ?? 70) / 100 * a.brillo / 100 * (esNoche() && !pr ? (num('number', 'Brillo de noche (0 = apagada)') ?? 15) / 100 : 1);
    const prog = pr ? (pr === 'Enfriando' ? 1 - Math.min(1, (t % 12) / 12) : Math.min(1, (t % 12) / 12)) : est === 'Enfriando' ? (num('sensor', 'Calor restante') || 0) / 100 : est === 'Calentando' ? (num('sensor', 'Calentado') || 0) / 100 : (num('sensor', 'Progreso') || 0) / 100;
    let cols = (v('switch', 'Luz activa').value || pr) ? leds(a, t, prog, kk) : leds({ ...a, efecto: 'Apagado' }, t, 0, 0);
    if (v('switch', 'Invertir dirección').value) cols = cols.reverse();
    const hb = app.querySelector('#barra'); if (hb) dibujar(hb, cols, true);
    // color de ambiente de la pagina = color del estado
    const g = ['Apagado', 'Arcoíris', 'Ciclo de color'].includes(a.efecto) ? '56,198,255' : rgb(a.color).join(',');
    if (g !== glowCol) { glowCol = g; document.documentElement.style.setProperty('--glow', g); }
    // mini vistas de cada estado
    app.querySelectorAll('.estado').forEach(el => {
      const e = el.dataset.est, b = colorDe(e);
      dibujar(el.querySelector('.mini'), leds(b, t, e === 'Imprimiendo' || e === 'Calentando' ? (t % 8) / 8 : e === 'Enfriando' ? 1 - (t % 8) / 8 : .6, Math.max(.35, b.brillo / 100)), false);
    });
    requestAnimationFrame(animar);
  }

  pintarPagina();
  refrescar();
  requestAnimationFrame(animar);
  setInterval(refrescar, 30000);   // para el modo noche aunque no lleguen datos
  let pendiente = false;
  const ahoraRefresca = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(() => { pendiente = false; refrescar(); }); } };
  const fuente = new EventSource('/events');
  fuente.onopen = () => { conectado = true; app.querySelector('#aviso').classList.remove('on'); ahoraRefresca(); };
  fuente.onerror = () => { conectado = false; app.querySelector('#aviso').classList.add('on'); ahoraRefresca(); };
  fuente.addEventListener('state', ev => {
    try { const d = JSON.parse(ev.data); S[d.id] = d; } catch (e) { return; }
    if (!conectado) { conectado = true; app.querySelector('#aviso').classList.remove('on'); }
    ahoraRefresca();
  });
})();
