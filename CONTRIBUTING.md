# Mitarbeit an der iPad-Ausgabe

Änderungen über einen Themenbranch und Pull Request gegen `main` einreichen.
Die iPad-Erweiterung ist JavaScript in `touch-nav.js`; der CAD-Kern stammt aus dem
in `project.json` festgehaltenen offiziellen Web-Release. Rust-Änderungen gehören
in einen nachvollziehbaren Source-Fork bzw. als Vorschlag zum Originalprojekt.

Eigene Beiträge stehen unter MIT OR Apache-2.0; nur Code und Materialien einreichen,
für die du die erforderlichen Rechte hast. Fremde Quellen und deren Lizenzen dokumentieren.
Bestehende Urheber-, Marken- und Lizenzhinweise erhalten. Geänderte Originaldateien
mit einem Änderungsvermerk kennzeichnen und `FORK-NOTICE.md` aktualisieren.

Vor dem PR: die Prüfkommandos aus der README ausführen. Bei sichtbaren Änderungen
Screenshots und Testgerät/iPadOS/Safari-Version angeben. `python3 scripts/release.py prepare`
hält den Offline-Cache konsistent. Keine generierten Hashlisten von Hand pflegen.

Eine Versionsänderung betrifft `project.json`, die passende Überschrift in
`CHANGELOG.md` und die sichtbaren Angaben in README und Infoseite. Für ein neues
Original-Release auch Prüfsummen, Herkunftsinventar und Lizenztexte aktualisieren;
niemals nur einen Versionsstring austauschen. Vorgehen: `docs/RELEASING.md`.
