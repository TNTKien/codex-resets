import { useMemo } from 'react';

type Contour = { d: string; major: boolean };

// Source-copy adaptation of ReEnd Components' topographic contour generator.
// It uses a multi-octave height field + marching squares, like the ReEnd docs demo.
export function generateTopoContours(
  vw: number,
  vh: number,
  levels = 18,
): Contour[] {
  const noise = (x: number, y: number): number =>
    Math.sin(x * 0.008 + y * 0.006) * 0.4 +
    Math.cos(x * 0.005 - y * 0.012 + 2.1) * 0.35 +
    Math.sin(x * 0.018 + y * 0.015 + 1.3) * 0.2 +
    Math.cos(x * 0.012 - y * 0.022 + 3.7) * 0.15 +
    Math.sin(x * 0.035 + y * 0.028 - 0.5) * 0.08 +
    Math.cos(x * 0.025 - y * 0.038 + 1.9) * 0.06 +
    Math.sin(x * 0.055 + y * 0.045 + 2.7) * 0.03;

  const step = 6;
  const cols = Math.ceil(vw / step) + 1;
  const rows = Math.ceil(vh / step) + 1;
  const field: number[][] = [];
  let fmin = Infinity;
  let fmax = -Infinity;

  for (let j = 0; j < rows; j += 1) {
    field[j] = [];
    for (let i = 0; i < cols; i += 1) {
      const value = noise(i * step, j * step);
      field[j][i] = value;
      if (value < fmin) fmin = value;
      if (value > fmax) fmax = value;
    }
  }

  // Marching squares edge table. 0=top, 1=right, 2=bottom, 3=left.
  const edgeTable: number[][] = [
    [], [3, 2], [2, 1], [3, 1], [1, 0], [3, 0, 1, 2], [2, 0], [3, 0],
    [0, 3], [0, 2], [0, 1, 2, 3], [0, 1], [1, 3], [1, 2], [2, 3], [],
  ];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const smoothPath = (points: [number, number][]): string => {
    if (points.length < 2) return '';
    if (points.length === 2) {
      return `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)} L ${points[1][0].toFixed(1)},${points[1][1].toFixed(1)}`;
    }

    let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const tension = 6;
      d += ` C ${(p1[0] + (p2[0] - p0[0]) / tension).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / tension).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / tension).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / tension).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };

  const result: Contour[] = [];

  for (let level = 0; level < levels; level += 1) {
    const threshold = fmin + ((level + 1) * (fmax - fmin)) / (levels + 1);
    const major = level % 4 === 0;
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (let j = 0; j < rows - 1; j += 1) {
      for (let i = 0; i < cols - 1; i += 1) {
        const tl = field[j][i];
        const tr = field[j][i + 1];
        const br = field[j + 1][i + 1];
        const bl = field[j + 1][i];
        let index = 0;
        if (tl >= threshold) index |= 8;
        if (tr >= threshold) index |= 4;
        if (br >= threshold) index |= 2;
        if (bl >= threshold) index |= 1;
        const edges = edgeTable[index];
        if (!edges.length) continue;

        const getEdgePoint = (edge: number): [number, number] => {
          const x0 = i * step;
          const y0 = j * step;
          switch (edge) {
            case 0: {
              const t = (threshold - tl) / (tr - tl || 1e-10);
              return [lerp(x0, x0 + step, t), y0];
            }
            case 1: {
              const t = (threshold - tr) / (br - tr || 1e-10);
              return [x0 + step, lerp(y0, y0 + step, t)];
            }
            case 2: {
              const t = (threshold - bl) / (br - bl || 1e-10);
              return [lerp(x0, x0 + step, t), y0 + step];
            }
            case 3: {
              const t = (threshold - tl) / (bl - tl || 1e-10);
              return [x0, lerp(y0, y0 + step, t)];
            }
            default:
              return [0, 0];
          }
        };

        for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 2) {
          const [x1, y1] = getEdgePoint(edges[edgeIndex]);
          const [x2, y2] = getEdgePoint(edges[edgeIndex + 1]);
          segments.push({ x1, y1, x2, y2 });
        }
      }
    }

    const key = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
    const endMap = new Map<string, number[]>();

    segments.forEach((segment, segmentIndex) => {
      for (const endpoint of [key(segment.x1, segment.y1), key(segment.x2, segment.y2)]) {
        if (!endMap.has(endpoint)) endMap.set(endpoint, []);
        endMap.get(endpoint)!.push(segmentIndex);
      }
    });

    const used = new Set<number>();
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      if (used.has(segmentIndex)) continue;
      used.add(segmentIndex);
      const segment = segments[segmentIndex];
      const chain: [number, number][] = [[segment.x1, segment.y1], [segment.x2, segment.y2]];

      let extending = true;
      while (extending) {
        extending = false;
        const endpoint = key(chain[chain.length - 1][0], chain[chain.length - 1][1]);
        for (const nextIndex of endMap.get(endpoint) || []) {
          if (used.has(nextIndex)) continue;
          used.add(nextIndex);
          const next = segments[nextIndex];
          chain.push(key(next.x1, next.y1) === endpoint ? [next.x2, next.y2] : [next.x1, next.y1]);
          extending = true;
          break;
        }
      }

      extending = true;
      while (extending) {
        extending = false;
        const endpoint = key(chain[0][0], chain[0][1]);
        for (const nextIndex of endMap.get(endpoint) || []) {
          if (used.has(nextIndex)) continue;
          used.add(nextIndex);
          const next = segments[nextIndex];
          chain.unshift(key(next.x1, next.y1) === endpoint ? [next.x2, next.y2] : [next.x1, next.y1]);
          extending = true;
          break;
        }
      }

      if (chain.length < 4) continue;
      result.push({ d: smoothPath(chain), major });
    }
  }

  return result;
}

export function TopoPattern({
  width = 600,
  height = 300,
  layers = 8,
  className = '',
}: {
  width?: number;
  height?: number;
  layers?: number;
  className?: string;
}) {
  const contours = useMemo(() => generateTopoContours(width, height, layers), [width, height, layers]);
  const filterId = useMemo(() => `reTopoGrain_${width}_${height}_${layers}`, [width, height, layers]);

  return <div className={`re-topo-pattern ${className}`.trim()} aria-hidden="true">
    <svg
      className="re-topo-pattern__grain"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <filter id={filterId}>
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>

    <svg
      className="re-topo-pattern__contours"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {contours.map((contour, index) => <path
        key={index}
        d={contour.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={contour.major ? 1.2 : 0.5}
      />)}
    </svg>
  </div>;
}
