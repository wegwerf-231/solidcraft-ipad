# Versionen und Releases

## Drei getrennte Kennungen

1. **iPad-Version**: SemVer in `project.json`, zunächst `0.1.0`, Git-Tag `v0.1.0`.
   Patch für Korrekturen, Minor für kompatible Funktionen, Major für inkompatible Änderungen.
   Während 0.x Änderungen an Daten-/Bedienverträgen ausdrücklich im Changelog nennen.
   Vorabversionen etwa `0.2.0-rc.1` sind möglich; keine Tag-Namen vom Original übernehmen.
2. **Originalversion**: `upstream.version`, Tag und voller Commit bleiben separat erhalten.
3. **Offline-Build**: eigene Version plus Inhalts-Hash in `build.json` und `sw.js`.
   Jede Dateiänderung erzeugt eine neue Cache-Kennung, auch ohne Versionssprung.

## Vorbereiten

- Von `main` einen Release-Branch anlegen, Version und Changelog pflegen.
- README/Infoseite konsistent halten. Keine bereits veröffentlichten Versions-Tags ändern.
- `python3 scripts/release.py prepare` ausführen und alle Änderungen prüfen.
- `python3 scripts/release.py check`, `python3 -m unittest discover -s tests -v`,
  `node --check touch-nav.js`, `node --check project-version.js` ausführen.
- PR prüfen und nach `main` übernehmen. Keine private Konfiguration oder Designs einchecken.

Ein Maintainer setzt danach den passenden Tag auf einen geprüften Commit aus `main`.
Der Workflow `Release draft` prüft Tag, Metadaten, Integrität und das offizielle
Ursprungsarchiv erneut. Er erzeugt ausschließlich einen **Entwurf** mit:

- `solidcraft-ipad-VERSION.zip` (Web-App, eigener Quellcode, Dokumentation und Lizenzen),
- `SHA256SUMS.txt`,
- Release-Notizen mit Originalversion und beiden Quell-Commits.

Das ZIP ist bei gleichem Inhalt und Commit bytegleich reproduzierbar. Der Build
verwendet nur Python-Standardbibliothek; die Tests benötigen zusätzlich Node.js.
Lokal nach dem Commit: `python3 scripts/release.py package --tag v0.1.0 --output dist`.
Der CLI-Paketbau lehnt nicht eingecheckte Änderungen ab, damit der Herkunfts-Commit
den ausgelieferten Stand tatsächlich bezeichnet.

Vor Veröffentlichung die iPad-/Safari-Version und Tests zu Zeichnen, Navigation,
Maßeingabe, Speichern, Offline-Neustart und Update mit offenen Tabs in den
Release-Notizen festhalten. Der Workflow veröffentlicht weder Releases noch GitHub Pages.
Die bestehende Pages-Konfiguration bleibt davon unabhängig; `main` ist daher
nicht automatisch identisch mit dem zuletzt veröffentlichten Release.

## Neue SolidCraft-Basis übernehmen

1. Offizielles Release und dessen Commit wählen. Archiv herunterladen und dessen
   SHA-256 mit den offiziellen Release-Prüfsummen abgleichen.
2. Änderungen an Lizenzen, Drittanbieterhinweisen und Assets lesen; nichts blind ersetzen.
3. Unveränderte Runtime-Dateien übernehmen. WASM bei Bedarf in fortlaufende Teile
   unter 100 MB zerlegen; Reihenfolge in `index.html` und Inventar aktualisieren.
4. `project.json` mit Version, Quell-Commit, Archiv- und WASM-Hash aktualisieren.
   Originaldateien in `legal/upstream-files.json` ausdrücklich neu erfassen.
   Quellhinweise in `legal/upstream/` aus dem festgelegten Commit übernehmen.
5. Mit `verify-upstream --archive PFAD` Bytegleichheit mit dem Original prüfen;
   die rechtlichen Quellhinweise zusätzlich gegen den festgelegten Commit vergleichen.
6. Eigene Version erhöhen, Änderungen dokumentieren und vollständige Geräteprüfung durchführen.
