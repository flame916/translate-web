# Reading and interaction rules

Use warm neutral reading surfaces, dark navigation, and a restrained terracotta action color. Source text and translation default to 16px/1.65; explanatory metadata defaults to 12–14px. Inter is self-hosted for Latin text, with system Chinese fallback. General text contrast must be at least 4.5:1.

Map semantic variables to locally saved Radix gray, bronze, green and red scales. Use common spacing (4, 8, 12, 16, 24, 32px), 8px controls, 12px cards, 16px dialogs. Shared component rules live in `ui-toolkit/components.css`; app layout rules live in `stage0-prototype/styles.css`.

Use local SVG icons, visible labels and focus rings. Navigation always has an accessible name, even when collapsed. Status includes words, not color alone. Buttons do not announce successful copy until the clipboard operation succeeds.

Modal: save opener, isolate background, trap Tab, allow Escape, restore focus. Long content scrolls inside the panel. Keep font size readable when narrowing the viewport. Honor prefers-reduced-motion and never use perpetual decorative animations in the reading area.

Translation input, selected domain, pin state and history are business data, not material supplier data. UI refinements preserve these flows. Candidate snippets are shown as escaped text; only curated project components are executed in previews.
