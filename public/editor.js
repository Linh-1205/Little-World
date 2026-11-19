'use strict';
/* Trình trang trí: khung, bộ lọc, nhãn dán, chữ, vẽ tay — xuất ra ảnh JPEG */

const ED_RATIOS = { '1:1': [1080, 1080], '4:5': [1080, 1350], '3:4': [1080, 1440], '4:3': [1080, 810], '9:16': [1012, 1800] };
const ED_FRAMES = [['none', 'Không khung'], ['polaroid', 'Polaroid'], ['cream', 'Viền kem'], ['rounded', 'Bo tròn'], ['arch', 'Vòm cửa'], ['heart', 'Trái tim'], ['double', 'Viền đôi'], ['film', 'Phim']];
const ED_PAPER = ['#FFFCF7', '#FFF5F7', '#FCE4EB', '#E9E0D1', '#D7E5E8', '#FFFFFF', '#59434D', '#303B49'];
const ED_FILTERS = {
  none: ['Gốc', []],
  soft: ['Dịu nhẹ', [['#ffe6ee', 'soft-light', 0.55], ['#ffffff', 'screen', 0.08]]],
  warm: ['Ấm áp', [['#ffb27a', 'soft-light', 0.5], ['#ffe0b8', 'multiply', 0.12]]],
  rosy: ['Hồng mơ', [['#f4a6b8', 'soft-light', 0.6], ['#ffd9e2', 'screen', 0.1]]],
  dreamy: ['Mộng mơ', [['#fff0f5', 'screen', 0.2], ['#ffd1dc', 'soft-light', 0.35], ['glow']]],
  film: ['Phim cũ', [['#d9b38c', 'multiply', 0.3], ['#8a5a44', 'soft-light', 0.3]]],
  mono: ['Đen trắng', [['#808080', 'saturation', 1], ['#fff0e6', 'soft-light', 0.2]]],
};
const ED_GLYPHS = ['♡', '♥', '✦', '✧', '✶', '✿', '❀', '❁', '❋', '✺', '☾', '♪', '♫', '★', '☆', '❖', '◇', '◆', '✤', '❃', '❂', '✱', '☼', '⚘'];
const ED_TAPES = ['#EBC0CF', '#B2D1DF', '#E9E0D1', '#D7E5E8', '#F3D3DE', '#A4C3D4'];
const ED_FONTS = {
  hand: ['Chữ viết tay', '"Dancing Script",cursive', '600', ''],
  serif: ['Cổ điển', '"Cormorant Garamond",serif', '600', 'italic '],
  play: ['Thanh lịch', '"Playfair Display",serif', '500', 'italic '],
  sans: ['Hiện đại', '"Be Vietnam Pro",sans-serif', '500', ''],
};

function edRoundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}


