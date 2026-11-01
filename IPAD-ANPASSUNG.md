# SolidCraft für das iPad (inoffizielle Anpassung)

Diese Seite ist eine **inoffizielle**, private Anpassung der Web-Version von
[SolidCraft](https://github.com/tangency-labs/solidcraft) 0.29.0 von Tangency Labs. Sie steht in
keiner Verbindung zu Tangency Labs und wird von dort weder unterstützt noch geprüft.

SolidCraft steht unter der MIT- oder Apache-2.0-Lizenz (siehe `LICENSE-MIT`, `LICENSE-APACHE`,
`NOTICE` und `THIRD-PARTY-LICENSES.txt`). Diese Dateien gelten unverändert weiter.

## Änderungen gegenüber dem Original

* `touch-nav.js` (neu): Bedienung mit Fingern und Apple Pencil, Ziffernfeld, Kontextleiste.
* `index.html` (geändert): bindet `touch-nav.js` ein, Einstellungen für die Nutzung als iPad-App;
  in der GitHub-Fassung zusätzlich das Zusammensetzen der aufgeteilten Programmdatei.
* `sw.js`, `build.json` (geändert): Dateiliste für den Offline-Betrieb angepasst.
* `wasm/*.bin` (nur GitHub-Fassung): die unveränderte Datei `*_bg.wasm`, in Teile zerlegt.

Die Anpassungen stehen unter denselben Lizenzen wie SolidCraft (MIT oder Apache-2.0).
