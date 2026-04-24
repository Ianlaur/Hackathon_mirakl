# Pitch Mirakl x LEIA - Visual Identity

## Style

Velvet Standard as the base: premium enterprise reveal, precise layout, deep navy atmosphere. Use light data-drift effects for AI moments such as the orb, thinking state, and tool calls. The feel should be controlled, confident, and product-led.

## Colors

- `#0A1528` - Deep navy canvas
- `#060C18` - Near-black navy for lower gradients
- `#0F2A44` - Mirakl deep blue
- `#3A6590` - Mirakl brand blue
- `#6EA0C9` - Mirakl light blue
- `#6366F1` - LEIA indigo for chat and tool chips
- `#EC4899` - LEIA pink for tool result accents
- `#D6E4F2` - Frost typography
- `#F43F5E` - Critical red
- `#10B981` - Success green
- `#F59E0B` - Amber pending state
- `#FFFFFF` - Transition flash only

## Typography

- Display: `Space Grotesk` weights 100, 300, 600 for ghost words, tagline, and outro
- UI: `Inter` weights 300, 400, 600 for cards, counters, and SKU tables
- Numeric values use tabular figures
- Avoid Roboto, default Helvetica, gradient text, and heavy italic styling

## Motion By Act

| Act | Duration | Dominant Easing | Ambient Layer |
| --- | --- | --- | --- |
| 1 Reveal | 0-6s | `expo.out`, `power3.out`, `power2.in` | Halo breath, logo reveal, particle drift |
| 2 Orb awakens | 6-10.5s | `sine.inOut`, `power2.out`, `back.out(1.1)` | Orb drift, halo pulse |
| 3 The ask | 10.5-15s | `power3.out`, typewriter linear timing | Spinner rotation, cursor blink |
| 4 The plan | 15-21s | `expo.out`, `power2.out`, `back.out(1.2)` | Counter ticks, badge pulse |
| 5 Close | 21-25s | `power3.in`, `power2.out`, `sine.inOut` | Mini orb breath, radial fade |

## Scene Layers

1. Background: navy gradient and slow particle drift
2. Ghost word: large low-opacity word changing by act, such as MIRAKL, LEIA, LEAVE, PLAN, LEIA
3. Structure: top and bottom hairlines plus corner kickers
4. Content: the hero object for the act, such as logo, orb, drawer, card, or outro
5. Accent: glow streaks, flashes, chips, and particle bursts during transitions

## Anti-Patterns

- No flat white background
- No colorful decorative shadow on screenshots
- No empty center-only composition
- No rotating ghost word
- No playful elastic bounce
- No pure black or pure white outside transition flashes

## Transitions

- 1 to 2: continuous zoom into the dashboard toward the bottom right
- 2 to 3: orb particles expand while the chat drawer enters
- 3 to 4: horizontal wipe using a vertical divider
- 4 to 5: click flash, button scale, then fade to navy

## Deck Frames

- t=2s: Mirakl logo with halo and tagline
- t=9s: LEIA orb pulsing with the label "LEIA"
- t=14s: leave event recap card visible
- t=19s: three counters: SKU count, recovery value in EUR, target date
- t=24s: LEIA outro, powered by Mirakl x Eugenia