/* ───── Bảng chọn màu dạng vòng RGB (vòng màu + ô độ đậm/sáng + mã HEX) ───── */
function cpHsv2rgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
}
function cpRgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
const cpHex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
function cpParse(x) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(x).trim());
  if (!m) return null;
  let t = m[1];
  if (t.length === 3) t = [...t].map((c) => c + c).join('');
  const n = parseInt(t, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorPicker({ value = '#E58BA2', onChange = () => {}, swatches = PALETTE } = {}) {
  const SZ = 220, C = SZ / 2, R = 104, r = 78, side = 108;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const x0 = C - side / 2, y0 = C - side / 2;
  let [H, S, V] = cpRgb2hsv(...(cpParse(value) || [229, 139, 162]));
  const cv = h('canvas', { class: 'cp-wheel', width: SZ * dpr, height: SZ * dpr, style: { width: SZ + 'px', height: SZ + 'px' } });
  const g = cv.getContext('2d');

  const ring = document.createElement('canvas'); // vòng màu, vẽ một lần
  ring.width = ring.height = SZ * dpr;
  {
    const x = ring.getContext('2d');
    x.scale(dpr, dpr);
    x.lineWidth = R - r + 1;
    for (let a = 0; a < 360; a++) {
      x.beginPath();
      x.strokeStyle = `hsl(${a},100%,50%)`;
      x.arc(C, C, (R + r) / 2, ((a - 0.8) * Math.PI) / 180, ((a + 1.2) * Math.PI) / 180);
      x.stroke();
    }
  }
  const sq = document.createElement('canvas'); // ô độ đậm (ngang) và độ sáng (dọc)
  sq.width = sq.height = side;
  const sqx = sq.getContext('2d');
  const paintSq = () => {
    const im = sqx.createImageData(side, side);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const [rr, gg, bb] = cpHsv2rgb(H, x / (side - 1), 1 - y / (side - 1));
        const i = (y * side + x) * 4;
        im.data[i] = rr; im.data[i + 1] = gg; im.data[i + 2] = bb; im.data[i + 3] = 255;
      }
    sqx.putImageData(im, 0, 0);
  };
  const hexNow = () => cpHex(...cpHsv2rgb(H, S, V));
  const knob = (x, y, fill) => {
    g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    g.lineWidth = 3; g.strokeStyle = '#FFFFFF'; g.stroke();
    g.beginPath(); g.arc(x, y, 10.8, 0, Math.PI * 2); g.lineWidth = 1; g.strokeStyle = '#59434D'; g.stroke();
  };
  const preview = h('span', { class: 'cp-prev' });
  const hex = h('input', { type: 'text', class: 'cp-hex', maxlength: 7, spellcheck: 'false', 'aria-label': 'Mã màu HEX' });
  const draw = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, SZ, SZ);
    g.drawImage(ring, 0, 0, SZ, SZ);
    g.drawImage(sq, x0, y0);
    const mid = (R + r) / 2;
    knob(C + mid * Math.cos((H * Math.PI) / 180), C + mid * Math.sin((H * Math.PI) / 180), `hsl(${H},100%,50%)`);
    knob(x0 + S * (side - 1), y0 + (1 - V) * (side - 1), hexNow());
    const c = hexNow();
    preview.style.background = c;
    if (document.activeElement !== hex) hex.value = c;
  };
  const emit = () => { draw(); onChange(hexNow()); };

  let mode = null;
  const pos = (e) => {
    const b = cv.getBoundingClientRect();
    return [((e.clientX - b.left) * SZ) / b.width, ((e.clientY - b.top) * SZ) / b.height];
  };
  const apply = (e) => {
    const [px, py] = pos(e);
    if (mode === 'hue') {
      H = ((Math.atan2(py - C, px - C) * 180) / Math.PI + 360) % 360;
      paintSq();
    } else {
      S = Math.min(1, Math.max(0, (px - x0) / (side - 1)));
      V = 1 - Math.min(1, Math.max(0, (py - y0) / (side - 1)));
    }
    emit();
  };
  cv.addEventListener('pointerdown', (e) => {
    const [px, py] = pos(e);
    const d = Math.hypot(px - C, py - C);
    if (d >= r - 4 && d <= R + 6) mode = 'hue';
    else if (px >= x0 - 6 && px <= x0 + side + 6 && py >= y0 - 6 && py <= y0 + side + 6) mode = 'sv';
    else return;
    cv.setPointerCapture(e.pointerId);
    apply(e);
  });
  cv.addEventListener('pointermove', (e) => mode && apply(e));
  const end = () => (mode = null);
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  const setHex = (c, fire) => {
    const rgb = cpParse(c);
    if (!rgb) return;
    [H, S, V] = cpRgb2hsv(...rgb);
    paintSq();
    fire ? emit() : draw();
  };
  hex.addEventListener('input', () => { const rgb = cpParse(hex.value); if (rgb) setHex(cpCanon(hex.value), true); });
  hex.addEventListener('blur', draw);
  const cpCanon = (x) => cpHex(...cpParse(x));
  const pal = h('div', { class: 'cp-pal' }, swatches.map((c) => h('button', { type: 'button', style: { background: c }, 'aria-label': c, title: c, onclick: () => setHex(c, true) })));

  paintSq();
  draw();
  return { el: h('div', { class: 'cp' }, cv, h('div', { class: 'cp-row' }, preview, hex), pal), set: (c) => setHex(c, false) };
}

