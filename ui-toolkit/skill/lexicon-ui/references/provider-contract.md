# Provider and material records

Provider: id, name, homepage, allowedHosts, categories, formats, acquisition=manual, adapterId=manual-v1, licensePolicy, status (active/paused), createdAt and optional updatedAt. Homepage and material license links use HTTPS. Hosts match exactly, not suffixes. New suppliers can reuse manual importing without modifying the translation app.

Material: id, providerId, name, sourceUrl, author, category, format, status (candidate/adapted/verified/retired), license, licenseStatus, licenseEvidence, retrievedAt, contentHash, sourceFiles, adaptedFiles, usedIn, verification. An unknown license cannot be promoted to verified. Imported HTML/CSS is stored as data and never executed. Local paths are controlled by the server rather than supplied by the browser.

Use the preview's supplier form to add/pause sources, and its material form to import HTML/CSS snippets. The local server generates IDs and validates URLs, source hosts, categories and content limits, then atomically persists each JSON file and saves material snapshots. It rejects cross-origin writes, traversal paths, duplicate source URLs and unsupported categories. Manual license declarations remain pending review. The developer tool does not transmit translation or clipboard data.

Use `python ui-toolkit/scripts/registry.py validate` to verify registries, local file hashes, adopted-material provenance and resource files. Registry changes are independent of translation logic; pausing a source keeps already adopted components working.
