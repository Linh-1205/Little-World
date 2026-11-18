'use strict';
/* Trình trang trí: khung, bộ lọc, nhãn dán, chữ, vẽ tay — xuất ra ảnh JPEG */

const ED_RATIOS = { '1:1': [1080, 1080], '4:5': [1080, 1350], '3:4': [1080, 1440], '4:3': [1080, 810], '9:16': [1012, 1800] };
const ED_FRAMES = [['none', 'Không khung'], ['polaroid', 'Polaroid'], ['cream', 'Viền kem'], ['rounded', 'Bo tròn'], ['arch', 'Vòm cửa'], ['heart', 'Trái tim'], ['double', 'Viền đôi'], ['film', 'Phim']];
const ED_PAPER = ['#fffaf4', '#fbf0e4', '#f9dde3', '#efdccd', '#ffffff', '#6a5047'];
const ED_FILTERS = {
  none: ['Gốc', []],
  soft: ['Dịu nhẹ', [['#ffe6ee', 'soft-light', 0.55], ['#ffffff', 'screen', 0.08]]],
  warm: ['Ấm áp', [['#ffb27a', 'soft-light', 0.5], ['#ffe0b8', 'multiply', 0.12]]],
  rosy: ['Hồng mơ', [['#f4a6b8', 'soft-light', 0.6], ['#ffd9e2', 'screen', 0.1]]],
  dreamy: ['Mộng mơ', [['#fff0f5', 'screen', 0.2], ['#ffd1dc', 'soft-light', 0.35], ['glow']]],
  film: ['Phim cũ', [['#d9b38c', 'multiply', 0.3], ['#8a5a44', 'soft-light', 0.3]]],
  mono: ['Đen trắng', [['#808080', 'saturation', 1], ['#fff0e6', 'soft-light', 0.2]]],
};
const ED_EMOJI = ['💗', '💕', '🌸', '🎀', '✨', '🦋', '🌷', '🤍', '☁️', '🍓', '🧸', '💌', '🌙', '⭐', '🕊️', '🫶', '🍒', '🌹', '🎈', '💫', '🐰', '🌼', '🍰', '☕'];
const ED_TAPES = ['rgba(246,205,213,.8)', 'rgba(233,216,200,.85)', 'rgba(255,238,214,.9)', 'rgba(220,235,225,.85)'];
const ED_FONTS = {
  hand: ['Chữ viết tay', '"Dancing Script",cursive', '600', ''],
  serif: ['Cổ điển', '"Cormorant Garamond",serif', '600', 'italic '],
  play: ['Thanh lịch', '"Playfair Display",serif', '500', 'italic '],
  sans: ['Hiện đại', '"Be Vietnam Pro",sans-serif', '500', ''],
};
const ED_COLORS = ['#5a4137', '#d4788f', '#eaa3b3', '#ffffff', '#8b6b5d', '#f6cdd5', '#c98a5b', '#222222'];

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
    paper: '#fffaf4',
    filter: 'none',
    fk: 1,
    photo: { z: 1, ox: 0, oy: 0 },
    items: [],
    strokes: [],
    sel: null,
    tool: 'move',
    brush: { mode: 'pen', color: '#e7a1b0', size: 14 },
    text: { font: 'hand', color: '#5a4137' },
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
      c.strokeStyle = 'rgba(139,107,93,.14)';
      c.lineWidth = 2;
      c.strokeRect(x, y, w, hh);
      c.strokeStyle = 'rgba(139,107,93,.1)';
      c.lineWidth = 4;
      c.strokeRect(1, 1, W - 2, H - 2);
    } else if (st.frame === 'cream') {
      c.strokeStyle = '#d9b9a6';
      c.lineWidth = 3;
      c.strokeRect(x - 14, y - 14, w + 28, hh + 28);
    } else if (st.frame === 'double') {
      c.strokeStyle = '#d4788f';
      c.lineWidth = 3;
      c.strokeRect(x - 16, y - 16, w + 32, hh + 32);
      c.lineWidth = 1.5;
      c.strokeRect(x - 30, y - 30, w + 60, hh + 60);
    } else if (st.frame === 'film') {
      const s = x * 0.34, step = s * 1.9;
      c.fillStyle = '#fbf3ea';
      for (let yy = step * 0.5; yy < H - s; yy += step) {
        edRoundRect(c, (x - s) / 2, yy, s, s * 1.2, 5);
        c.fill();
        edRoundRect(c, x + w + (x - s) / 2, yy, s, s * 1.2, 5);
        c.fill();
      }
    } else if (['round', 'arch', 'heart'].includes(g.shape)) {
      shapePath(c, g);
      c.strokeStyle = 'rgba(255,255,255,.95)';
      c.lineWidth = 12;
      c.stroke();
      c.strokeStyle = 'rgba(234,163,179,.55)';
      c.lineWidth = 2;
      c.stroke();
    }
    c.restore();
  }

  function itemFont(it) {
    if (it.type === 'emoji') return `${120}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    const f = ED_FONTS[it.font];
    return `${f[3]}${f[2]} 90px ${f[1]}`;
  }
  function itemBox(it) {
    if (it.type === 'tape') return [300 * it.k, 70 * it.k];
    if (it.type === 'emoji') return [150 * it.k, 150 * it.k];
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
      c.shadowColor = 'rgba(90,60,50,.2)';
      c.shadowBlur = 6;
      c.fillRect(-150, -35, 300, 70);
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.28)';
      for (let i = -140; i < 150; i += 22) c.fillRect(i, -35, 8, 70);
    } else {
      c.font = itemFont(it);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (it.type === 'text') {
        c.lineJoin = 'round';
        c.strokeStyle = it.color === '#ffffff' ? 'rgba(90,65,55,.35)' : 'rgba(255,255,255,.55)';
        c.lineWidth = 8;
        c.strokeText(it.t, 0, 0);
        c.fillStyle = it.color;
      }
      c.fillText(it.type === 'emoji' ? it.t : it.t, 0, 0);
    }
    c.restore();
    if (selected) {
      const [bw, bh] = itemBox(it);
      c.save();
      c.translate(it.x, it.y);
      c.rotate(it.r);
      c.setLineDash([12, 8]);
      c.lineWidth = 3;
      c.strokeStyle = '#d4788f';
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
    ctx.fillStyle = st.frame === 'film' ? '#6a5047' : st.paper;
    ctx.fillRect(0, 0, W, H);
    // vùng ảnh
    ctx.save();
    shapePath(ctx, g);
    ctx.clip();
    ctx.fillStyle = st.frame === 'film' ? '#4d3a33' : st.paper === '#ffffff' || st.frame === 'none' ? st.paper : '#f3e4da';
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
  const delBtn = h('button', { class: 'btn ghost sm danger', type: 'button', onclick: removeSel }, '🗑 Xoá mục chọn');
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
  const swatches = (colors, get, set) => {
    const row = h('div', { class: 'sw' });
    const paint = () => $$('button', row).forEach((b, i) => b.classList.toggle('on', colors[i] === get()));
    colors.forEach((c) => row.append(h('button', { type: 'button', style: { background: c }, 'aria-label': c, onclick: () => (set(c), paint()) })));
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
    swatches(ED_PAPER, () => st.paper, (v) => ((st.paper = v), render())),
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
  const tabStick = h('div', { class: 'tp' },
    h('h5', null, 'NHÃN DÁN'),
    h('div', { class: 'emo' }, ED_EMOJI.map((e) => h('button', { type: 'button', onclick: () => addItem({ type: 'emoji', t: e }) }, e))),
    h('h5', null, 'BĂNG DÁN WASHI'),
    h('div', { class: 'sw' }, ED_TAPES.map((c) => h('button', { type: 'button', style: { background: c, borderRadius: '8px', width: '46px' }, 'aria-label': 'Băng dán', onclick: () => addItem({ type: 'tape', color: c }) }))),
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
    swatches(ED_COLORS, () => st.text.color, (v) => { st.text.color = v; if (st.sel?.type === 'text') ((st.sel.color = v), render()); }),
    h('button', { class: 'btn ghost sm', type: 'button', onclick: () => textInput.value.trim() ? (addItem({ type: 'text', t: textInput.value.trim(), font: st.text.font, color: st.text.color }), (textInput.value = '')) : toast('Nhập chữ trước nhé') }, '＋ Thêm chữ'),
  );
  // tab: Vẽ
  const brushSize = h('input', { type: 'range', min: 3, max: 60, value: st.brush.size });
  brushSize.addEventListener('input', () => (st.brush.size = +brushSize.value));
  const BR = ['#e7a1b0', '#d4788f', '#ffffff', '#5a4137', '#c98a5b', '#f6cdd5', '#a8c5b0', '#9db8d6'];
  const tabDraw = h('div', { class: 'tp' },
    h('h5', null, 'ĐẦU BÚT'),
    chipRow([['pen', '🖊 Bút'], ['marker', '🖍 Bút dạ'], ['eraser', '🧽 Tẩy']], () => st.brush.mode, (v) => (st.brush.mode = v)),
    h('h5', null, 'MÀU'),
    swatches(BR, () => st.brush.color, (v) => (st.brush.color = v)),
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