async function openEditor({ src = null, onDone, title = 'Trang trí & vẽ' }) {
  const loading = toast('Đang mở trình trang trí…', 8000);
  let img = null;
  try {
    await Promise.all(['40px "Dancing Script"', '40px "Cormorant Garamond"', '40px "Playfair Display"', '40px "Be Vietnam Pro"'].map((f) => document.fonts.load(f, 'Aa Ă ơ')));
  } catch {}
  try {
    if (src) img = await loadImg(src);
  } catch (e) {
    loading.remove();
    return toast(e.message);
  }
  loading.remove();

  const st = {
    ratio: img ? (img.naturalWidth > img.naturalHeight * 1.15 ? '4:3' : img.naturalHeight > img.naturalWidth * 1.15 ? '4:5' : '1:1') : '4:5',
    frame: img ? 'polaroid' : 'none',
    paper: '#FFFCF7',
    filter: 'none',
    fk: 1,
    photo: { z: 1, ox: 0, oy: 0 },
    items: [],
    strokes: [],
    sel: null,
    tool: 'move',
    brush: { mode: 'pen', color: '#E58BA2', size: 14 },
    text: { font: 'hand', color: '#59434D' },
    tint: '#E58BA2',
  };
  let cur = null; // nét đang vẽ
  let drag = null;

  const cv = h('canvas');
  const ctx = cv.getContext('2d');
  const dl = h('canvas'); // lớp nét vẽ
  const dctx = dl.getContext('2d');
  const tmp = h('canvas');
  const tctx = tmp.getContext('2d');
  const meas = h('canvas').getContext('2d');

  const size = () => ED_RATIOS[st.ratio];

  function applySize() {
    const [W, H] = size();
    cv.width = dl.width = tmp.width = W;
    cv.height = dl.height = tmp.height = H;
    st.items.forEach((it) => ((it.x = Math.min(W, Math.max(0, it.x))), (it.y = Math.min(H, Math.max(0, it.y)))));
    rebuildDL();
  }

  function layout(W, H) {
    const m = Math.round(W * 0.055);
    switch (st.frame) {
      case 'polaroid': return { rect: [m, m, W - 2 * m, H - m - Math.round(H * 0.16)], shape: 'rect' };
      case 'cream': { const p = m * 1.5; return { rect: [p, p, W - 2 * p, H - 2 * p], shape: 'rect' }; }
      case 'rounded': return { rect: [m, m, W - 2 * m, H - 2 * m], shape: 'round' };
      case 'arch': { const w = W - m * 3; return { rect: [(W - w) / 2, m * 1.3, w, H - m * 2.3], shape: 'arch' }; }
      case 'heart': { const s = Math.min(W, H) - m * 2.4; return { rect: [(W - s) / 2, (H - s) / 2 - m * 0.3, s, s], shape: 'heart' }; }
      case 'double': { const p = m * 1.9; return { rect: [p, p, W - 2 * p, H - 2 * p], shape: 'rect' }; }
      case 'film': { const px = Math.round(W * 0.13), py = Math.round(W * 0.05); return { rect: [px, py, W - 2 * px, H - 2 * py], shape: 'rect' }; }
      default: return { rect: [0, 0, W, H], shape: 'rect' };
    }
  }

  function shapePath(c, g) {
    const [x, y, w, hh] = g.rect;
    if (g.shape === 'round') return edRoundRect(c, x, y, w, hh, w * 0.07);
    if (g.shape === 'arch') {
      c.beginPath();
      c.moveTo(x, y + hh);
      c.lineTo(x, y + w / 2);
      c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
      c.lineTo(x + w, y + hh);
      return c.closePath();
    }
    if (g.shape === 'heart') {
      c.beginPath();
      c.moveTo(x + w / 2, y + hh * 0.96);
      c.bezierCurveTo(x - w * 0.14, y + hh * 0.58, x + w * 0.02, y - hh * 0.04, x + w / 2, y + hh * 0.26);
      c.bezierCurveTo(x + w * 0.98, y - hh * 0.04, x + w * 1.14, y + hh * 0.58, x + w / 2, y + hh * 0.96);
      return c.closePath();
    }
    c.beginPath();
    c.rect(x, y, w, hh);
  }

  function photoBox(g) {
    const [x, y, w, hh] = g.rect;
    const s = Math.max(w / img.naturalWidth, hh / img.naturalHeight) * st.photo.z;
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    const mx = Math.max(0, (iw - w) / 2), my = Math.max(0, (ih - hh) / 2);
    st.photo.ox = Math.max(-mx, Math.min(mx, st.photo.ox));
    st.photo.oy = Math.max(-my, Math.min(my, st.photo.oy));
    return [x + (w - iw) / 2 + st.photo.ox, y + (hh - ih) / 2 + st.photo.oy, iw, ih];
  }

  function applyFilter(c, g) {
    const [x, y, w, hh] = g.rect;
    c.save();
    for (const [col, op, a] of ED_FILTERS[st.filter][1]) {
      if (col === 'glow') {
        const gr = c.createRadialGradient(x + w * 0.3, y + hh * 0.2, 0, x + w * 0.3, y + hh * 0.2, Math.max(w, hh) * 0.8);
        gr.addColorStop(0, 'rgba(255,255,255,.5)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalCompositeOperation = 'screen';
        c.globalAlpha = st.fk;
        c.fillStyle = gr;
        c.fillRect(x, y, w, hh);
        continue;
      }
      c.globalCompositeOperation = op;
      c.globalAlpha = Math.min(1, a * st.fk);
      c.fillStyle = col;
      c.fillRect(x, y, w, hh);
    }
    c.restore();
  }

  function decorate(c, g, W, H) {
    const [x, y, w, hh] = g.rect;
    c.save();
    c.lineJoin = 'round';
    if (st.frame === 'polaroid') {
      c.strokeStyle = '#EBC0CF';
      c.lineWidth = 2;
      c.strokeRect(x, y, w, hh);
      c.strokeStyle = '#F3D3DE';
      c.lineWidth = 4;
      c.strokeRect(1, 1, W - 2, H - 2);
    } else if (st.frame === 'cream') {
      c.strokeStyle = '#EBC0CF';
      c.lineWidth = 3;
      c.strokeRect(x - 14, y - 14, w + 28, hh + 28);
    } else if (st.frame === 'double') {
      c.strokeStyle = '#C85F7D';
      c.lineWidth = 3;
      c.strokeRect(x - 16, y - 16, w + 32, hh + 32);
      c.lineWidth = 1.5;
      c.strokeRect(x - 30, y - 30, w + 60, hh + 60);
    } else if (st.frame === 'film') {
      const s = x * 0.34, step = s * 1.9;
      c.fillStyle = '#FFFCF7';
      for (let yy = step * 0.5; yy < H - s; yy += step) {
        edRoundRect(c, (x - s) / 2, yy, s, s * 1.2, 5);
        c.fill();
        edRoundRect(c, x + w + (x - s) / 2, yy, s, s * 1.2, 5);
        c.fill();
      }
    } else if (['round', 'arch', 'heart'].includes(g.shape)) {
      shapePath(c, g);
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 12;
      c.stroke();
      c.strokeStyle = '#E58BA2';
      c.lineWidth = 2;
      c.stroke();
    }
    c.restore();
  }

  function itemFont(it) {
    if (it.type === 'glyph') return '120px "Be Vietnam Pro","Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols","Apple Symbols","DejaVu Sans",sans-serif';
    const f = ED_FONTS[it.font];
    return `${f[3]}${f[2]} 90px ${f[1]}`;
  }
  function itemBox(it) {
    if (it.type === 'tape') return [300 * it.k, 70 * it.k];
    if (it.type === 'glyph') return [150 * it.k, 150 * it.k];
    meas.font = itemFont(it);
    return [(meas.measureText(it.t).width + 30) * it.k, 120 * it.k];
  }
  function drawItem(c, it, selected) {
    c.save();
    c.translate(it.x, it.y);
    c.rotate(it.r);
    c.scale(it.k, it.k);
    if (it.type === 'tape') {
      c.fillStyle = it.color;
      c.fillRect(-150, -35, 300, 70);
    } else {
      c.font = itemFont(it);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (it.type === 'text') {
        c.lineJoin = 'round';
        c.strokeStyle = it.color.toLowerCase() === '#ffffff' ? '#59434D' : '#FFFFFF';
        c.lineWidth = 8;
        c.strokeText(it.t, 0, 0);
      }
      c.fillStyle = it.color;
      c.fillText(it.t, 0, 0);
    }
    c.restore();
    if (selected) {
      const [bw, bh] = itemBox(it);
      c.save();
      c.translate(it.x, it.y);
      c.rotate(it.r);
      c.setLineDash([12, 8]);
      c.lineWidth = 3;
      c.strokeStyle = '#C85F7D';
      c.strokeRect(-bw / 2, -bh / 2, bw, bh);
      c.restore();
    }
  }

  function drawStroke(c, s) {
    c.save();
    c.lineCap = c.lineJoin = 'round';
    c.lineWidth = s.size;
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.globalAlpha = s.mode === 'marker' ? 0.45 : 1;
    if (s.mode === 'eraser') c.globalCompositeOperation = 'destination-out';
    const p = s.pts;
    if (p.length === 1) {
      c.beginPath();
      c.arc(p[0][0], p[0][1], s.size / 2, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      c.stroke();
    }
    c.restore();
  }
  function rebuildDL() {
    dctx.clearRect(0, 0, dl.width, dl.height);
    st.strokes.forEach((s) => drawStroke(dctx, s));
  }

  function render(exporting) {
    const [W, H] = size();
    const g = layout(W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = st.frame === 'film' ? '#303B49' : st.paper;
    ctx.fillRect(0, 0, W, H);
    // vùng ảnh
    ctx.save();
    shapePath(ctx, g);
    ctx.clip();
    ctx.fillStyle = st.frame === 'film' ? '#59434D' : st.paper.toLowerCase() === '#ffffff' || st.frame === 'none' ? st.paper : '#F3DCE4';
    ctx.fillRect(...g.rect);
    if (img) {
      const [x, y, w, hh] = photoBox(g);
      ctx.drawImage(img, x, y, w, hh);
      if (st.filter !== 'none') applyFilter(ctx, g);
    }
    ctx.restore();
    decorate(ctx, g, W, H);
    // nét vẽ
    if (cur) {
      tctx.clearRect(0, 0, W, H);
      tctx.drawImage(dl, 0, 0);
      drawStroke(tctx, cur);
      ctx.drawImage(tmp, 0, 0);
    } else ctx.drawImage(dl, 0, 0);
    st.items.forEach((it) => drawItem(ctx, it, !exporting && it === st.sel));
  }

  /* ───── tương tác trên canvas ───── */
  const pt = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height];
  };
  function hit(x, y) {
    for (let i = st.items.length - 1; i >= 0; i--) {
      const it = st.items[i];
      const dx = x - it.x, dy = y - it.y;
      const c = Math.cos(-it.r), s = Math.sin(-it.r);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      const [bw, bh] = itemBox(it);
      if (Math.abs(lx) <= bw / 2 && Math.abs(ly) <= bh / 2) return it;
    }
    return null;
  }
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    if (st.tool === 'draw') {
      const b = st.brush;
      cur = { mode: b.mode, color: b.color, size: b.mode === 'eraser' ? b.size * 1.6 : b.size, pts: [[x, y]] };
      return render();
    }
    const it = hit(x, y);
    select(it);
    drag = it ? { kind: 'item', it, lx: x, ly: y } : img ? { kind: 'photo', lx: x, ly: y } : null;
    render();
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = pt(e);
    if (cur) {
      const l = cur.pts[cur.pts.length - 1];
      if (Math.hypot(x - l[0], y - l[1]) > 1.5) cur.pts.push([x, y]);
      return render();
    }
    if (!drag) return;
    if (drag.kind === 'item') {
      drag.it.x += x - drag.lx;
      drag.it.y += y - drag.ly;
    } else {
      st.photo.ox += x - drag.lx;
      st.photo.oy += y - drag.ly;
    }
    drag.lx = x;
    drag.ly = y;
    render();
  });
  const up = () => {
    if (cur) {
      st.strokes.push(cur);
      drawStroke(dctx, cur);
      cur = null;
      render();
    }
    drag = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  /* ───── giao diện ───── */
  const selBox = h('div', { class: 'ed-sel' });
  const szLabel = h('span', null, 'Phóng ảnh');
  const sz = h('input', { type: 'range', min: 1, max: 3, step: 0.01, value: 1 });
  const rotLabel = h('span', null, 'Xoay');
  const rot = h('input', { type: 'range', min: -180, max: 180, step: 1, value: 0 });
  selBox.append(szLabel, sz, rotLabel, rot);
  const delBtn = h('button', { class: 'btn ghost sm danger', type: 'button', onclick: removeSel }, 'Xoá mục chọn');
  const undoBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: undo }, '↶ Hoàn tác nét vẽ');

  function select(it) {
    st.sel = it;
    syncSel();
    if (it && it.type === 'text') textInput.value = it.t;
  }
  function syncSel() {
    const it = st.sel;
    rot.parentElement.style.opacity = '1';
    if (it) {
      szLabel.textContent = 'Kích thước';
      sz.min = 0.3; sz.max = 4; sz.value = it.k;
      rot.hidden = rotLabel.hidden = false;
      rot.value = Math.round((it.r * 180) / Math.PI);
    } else {
      szLabel.textContent = img ? 'Phóng ảnh' : 'Kích thước';
      sz.min = 1; sz.max = 3; sz.value = st.photo.z;
      sz.disabled = !img;
      rot.hidden = rotLabel.hidden = true;
    }
    delBtn.hidden = !it;
  }
  sz.addEventListener('input', () => {
    if (st.sel) st.sel.k = +sz.value;
    else st.photo.z = +sz.value;
    render();
  });
  rot.addEventListener('input', () => {
    if (st.sel) st.sel.r = (+rot.value * Math.PI) / 180;
    render();
  });
  function removeSel() {
    st.items = st.items.filter((i) => i !== st.sel);
    select(null);
    render();
  }
  function undo() {
    st.strokes.pop();
    rebuildDL();
    render();
  }
  function addItem(o) {
    const [W, H] = size();
    const it = { x: W / 2 + rnd(-90, 90), y: H / 2 + rnd(-90, 90), r: o.type === 'tape' ? rnd(-0.4, 0.4) : rnd(-0.2, 0.2), k: 1, ...o };
    st.items.push(it);
    select(it);
    render();
  }

  const chipRow = (list, get, set) => {
    const row = h('div', { class: 'chips' });
    const paint = () => $$('button', row).forEach((b, i) => b.classList.toggle('on', list[i][0] === get()));
    list.forEach(([val, lab]) => row.append(h('button', { class: 'chip', type: 'button', onclick: () => (set(val), paint()) }, lab)));
    paint();
    return row;
  };

  // tab: Khung
  const tabFrame = h('div', { class: 'tp' },
    h('h5', null, 'TỈ LỆ'),
    chipRow(Object.keys(ED_RATIOS).map((r) => [r, r]), () => st.ratio, (v) => ((st.ratio = v), applySize(), render())),
    h('h5', null, 'KHUNG'),
    chipRow(ED_FRAMES, () => st.frame, (v) => ((st.frame = v), render())),
    h('h5', null, 'MÀU GIẤY'),
    colorPicker({ value: st.paper, swatches: ED_PAPER, onChange: (v) => ((st.paper = v), render()) }).el,
    h('p', { class: 'hint muted' }, img ? 'Kéo ảnh trên khung để chỉnh vị trí, dùng thanh phóng ảnh ở dưới.' : 'Chọn màu giấy rồi sang tab Vẽ để tự vẽ nhé.'),
  );
  // tab: Lọc
  const fk = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: 1 });
  fk.addEventListener('input', () => ((st.fk = +fk.value), render()));
  const tabFilter = h('div', { class: 'tp' },
    h('h5', null, 'BỘ LỌC MÀU'),
    chipRow(Object.entries(ED_FILTERS).map(([k, v]) => [k, v[0]]), () => st.filter, (v) => ((st.filter = v), render())),
    h('h5', null, 'ĐỘ ĐẬM'), fk,
    img ? null : h('p', { class: 'hint muted' }, 'Bộ lọc chỉ áp dụng khi có ảnh.'),
  );
  // tab: Nhãn dán
  const tintPicker = colorPicker({ value: st.tint, onChange: (v) => { st.tint = v; if (st.sel?.type === 'glyph') ((st.sel.color = v), render()); } });
  const tabStick = h('div', { class: 'tp' },
    h('h5', null, 'KÝ TỰ TRANG TRÍ'),
    h('div', { class: 'emo' }, ED_GLYPHS.map((e) => h('button', { type: 'button', onclick: () => addItem({ type: 'glyph', t: e, color: st.tint }) }, e))),
    h('h5', null, 'MÀU KÝ TỰ'),
    tintPicker.el,
    h('h5', null, 'BĂNG DÁN'),
    h('div', { class: 'sw' }, ED_TAPES.map((c) => h('button', { type: 'button', style: { background: c, borderRadius: '6px', width: '46px' }, 'aria-label': 'Băng dán', onclick: () => addItem({ type: 'tape', color: c }) }))),
  );
  // tab: Chữ
  const textInput = h('input', { type: 'text', placeholder: 'Viết gì đó thật dịu dàng…', maxlength: 80 });
  textInput.addEventListener('input', () => {
    if (st.sel && st.sel.type === 'text') ((st.sel.t = textInput.value || ' '), render());
  });
  const tabText = h('div', { class: 'tp' },
    h('h5', null, 'NỘI DUNG'), textInput,
    h('h5', null, 'KIỂU CHỮ'),
    chipRow(Object.entries(ED_FONTS).map(([k, v]) => [k, v[0]]), () => st.text.font, (v) => { st.text.font = v; if (st.sel?.type === 'text') ((st.sel.font = v), render()); }),
    h('h5', null, 'MÀU CHỮ'),
    colorPicker({ value: st.text.color, onChange: (v) => { st.text.color = v; if (st.sel?.type === 'text') ((st.sel.color = v), render()); } }).el,
    h('button', { class: 'btn ghost sm', type: 'button', onclick: () => textInput.value.trim() ? (addItem({ type: 'text', t: textInput.value.trim(), font: st.text.font, color: st.text.color }), (textInput.value = '')) : toast('Nhập chữ trước nhé') }, '＋ Thêm chữ'),
  );
  // tab: Vẽ
  const brushSize = h('input', { type: 'range', min: 3, max: 60, value: st.brush.size });
  brushSize.addEventListener('input', () => (st.brush.size = +brushSize.value));
  const tabDraw = h('div', { class: 'tp' },
    h('h5', null, 'ĐẦU BÚT'),
    chipRow([['pen', 'Bút'], ['marker', 'Bút dạ'], ['eraser', 'Tẩy']], () => st.brush.mode, (v) => (st.brush.mode = v)),
    h('h5', null, 'MÀU'),
    colorPicker({ value: st.brush.color, onChange: (v) => (st.brush.color = v) }).el,
    h('h5', null, 'NÉT BÚT'), brushSize,
    undoBtn,
  );

  const tabs = [['Khung', tabFrame, 'move'], ['Lọc', tabFilter, 'move'], ['Nhãn dán', tabStick, 'move'], ['Chữ', tabText, 'move'], ['Vẽ', tabDraw, 'draw']];
  const body = h('div');
  const tabBar = h('div', { class: 'tabs' });
  function openTab(i) {
    $$('button', tabBar).forEach((b, j) => b.classList.toggle('on', i === j));
    body.replaceChildren(tabs[i][1]);
    st.tool = tabs[i][2];
    cv.classList.toggle('draw', st.tool === 'draw');
    if (st.tool === 'draw') select(null), render();
  }
  tabs.forEach(([lab], i) => tabBar.append(h('button', { type: 'button', onclick: () => openTab(i) }, lab)));

  const done = h('button', { class: 'btn primary', type: 'button', onclick: finish }, 'Xong ✓');
  const cancel = h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Huỷ');
  async function finish() {
    done.disabled = true;
    done.textContent = 'Đang xử lý…';
    try {
      select(null);
      render(true);
      const r = await fitCanvas(cv, 0.92);
      m.close();
      onDone && onDone(r.blob, r.w, r.h);
    } catch (e) {
      toast(e.message);
      done.disabled = false;
      done.textContent = 'Xong ✓';
    }
  }

  const root = h('div', { class: 'ed' },
    h('div', { class: 'ed-stage' }, cv, selBox, h('div', { class: 'chips' }, delBtn)),
    h('div', { class: 'ed-panel' }, tabBar, body, h('div', { class: 'ed-bar' }, cancel, done)),
  );
  const m = modal(title, root, { wide: true, sticky: true });
  const onKey = (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) removeSel();
  };
  document.addEventListener('keydown', onKey);
  new MutationObserver((_, ob) => {
    if (!document.body.contains(root)) {
      document.removeEventListener('keydown', onKey);
      ob.disconnect();
    }
  }).observe(document.body, { childList: true, subtree: true });

  applySize();
  openTab(0);
  syncSel();
  render();
}
