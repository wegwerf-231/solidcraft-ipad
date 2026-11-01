# SolidCraft iPad — inoffizielle Anpassung

Diese Web-Ausgabe ergänzt SolidCraft um Touch- und Pencil-Bedienung.
Sie ist kein offizielles Produkt von Tangency Labs oder Apple.
Eigenständige Version: `project.json`; Basis: SolidCraft 0.29.0.

- Apple Pencil: auswählen, skizzieren und ziehen.
- Finger: Ansicht drehen, mit zwei Fingern verschieben/zoomen.
- Zusatzleiste: kontextabhängige Werkzeuge und große Zahleneingabe.
- Offline-Modus: nach vollständig abgeschlossenem Erstdownload.

Die Browser müssen die nötigen Pointer- und WebAssembly-Funktionen bereitstellen.
Die Anpassung garantiert keine Unterstützung nativer Pencil-Doppeltipp-/Squeeze-Funktionen.
Die tatsächliche Bedienbarkeit und der Speicherbedarf hängen vom Gerät und Modell ab.

Eigene Ergänzungen: MIT OR Apache-2.0. Der unveränderte Kern und Materialien Dritter
behalten ihre Lizenzen. Änderungsliste: `FORK-NOTICE.md`; Herkunft: `docs/LEGAL.md`.
Der Code dieser Web-Anpassung ist unabhängig von der zuvor lokal entwickelten Rust-Tablet-Variante.

## Diagnosen

Standardmäßig werden keine Touch-Diagnosen an einen Server gesendet.
Nur auf einem lokalen Host und mit `?senddiagnostics=1` kann `touch-nav.js` an dessen
`__log`-Endpunkt senden. Die Daten enthalten Zeit, Browser/Geräteinformationen,
Viewport-/Bedienzustand und Fehlerprotokolle. Vor Aktivierung Inhalt und eigenen
Server prüfen. Der CAD-Kern kann unabhängig davon Netzwerkfunktionen besitzen;
diese Aussage beschreibt ausschließlich den Touch-Adapter.
