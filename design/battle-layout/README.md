# Battle layout review

Open `/design/battle-layout/index.html?compare=1` with the Vite development server. The selected A composition is isolated from gameplay and save data. Idle and Targeting show the same frozen combat fixture; Play and End turn only clear the sample selection.

## Alchemy mana adaptation

Mana crystals reuse the original full/empty alpha artwork and the independent full/spent layers, brightness/desaturation, fade timing, sockets and masked hover/focus glint from Alchemy (source checkout `e2998c171`). Source references:

- `Alchemy: src/features/alchemy/run-loop/battle/presentation/ui/mana-dock.tsx`
- `Alchemy: src/styles/components.css` (`mana-dock-*`)
- `Alchemy: src/styles/keyframes.css` (`manaDockFill`, `manaDockSpend`, `manaDockGlint`)
- `Alchemy: src/assets/optimized/mana-dock-full.webp` → `public/ui/mana/full.webp`
- `Alchemy: src/assets/optimized/mana-dock-empty.webp` → `public/ui/mana/empty.webp`

The sample uses Fauna's shadcn Button/Tooltip, semantic surface tokens, native focus ring and reduced-motion handling. It has three fixed crystals and no Alchemy store, localization, overflow, capacity-loss or shard lifecycle. The frame asset is not used by Alchemy's current dock and is not copied. Alchemy is unchanged.
