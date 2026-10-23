type FieldFrame = {
  width: number; height: number; time: number; scroll: number; speed: number;
  x: number; y: number; active: boolean;
};

const symbols = '01<>/{}:+*';
const wrap = (value: number, size: number) => (value % size + size) % size;

/** Decorative signal data, drawn by the existing reveal canvas and its lifecycle. */
export function createMatrixField(fine: boolean) {
  const count = fine ? 280 : 96;
  const points = Array.from({ length: count }, (_, i) => ({
    x: (i * .61803398875 + .13) % 1,
    y: (i * .75487766624 + .31) % 1,
    depth: .35 + (i % 4) * .22,
    signal: i % 5 === 0,
  }));
  // Fixed local topology, calculated once rather than an all-pairs search per frame.
  const neighbors = points.map((point, index) => points.map((other, i) => ({
    index: i, distance: (point.x - other.x) ** 2 + (point.y - other.y) ** 2,
  })).filter(other => other.index > index).sort((a, b) => a.distance - b.distance).slice(0, 3).map(other => other.index));
  const positions = new Float32Array(count * 3);

  return function drawMatrix(ctx: CanvasRenderingContext2D, frame: FieldFrame) {
    const { width, height, time, scroll, speed, x, y, active } = frame;
    const energy = Math.min(1, Math.abs(speed) / 24);
    const reach = fine ? 240 : 0;
    ctx.save();
    ctx.lineWidth = .65;

    for (let i = 0; i < count; i++) {
      const point = points[i];
      let px = point.x * width + Math.sin(time * .18 + i * .7) * 15 + speed * point.depth * .45;
      let py = wrap(point.y * height + time * (4 + point.depth * 7) - scroll * .075 * point.depth, height);
      const dx = px - x, dy = py - y, distance = Math.hypot(dx, dy);
      const influence = active ? Math.max(0, 1 - distance / reach) : 0;
      if (influence) {
        const strength = influence * influence * 48, divisor = distance || 1;
        px += (dx - dy * .45) / divisor * strength;
        py += (dy + dx * .45) / divisor * strength;
      }
      positions[i * 3] = px; positions[i * 3 + 1] = py; positions[i * 3 + 2] = influence;
    }

    let links = 0;
    const linkBudget = fine ? 200 : 40;
    for (let i = 0; i < count && links < linkBudget; i++) {
      const px = positions[i * 3], py = positions[i * 3 + 1];
      for (const j of neighbors[i]) {
        if (links >= linkBudget) break;
        const qx = positions[j * 3], qy = positions[j * 3 + 1];
        const distance = Math.hypot(qx - px, qy - py);
        const influence = Math.max(positions[i * 3 + 2], positions[j * 3 + 2]);
        const limit = fine ? 112 + influence * 70 : 74;
        if (distance > limit) continue;
        const opacity = (1 - distance / limit) * (.25 + influence * .27);
        ctx.strokeStyle = `rgba(255,109,84,${opacity})`;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
        if (i % 4 === 0) {
          const travel = (time * .22 + i * .17) % 1;
          ctx.fillStyle = `rgba(239,238,233,${.25 + influence * .35})`;
          ctx.fillRect(px + (qx - px) * travel - 1, py + (qy - py) * travel - 1, 2, 2);
        }
        links++;
      }
    }

    for (let i = 0; i < count; i++) {
      const point = points[i], px = positions[i * 3], py = positions[i * 3 + 1], influence = positions[i * 3 + 2];
      const size = 1 + point.depth * 1.15 + influence * 1.1;
      const opacity = .24 + point.depth * .22 + influence * .3;
      ctx.fillStyle = point.signal ? `rgba(255,100,73,${opacity})` : `rgba(210,219,215,${opacity * .8})`;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
      if (i % 7 === 0) {
        ctx.strokeStyle = `rgba(255,109,84,${.16 + influence * .3})`;
        ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py); ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke();
      }
    }

    // Staggered code ribbons: no full-screen flashing or per-frame random glyph churn.
    const columns = Math.min(fine ? 52 : 17, Math.max(8, Math.floor(width / (fine ? 27 : 25))));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let column = 0; column < columns; column++) {
      const depth = .4 + column % 3 * .3;
      const spacing = 13 + column % 3 * 2;
      const tail = fine ? 16 + column % 9 : 10 + column % 4;
      const length = tail * spacing;
      const columnX = (column + .45) * width / columns + Math.sin(column * 2.4 + time * .12) * 8;
      const headY = wrap(column * 173.71 + time * (13 + depth * 13) - scroll * (.09 + depth * .08), height + length) - length * .18;
      ctx.font = `${column % 3 === 0 ? 11 : 9}px monospace`;
      for (let glyph = 0; glyph < tail; glyph++) {
        let px = columnX + speed * depth * glyph * .035;
        const py = headY - glyph * spacing;
        if (py < -12 || py > height + 12) continue;
        const dx = px - x, dy = py - y, distance = Math.hypot(dx, dy);
        const influence = active ? Math.max(0, 1 - distance / reach) : 0;
        px += Math.sign(dx || 1) * influence * influence * 32;
        const fade = (1 - glyph / tail) ** 1.4;
        const opacity = fade * (.3 + depth * .16 + influence * .25 + energy * .07);
        ctx.fillStyle = glyph === 0 ? `rgba(239,238,233,${.55 + influence * .25})`
          : column % 3 !== 1 ? `rgba(255,109,84,${opacity})` : `rgba(180,196,190,${opacity * .9})`;
        const character = symbols[(column * 11 + glyph * 7 + Math.floor(time * .7 + column * .37)) % symbols.length];
        ctx.fillText(character, px, py);
        if (glyph === 0) {
          ctx.fillStyle = `rgba(255,77,50,${.35 + influence * .3})`;
          ctx.fillRect(px - 1, py + 7, 2, 4 + energy * 9);
        }
      }
    }
    ctx.restore();
  };
}
