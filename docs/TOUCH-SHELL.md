# AP 7 – iPad-Skizzenansicht

Vorbereitet für 0.4.0. Der unveränderte SolidCraft-Kern bleibt Version 0.29.0.
Diese Änderung behandelt AP 7 aus der bereitgestellten Anforderungsliste vom
2. November 2026. Restpunkte aus AP 2/6 und der eigene Rust-Build (AP 8) sind getrennt.

## Bedienung

In einer aktiven Skizze erscheint standardmäßig die iPad-Ansicht. Links steht jede
Werkzeugfamilie einmal: Linie, Bogen, Rechteck, Kreis, Ellipse, Polygon, Langloch,
Spline, Hilfslinie, Beschneiden und Versatz. Rechts bleiben Maße und Bedingungen.
Mit dem Pencil lässt sich weiterhin ohne Werkzeugwahl automatisch zeichnen.

Ein linker Werkzeugknopf startet die zuletzt gewählte Variante dieser Familie.
Die blaue Pille oben zeigt das aktive Werkzeug mit Variante. Antippen öffnet die
Variantenwahl; beispielsweise Rechteck → Mitte / 2 Punkte / 3 Punkte / Abgerundet.
Ohne aktives Werkzeug öffnet die Pille die gesamte Werkzeugauswahl. Ein Variantenwechsel
verwendet die native Werkzeugumschaltung: noch nicht abgeschlossene Vorschauen können
verworfen werden; bereits erzeugte Geometrie bleibt erhalten.

„Erweitert“ zeigt die ursprüngliche SolidCraft-Befehlsleiste und Skizzenpalette.
Die eigene linke Werkzeugleiste und rechte Bedingungen-Leiste verschwinden dabei.
„iPad-Ansicht“ schaltet zurück. Freie und gebundene Maßetiketten bleiben verwendbar.
Modus und Varianten werden lokal auf diesem Gerät gespeichert; sie ändern keine
Datei und erzeugen keine Undo-Schritte. Der beim Eintritt vorhandene Browser-Zustand
wird beim Austritt wiederhergestellt. Native Dialoge zeigen vorübergehend die
Originaloberfläche; danach kehrt die gewählte Ansicht zurück.

Finger können UI-Knöpfe bedienen und die Listen scrollen. Szenengeometrie und ihre
Symbole werden weiterhin ausschließlich mit dem Pencil ausgewählt. Scrollen über
einem Werkzeugknopf startet kein Werkzeug. Esc schließt zunächst eine offene
Variantenwahl; „Werkzeug beenden“ bedient die native Escape-Logik.

## Layout und technische Grenze

Alle eigenen neuen Bedienelemente haben mindestens 44 CSS-Pixel Höhe und Breite.
Die Listen scrollen, statt ihre Knöpfe unter diese Größe zu verkleinern. In schmaler
Split View erscheinen die linken Werkzeuge als Symbole mit zugänglichen Namen.
Maß-/Bedingungssymbole vermeiden die eigenen Leisten. Die Maße-/Bedingungen-Aktionen
werden nicht zusätzlich in der linken Leiste oder einer Kontextleiste angeboten.
Rückgängig/Wiederholen bleiben in der ursprünglichen Anwendungsleiste und per Geste.

Der übernommene CAD-Kern zeichnet Befehlsleiste und Skizzenpalette in ein einziges
Canvas. Er bietet keine öffentliche API zum echten Ein-/Ausklappen dieser Bereiche.
Deshalb überdeckt eine undurchsichtige, bedienbare Ebene im iPad-Modus die Original-
Befehlsleiste und -Palette. Die native Anwendung und die Zeichenkoordinaten werden
nicht verschoben oder skaliert. **Der reservierte Platz dieser Bereiche wird damit
nicht als zusätzliche Zeichenfläche zurückgewonnen.** Das echte Entfernen dieser
Canvas-Flächen und die Größe aller ursprünglichen Dialog-/Menüknöpfe benötigen AP 8.
Die Datei-/Entwurfsleiste oberhalb der Skizzenwerkzeuge bleibt original.

## Prüfung

Node-Tests prüfen gespeicherte Werte, erlaubte Varianten, sichere Standardwerte,
Moduswechsel ohne Geometriebefehl, Wiederherstellung des Browsers, Dialog-/Home-Wechsel,
veraltete Werkzeugtipps und gezielte Auswahl vor dem Löschen. Die vorhandenen Tests
für Bemaßung, Finger/Pencil und automatisches Zeichnen bleiben Bestandteil der CI.

Die lokale Testseite `tests/sketch-browser.html` erzeugt ausschließlich Testentwürfe
in einer eingebetteten Instanz. „Status prüfen“ zeigt Werkzeug, Modus, Auswahl und
Bedingungen aus dem echten CAD-Kern. Nicht für eigene Designs verwenden.

Noch auf echtem Gerät abzunehmen: Werkzeug mit Pencil starten, Rechteckvarianten
wechseln, links und in der Variantenwahl mit Finger scrollen, zweimal zwischen iPad
und Erweitert wechseln, Skizze beenden und erneut öffnen, danach App neu laden.
Geometrie und Bemaßungen müssen erhalten bleiben. iPad-Modell/iPadOS/Safari-Version
mit dem Ergebnis dokumentieren. Browser-Simulation ersetzt diese Abnahme nicht.

## Browser-Prüfstand dieser Änderung

Geprüft im Chromium-In-App-Browser mit dem echten SolidCraft-0.29.0-WASM:

- Alle 38 angebotenen Varianten im nativen Befehlskatalog vorhanden.
- Rechteck starten, auf „Mitte“ wechseln, Werkzeugname und Geometrie im Kern prüfen.
- Erweitert/iPad umschalten: aktives Werkzeug und bereits vorhandene Linie bleiben erhalten.
- Nach Neuladen bleiben Modus und gewählte Rechteckvariante gespeichert.
- 768 × 1024 und 512 × 768 CSS-Pixel: keine neuen Knöpfe unter 44 × 44 CSS-Pixel;
  linke Leiste bis zum Ende scrollbar, kein seitlicher Überlauf.
- Direkte Maßbearbeitung über dem neuen Layout: Ziffernfeld öffnen und 30 mm binden;
  der native Parameter d1 besitzt danach den Wert 30 mm. Das Ziffernfeld liegt vor den
  Leisten und ist bei geringer Höhe scrollbar.
- 29 Node-Tests und 6 Python-Pakettests erfolgreich. Unverändertes WASM und
  Herkunftsinventar erneut gegen das offizielle Release-Archiv geprüft.

Die Prüfbilder zeigen ausschließlich erzeugte Testdaten, keine eigenen Designs:

![iPad-Ansicht mit Variantenwahl](screenshots/ap7-touch.png)

![Erweiterte Originaloberfläche](screenshots/ap7-advanced.png)
