'use strict';
/* Hoa lá vẽ bằng SVG (tự vẽ, chỉ dùng màu trong bảng màu của website) */
const Deco = (() => {
  const LEAF = ['#B2D1DF', '#A4C3D4', '#D7E5E8', '#8999B2'];
  const VEIN = '#71899F';
  const f = (n) => Math.round(n * 10) / 10;

  const leaf = (x, y, len, ang, col) =>
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"><path d="M0 0C${f(len * 0.3)} ${f(-len * 0.38)} ${f(len * 0.75)} ${f(-len * 0.32)} ${f(len)} 0C${f(len * 0.75)} ${f(len * 0.32)} ${f(len * 0.3)} ${f(len * 0.38)} 0 0Z" fill="${col}"/><path d="M${f(len * 0.08)} 0H${f(len * 0.85)}" stroke="${VEIN}" stroke-width=".7" opacity=".55" fill="none"/></g>`;

  const flower = (cx, cy, r, n, col, mid, rot = 0) => {
    let s = `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${rot})">`;
    for (let i = 0; i < n; i++) s += `<ellipse cx="0" cy="${f(-r * 0.58)}" rx="${f(r * 0.34)}" ry="${f(r * 0.58)}" fill="${col}" transform="rotate(${f((i * 360) / n)})"/>`;
    return s + `<circle r="${f(r * 0.24)}" fill="${mid}"/><circle r="${f(r * 0.1)}" fill="#FFF5F7"/></g>`;
  };

  const bud = (x, y, r, col) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${col}"/>`;

  // cành cong đi qua P0 → P2, lá mọc hai bên
  function branch(P0, P1, P2, count, len0, len1, seed = 0) {
    const at = (t) => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
    const tan = (t) => {
      const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
      const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    };
    let s = `<path d="M${P0[0]} ${P0[1]}Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}" stroke="${VEIN}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".75"/>`;
    for (let i = 0; i < count; i++) {
      const t = 0.1 + (0.86 * i) / (count - 1 || 1);
      const [x, y] = at(t), a = tan(t), L = len0 + (len1 - len0) * t;
      const side = i % 2 ? 1 : -1;
      s += leaf(x, y, L, a + side * 52, LEAF[(i + seed) % LEAF.length]);
      if (i % 3 === 0) s += leaf(x, y, L * 0.7, a - side * 58, LEAF[(i + seed + 1) % LEAF.length]);
    }
    return { svg: s, at };
  }

  // hoa lá ở góc trang (neo ở góc trên-trái, hộp 220×220)
  function corner() {
    const b = branch([8, 190], [10, 14], [190, 8], 9, 30, 20);
    const b2 = branch([10, 120], [14, 60], [60, 14], 5, 18, 14, 2);
    const [fx, fy] = b.at(0.5), [gx, gy] = b.at(0.2), [hx, hy] = b.at(0.82);
    return (
      b.svg + b2.svg +
      flower(fx + 4, fy + 4, 22, 6, '#F3D3DE', '#E58BA2', 10) +
      flower(gx + 3, gy - 2, 14, 5, '#EBC0CF', '#D97996', -8) +
      flower(hx - 2, hy + 6, 11, 5, '#FCE4EB', '#E58BA2', 20) +
      bud(fx + 34, fy - 16, 3.2, '#E58BA2') + bud(fx - 22, fy + 30, 2.6, '#D97996') + bud(gx + 24, gy + 28, 2.4, '#EBC0CF') +
      bud(hx + 22, hy + 14, 2.6, '#E58BA2')
    );
  }

  const svg = (cls, w, h, inner, view) => `<svg class="${cls}" width="${w}" height="${h}" viewBox="${view}" aria-hidden="true" focusable="false">${inner}</svg>`;
  const cornerSvg = (cls) => svg('nb-art ' + cls, 200, 200, corner(), '0 0 220 220');

  // đường kẻ hoa dưới tên chương
  function divider() {
    let s = `<path d="M4 16Q40 4 80 16T156 16" stroke="${VEIN}" stroke-width="1.4" fill="none" opacity=".7"/>`;
    [[26, 10, -30], [58, 15, 35], [104, 12, -28], [134, 16, 30]].forEach(([x, y, a], i) => (s += leaf(x, y, 15, a, LEAF[i % 4])));
    s += flower(80, 16, 9, 5, '#F3D3DE', '#E58BA2') + flower(158, 16, 6, 5, '#EBC0CF', '#D97996') + flower(4, 16, 5, 5, '#EBC0CF', '#D97996');
    return svg('nb-flo', 164, 32, s, '0 0 164 32');
  }

  // hoa nhỏ gắn ở góc ảnh dán
  function tiny(k = 0) {
    const cols = [['#F3D3DE', '#E58BA2'], ['#EBC0CF', '#D97996'], ['#FCE4EB', '#C85F7D']][k % 3];
    return svg('nb-bloom', 38, 38, leaf(19, 19, 17, 150, '#B2D1DF') + leaf(19, 19, 15, 25, '#A4C3D4') + flower(19, 19, 11, 5, cols[0], cols[1], k * 13), '0 0 38 38');
  }

  // nhành hoa quanh ảnh bìa
  function cluster() {
    const b = branch([6, 150], [20, 40], [150, 10], 8, 26, 18, 1);
    const [fx, fy] = b.at(0.45), [gx, gy] = b.at(0.85);
    return svg('cv-art', 170, 170, b.svg + flower(fx + 2, fy + 2, 20, 6, '#F3D3DE', '#E58BA2', 6) + flower(gx, gy + 4, 12, 5, '#EBC0CF', '#D97996') + bud(fx + 26, fy - 14, 3, '#E58BA2'), '0 0 170 170');
  }

  const html = (s) => {
    const d = document.createElement('div');
    d.innerHTML = s;
    return d.firstElementChild;
  };
  return { corner: cornerSvg, divider: () => html(divider()), tiny: (k) => html(tiny(k)), cluster: () => html(cluster()), html };
})();
