# VibeTravel Editorial Design System

## Direction

VibeTravel should feel like a beautifully edited travel journal that happens to be useful. Images, typography, spacing, and family-specific reasons carry the experience. Interface chrome stays quiet.

## Core principles

1. Lead with a story, destination, or decision—not a generic dashboard card.
2. Use editorial sections and hairline dividers before adding a container.
3. Reserve cards for bounded tasks, modals, and information that must remain grouped.
4. Use copper as a signature detail, never as the dominant surface color.
5. Keep one unmistakable primary action per screen.
6. Explain why a recommendation fits the travel group in short, scannable language.

## Palette

| Role | Value |
|---|---|
| Canvas | `#F3EFE7` |
| Quiet surface | `#FAF8F4` |
| Primary text / primary action | `#171512` |
| Secondary text | `#716960` |
| Hairline | `#D6CEC3` |
| Signature copper | `#A65636` |
| Copper wash | `#EEE0D5` |
| Success | `#526F61` |

Large orange or copper-filled panels are not part of this system. Use copper for eyebrows, active navigation, progress, links, and small moments of emphasis.

## Typography

- Display and destination titles: DM Serif Display on web; Georgia fallback on native.
- UI and body: DM Sans on web; the system sans on native.
- Headlines should be confident and spacious. Avoid excessive bold UI labels.
- Uppercase labels are short, small, and widely tracked.

## Geometry and surfaces

- Standard radius: 8px.
- Maximum radius for ordinary content: 12px.
- Pills are reserved for filters, tags, and status.
- Shadows are subtle and primarily used for image-led hero surfaces or overlays.
- Prefer edge-to-edge imagery, open canvas, and horizontal rules over stacks of floating white cards.

## Actions

- Primary action: near-black surface with warm white text.
- Secondary action: transparent with a hairline border or simple text link.
- Copper actions are reserved for small links and selected states.
- A tappable image must still include a visible action label.

## Platform parity

Mobile and web should share the palette, type hierarchy, editorial spacing, image treatment, and action hierarchy. Layouts may adapt to platform conventions; the brand should remain unmistakably the same.

## Discovery experience

- Mobile destination discovery is map-first. The map is an organizing surface, not decoration.
- Keep a visible destination selector above the map; opening it reveals a full-screen editorial city browser with search.
- Mood lenses must visibly change the featured destination and re-rank the collection immediately.
- “Worth a closer look” is ranked from the saved Family Vibe. Say which profile signals influenced the ordering.
- Curated collections should represent multiple world regions, including African destinations, rather than defaulting to North America, Europe, and East Asia.
- City and trip imagery must be destination-specific. Never silently substitute the generic travel fallback for a known city.
