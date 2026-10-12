---
name: lexicon-ui
description: Build and maintain the Lexicon translation project's UI, shared native components, and extensible material suppliers. Use for reading desk, quick translation dialog, etymology cards, UI toolkit previews, or adding material websites in this project.
---

# Lexicon UI

Find the project root containing `ui-toolkit` and `stage0-prototype`. The toolkit is the shared source of styles, components, and material provenance.

- Read [design-system.md](references/design-system.md) for UI changes. Keep translation readable before progressively revealing etymology and source information. Preserve the explicit simulated-translation label until a real provider is connected.
- Reuse `ui-toolkit/components.css`, `ui-toolkit/components.js` and `ui-toolkit/tokens.css`. Preserve native HTML/CSS/ES modules. Introducing React or Tailwind requires a separate migration request; installing a skill does not justify one.
- For supplier or material work, read [provider-contract.md](references/provider-contract.md), then use the toolkit's local registry. Uiverse is the initial supplier. Imports start as candidates; source HTML is never inserted into the app as executable markup.
- For resource selection read [resource-routing.md](references/resource-routing.md). The official shadcn skill is available separately for an actual compatible shadcn project. Do not run its CLI against this native prototype solely to infer configuration.
- Check normal, busy, disabled, error, long-text and empty states applicable to the change. Verify keyboard focus and dialog restoration, narrow windows and reduced motion. Use the local preview and the real page; record observed results rather than inferring success from static source.
- Keep supplier versions, file hashes, author and license in the registry. Site-level licenses are discovery hints; individual materials require their own license evidence. Prefer verified local assets so suppliers are not contacted when using the app.

Run the project from its root: `python ui-toolkit/scripts/serve.py`. Open `/stage0-prototype/` for the app and `/ui-toolkit/preview/` for component and supplier management. API mutations are local registry edits only; importing a provider URL does not trigger a network fetch.
