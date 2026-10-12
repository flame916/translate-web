# Resource routing

Core local assets: Radix Colors gray/bronze/green/red CSS, Fontsource Inter Latin 400/600 WOFF2, original project SVG action icons. Actual downloaded versions and hashes are in `ui-toolkit/registry/resources.lock.json`.

shadcn official skill: installed separately under `.agents/skills/shadcn`, fetched from `shadcn-ui/ui/skills/shadcn` using the bundled skill installer. It becomes relevant for a project with compatible components.json/framework. Native components use the Lexicon toolkit without copying React source into vanilla JS.

Uiverse: download selected HTML snapshots from the official `uiverse-io/galaxy` archive, preserve the element author/URL and MIT evidence, adapt only the parts needed for a real workflow. The site's supplied snippets can become project components after namespace, token, interaction and accessibility review.

Optional: Rough.js for an intentional etymology visualization; Mermaid primarily for documentation; Simple Icons for real brand identities. GitHub README Stats and Markdown Badges belong in developer documents, not product statistics or trust badges. None are mandatory app dependencies.
