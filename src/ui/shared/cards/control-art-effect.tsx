import type { CombatState } from "../../../game/types";

// Alchemy's deterministic particle placement, adapted to a scalable SVG artwork layer.
function noise(index: number, salt: number) {
  const value = Math.sin(index * 12989 + salt * 78433) * 43758.5453;
  return value - Math.floor(value);
}
const stars = Array.from({ length: 8 }, (_, index) => {
  const variation = noise(index, 17);
  const angle = (index / 8) * Math.PI * 2 + variation * 0.35;
  const radius = 63 * (0.85 + variation * 0.3);
  return {
    x: 200 + Math.cos(angle) * radius,
    y: 84 + Math.sin(angle) * radius,
    size: (4 + variation * 5) * 1.5,
  };
});
const crystals = Array.from({ length: 12 }, (_, index) => {
  const along = noise(index, 41);
  const insetNoise = noise(index, 47);
  const inset = 4 + insetNoise * 13;
  const edge = index % 4;
  return {
    x: edge === 1 ? 400 - inset : edge === 3 ? inset : along * 400,
    y: edge === 0 ? inset : edge === 2 ? 300 - inset : along * 300,
    rotation: ((along * Math.PI + insetNoise) * 180) / Math.PI,
    size: 300 * 0.0226 * (0.7 + insetNoise * 0.5),
  };
});
const crystalPetal = "M0 0 L1.68 6 L0 6 L-1.68 6 Z M-1.32 3.3 H1.32";

export function ControlArtEffect({ kind }: { kind: CombatState["controlled"] }) {
  if (!kind) return null;
  return (
    <span className="control-art-effect" data-control-art={kind} aria-hidden="true">
      <svg viewBox="0 0 400 300" focusable="false">
        {kind === "stun" ? (
          <g className="control-stars">
            {stars.map((star, index) => (
              <g key={index} transform={`translate(${star.x} ${star.y}) scale(${star.size})`}>
                <path
                  className="control-star"
                  d="M0 -1 L.269 -.269 L1 0 L.269 .269 L0 1 L-.269 .269 L-1 0 L-.269 -.269 Z"
                />
              </g>
            ))}
          </g>
        ) : (
          crystals.map((crystal, index) => (
            <g
              key={index}
              transform={`translate(${crystal.x} ${crystal.y}) rotate(${crystal.rotation}) scale(${crystal.size / 6})`}
            >
              <g className="control-crystal">
                {Array.from({ length: 6 }, (_, petal) => (
                  <path key={petal} d={crystalPetal} transform={`rotate(${petal * 60})`} />
                ))}
              </g>
            </g>
          ))
        )}
      </svg>
    </span>
  );
}
