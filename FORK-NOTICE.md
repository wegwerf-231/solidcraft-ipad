# Modifikationen und Herkunft der iPad-Ausgabe

Copyright (c) 2026 solidcraft-ipad contributors, für eigene Ergänzungen.
Lizenz eigener Ergänzungen: MIT OR Apache-2.0.
Urheberrechte am übernommenen Original verbleiben bei dessen Rechteinhabern.

Original: https://github.com/tangency-labs/solidcraft, Tangency Labs und SolidCraft contributors.
Basis: v0.29.0, Commit 3a5195b0a0aa359f6ebf10d890c1f887c70144b1.
Ausgangsimport dieses Repositories: 23c79605dd3ceb3d041a24f6d0ad6b6b8bb60735.
Keine Zugehörigkeit zu oder Unterstützung durch Tangency Labs oder Apple.
SolidCraft, iPad und Apple Pencil werden zur Beschreibung von Herkunft und Kompatibilität genannt.

## Veränderte und ergänzte Dateien

- `touch-nav.js`: eigenständige Touch-/Pencil-Bedienung, Auswahl, Kontextwerkzeuge,
  Ziffernfeld, Layout und Diagnosefunktionen; Projektversion vereinheitlicht;
  Versand von Diagnosen nur mit ausdrücklichem `?senddiagnostics=1` auf lokalen Hosts.
- `index.html`: Touch-Adapter und Projektmetadaten eingebunden; WASM-Teile zusammengefügt;
  Metadaten und sichtbare Projekt-/Lizenzinformation unterscheiden diese Ausgabe vom Original.
- `manifest.webmanifest`: Name und Beschreibung der inoffiziellen iPad-Ausgabe.
- `sw.js`: Änderungshinweis ergänzt; Versionskennung und Offline-Dateiliste durch
  `scripts/release.py` neu erzeugt. Die ursprüngliche Cache-Logik bleibt bestehen.
- `build.json`: aus eigener Version und ausgelieferten Dateien neu erzeugte Prüfsummen.
- `README.md`: Original-Projektbeschreibung durch Beschreibung dieser Auslieferung ersetzt.
- `project.json`, `project-version.js`, `about.html`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `docs/`, `legal/`, `scripts/`, `tests/` und `.github/`: neue Herkunfts-, Versions-,
  Lizenz-, Prüf- und Release-Struktur für diese Ausgabe.

Die fünf `wasm/*.bin` ergeben zusammengesetzt bytegenau das offizielle WASM-Modul.
Die JavaScript-Bindings, Original-Lizenztexte, NOTICE, Drittanbieterhinweise,
Fonts, Icons und Ladegrafik werden nicht als eigene Werke ausgegeben.
`legal/upstream-files.json` fixiert ihre Hashes. Die SHA-256 des offiziellen
Release-Archivs und des zusammengesetzten Moduls stehen in `project.json`.

`NOTICE` und beide Original-Lizenzen werden unverändert mitgeliefert.
Die zusätzlichen Hinweise in dieser Datei ändern keine Lizenzbedingungen.
