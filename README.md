# SolidCraft iPad — inoffizielle Web-Anpassung

Eine eigenständige Touch-/Pencil-Erweiterung der Web-Ausgabe von
[SolidCraft](https://github.com/tangency-labs/solidcraft) von Tangency Labs.
**Kein offizielles SolidCraft- oder Apple-Produkt; keine Unterstützung oder Prüfung durch diese Unternehmen.**

[Web-App öffnen](https://wegwerf-231.github.io/solidcraft-ipad/) ·
[Eigene Releases](https://github.com/wegwerf-231/solidcraft-ipad/releases) ·
[Änderungen](CHANGELOG.md) · [Herkunft und Lizenzen](docs/LEGAL.md)

## Versionen

Die **iPad-Ausgabe 0.6.2** basiert auf **SolidCraft 0.29.0**.
Die verbindlichen Angaben stehen in [project.json](project.json).
Die Versionsnummer im eingebetteten CAD-Programm bezeichnet weiterhin das Original;
die iPad-Version steht im Seitentitel, auf der Infoseite und in den Release-Metadaten.

Dieses Repository enthält die fertige Web-Ausgabe und den lesbaren Quellcode der
Erweiterung in [touch-nav.js](touch-nav.js), [pencil-sketch.js](pencil-sketch.js),
[sketch-tools.js](sketch-tools.js), [sketch-tools-view.js](sketch-tools-view.js) und [touch-shell.js](touch-shell.js), **keinen Rust-Quellbaum**.
Der CAD-Kern und seine JavaScript-Bindings sind unverändert aus dem offiziellen
Release übernommen; das WASM liegt für GitHub in fünf Teilen vor.
Die ursprüngliche Touch-Kennung `3.6` war keine veröffentlichte Projektversion.

## Auf dem iPad

In Safari öffnen; über Teilen → Zum Home-Bildschirm lässt sich die Seite installieren.
Nach einem vollständigen ersten Download ist die App offline nutzbar.
Pencil bearbeitet, Finger navigieren; die Zusatzleiste bietet Kontextaktionen und
Zahleneingabe. Funktionen und Grenzen: [IPAD-ANPASSUNG.md](IPAD-ANPASSUNG.md).
AP 3 und AP 4: [Bedienung und Abnahme](docs/SKETCH-IPAD.md).
AP 7: [iPad-Ansicht, Varianten und Erweitert-Modus](docs/TOUCH-SHELL.md).
AP 2/6: [Zeichenwerte, Variablen und Pencil-Gesten](docs/KEYPAD-PENCIL.md).
Optimierungen und Messverfahren: [iPad-Performance](docs/IPAD-PERFORMANCE.md).
Vor wichtigen Arbeiten auf dem eigenen Gerät testen und Designs regelmäßig exportieren.

## Entwickeln und prüfen

Python 3.11+ und Node.js 20+ reichen für die Auslieferung; keine zusätzlichen Pakete:

```sh
python3 scripts/release.py prepare
python3 scripts/release.py check
python3 -m unittest discover -s tests -v
node --check touch-nav.js
node --check canvas-shift.js
node --check pencil-sketch.js
node --check project-version.js
node --check touch-shell.js
node --check keypad-tools.js
node --check pencil-gestures.js
node --check sketch-tools.js
node --check sketch-tools-view.js
node --test tests/*.test.cjs
python3 -m http.server 8080 --bind 127.0.0.1
```

`prepare` erzeugt Versionsskript, Dateiprüfsummen und den Offline-Build gemeinsam.
Nach jeder Änderung erneut ausführen. Änderungen und Updates des Originalprogramms
stehen in [CONTRIBUTING.md](CONTRIBUTING.md), der Release-Ablauf in [docs/RELEASING.md](docs/RELEASING.md).

## Lizenz und Herkunft

Projektcode: **MIT OR Apache-2.0**, nach eigener Wahl. Die vollständigen Texte stehen in
[LICENSE-MIT](LICENSE-MIT) und [LICENSE-APACHE](LICENSE-APACHE).
[NOTICE](NOTICE) und [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt) bleiben erhalten;
Fonts haben eigene OFL-Hinweise. [FORK-NOTICE.md](FORK-NOTICE.md) benennt die Anpassungen.

Die Namensnennung von SolidCraft und iPad beschreibt Herkunft und Gerätekompatibilität.
Die Softwarelizenzen erteilen keine allgemeine Erlaubnis zur Nutzung fremder Marken.
Eine vollständige rechtliche Freigabe oder Prüfung unbekannter Rechte Dritter wird damit
nicht behauptet. Details und verbleibende Prüfpflichten: [docs/LEGAL.md](docs/LEGAL.md).
