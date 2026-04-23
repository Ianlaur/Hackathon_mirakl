# Pitch Mirakl × Mira — Visual Identity (25s video)

## Style

Velvet Standard (Vignelli) comme base — premium enterprise reveal.
Touches de Data Drift (Anadol) pour les moments AI (orbe, thinking, tool calls).
Pas de rainbow, pas d'Inter, pas de `#000` dead.

## Colors

- `#0A1528` — Canvas navy profond (dominant)
- `#060C18` — Navy quasi-noir (dégradés bas)
- `#0F2A44` — Mirakl deep blue (accents)
- `#3A6590` — Mirakl brand blue (signature, logo natif)
- `#6EA0C9` — Mirakl bright blue (halos, particules, highlights)
- `#6366F1` — Indigo Mira (chat, tool chips)
- `#EC4899` — Pink Mira (tool result accent)
- `#D6E4F2` — Frost (typography principale)
- `#F43F5E` — Critical red (stock négatif)
- `#10B981` — Success green (approval)
- `#F59E0B` — Amber (badge "À valider")
- `#FFFFFF` — Flash de transition uniquement

## Typography

- **Display** : `Space Grotesk` 100/300/600 — ghost words, tagline, outro
  - ALL CAPS + letter-spacing `0.42em+` pour labels
  - Weight 100 pour les ghost 400px+
- **UI** : `Inter` 300/400/600 — cards, counters, table SKU
- **Numeric** : `font-variant-numeric: tabular-nums` obligatoire sur counters et tableaux
- **Banned** : Roboto · Helvetica default · gradient text · heavy italic

## Motion — par acte

| Acte | Durée | Easings dominants | Ambient |
|------|-------|-------------------|---------|
| 1 Reveal | 0-6s | expo.out · power3.out · power2.in | Halo breath · logo rotate · particle drift |
| 2 Orb awakens | 6-10.5s | sine.inOut · power2.out · back.out(1.1) | Orb blobs drift · halo pulse |
| 3 The ask | 10.5-15s | power3.out (drawer) · none (typewriter) · sine.inOut | Spinner rotation · cursor blink |
| 4 The plan | 15-21s | expo.out (counters) · power2.out · back.out(1.2) on buttons | Counter ticks · badge pulse |
| 5 Close | 21-25s | power3.in (click) · power2.out (fade) · sine.inOut (outro float) | Orb mini breath · fade radial |

## Layers per scene (3+ minimum)

1. **Background** : dégradé navy + particules slow drift (persistent)
2. **Ghost** : mot géant opacity 5%, change par acte (MIRAKL → MIRA → CONGÉS → PLAN → MIRA)
3. **Structural** : hairlines top/bottom, kickers coins top-left/right (persistent)
4. **Content** : l'élément-héros de l'acte (logo / orbe / drawer / card / outro)
5. **Accent** : glow streaks, flashs, chips, particle bursts pendant transitions

## Anti-patterns (never)

- Fond blanc plat → toujours dégradé navy + radial tint
- Drop shadow colorée (cyan, violet) → drop-shadow navy uniquement
- Centering + vide autour → toujours 2+ focal points, anchor edges
- Rotation du ghost word → il est fixe (décor de fond)
- Bouncy elastic ease → pas Folk Frequency, pas playful
- Texte Inter 16px sur dark → minimum 20px + weight 300+
- `#000` ou `#fff` purs hors flash → tinter bleu

## Transitions between acts

- **1 → 2** : zoom-in sur dashboard (scale 1.8, translate vers bas-droit) — CONTINU, pas de cut
- **2 → 3** : orbe explose en particules + drawer slide-down (translateY -100% → 0, backdrop-blur 16px)
- **3 → 4** : wipe horizontal (divider vertical scaleX de la gauche à la droite)
- **4 → 5** : click flash + fade to navy (scale 0.96 bouton + white flash + opacity out all)

## Hero moments (= les frames exportables pour le pitch deck)

- t=2s — logo Mirakl full + halo + tagline
- t=9s — orbe Mira pulsant + label "Mira"
- t=14s — event recap 🏖️ Congés Savoie card visible
- t=19s — 3 counters : 5 / €2,430 / 7 mai
- t=24s — outro orbe + "Mira — Powered by Mirakl × Eugenia"
