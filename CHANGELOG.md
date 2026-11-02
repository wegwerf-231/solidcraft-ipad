# Changelog

Dieses Changelog beschreibt die iPad-Ausgabe, nicht die Versionsfolge von SolidCraft.

## [Unreleased]

## [0.7.0] - 2026-11-02

Neue Basis: SolidCraft 0.30.0 (Commit `afd81380ab06b0e77e03fdf68185d4b484d0e84e`).
Laufzeitdateien bytegleich mit dem offiziellen Web-Archiv; Lizenzen, Drittanbieterhinweise,
Fonts und Icons unverändert, `legal/upstream/ATTRIBUTION.md` um neue Original-Grafiken ergänzt.

- **Dateiformat:** Mit 0.7.0 gespeicherte Entwürfe nutzen das Format 47 und lassen sich mit
  0.6.x und älteren Ausgaben nicht öffnen. Ältere Entwürfe öffnen weiterhin.
- Neu aus SolidCraft 0.30.0 unter anderem: große Entwürfe öffnen im Browser schrittweise mit
  Fortschrittsanzeige und Abbrechen, Ebene durch Achse und Punkt, Versatz mit mehreren Kopien,
  Konstruktionslinien mit Länge, Renderings vergleichen. Vollständige Liste in den
  [Original-Release-Notizen](https://github.com/tangency-labs/solidcraft/releases/tag/v0.30.0).
- Anpassung an die geänderte Steuerschnittstelle: `ui.inspect` liefert Dialog und Hover als
  Objekte. Ziffernfeld, Werkzeugleiste und Pencil-Kurvenerkennung lesen beide Formate.
- Ziffernfeld in Dialogen: Der Kern nennt das fokussierte Feld nicht mehr. Ziffernfeld bzw.
  Tastatur-Pille öffnen daher in allen Dialogen erst nach einem Tipp auf das Feld, wie bisher
  schon beim Extrudieren.

## [0.6.2] - 2026-11-02

- Numpad auf iPadOS: versteckten nativen Texteingang bis zur ausdrücklich angeforderten Systemtastatur schreibgeschützt halten.
- Viewport-Anpassung ohne Scroll-Abonnement, wiederholte Layout-Schreibzugriffe oder erneutes Vermessen unveränderter Größen.
- Zahlenfeld-Tipps bevorzugen vorhandene Trefferpositionen; weitere Abfragen erfolgen außerhalb des Touch-Ereignisses.
- Numpad-Öffnung gegen parallele Aufrufe, ausbleibende Leseantworten und verspätete Antworten nach Abbruch absichern; Zeitüberschreitung sichtbar melden.
- Isolierter Finger-/Pencil-Test und vereinfachter Geräteprüfstand ergänzt. Der gemeldete iPad-Freeze war im Desktop nicht reproduziert; der Nutzer bestätigt im korrigierten Geräteprüfstand, dass das Numpad auf seinem iPad öffnet und reagiert.

## [0.6.1] - 2026-11-02

- Extrudieren: Ziffernfeld erst nach einem bewussten Tipp auf das native Zahlenfeld öffnen; Autofokus und Ziehen des Extrusionsgriffs öffnen es nicht mehr.
- Gemeinsames Ziffernfeld am oberen Griff mit Finger, Pencil oder Maus verschieben; Position während der Sitzung behalten und nach Größenwechsel im sichtbaren Bereich halten.
- Anfangsposition des Ziffernfelds neben dem Extrusionsdialog suchen, statt ihn zu verdecken.
- Extrusionszüge vor dem nächsten nativen Frame zustellen, statt einen zusätzlichen Animationsframe zu warten; letzten Punkt beim Loslassen erhalten.
- Während nativer Mauszüge Hintergrundabfragen pausieren und bei Dialog-/Modellzügen keine Skizzeninformationen vorladen.
- Dunkle Seiten-/Startfarben und deckende iPad-Statusleisten-Vorgabe; Anzeige von Canvas-Auflösung, Pixelverhältnis und Seitenzoom in der optionalen Diagnose.
- Bekannte Grenze: dauerhafte Unschärfe am physischen iPad noch nicht reproduziert; Diagnose und Abnahme in `docs/NUMPAD-DISPLAY.md` dokumentiert.

## [0.6.0] - 2026-11-02

Automatisierte Prüfungen und Desktop-Browserprüfung bestanden; Abnahme des vollständigen
Release-Stands auf einem physischen iPad noch ausstehend.

Rückmeldung aus dem Gerätetest von 0.5.0 („die Schaltfläche ist immer noch riesig“):

- Das dunkle Kopfband entfällt. In der iPad-Skizzenansicht wird die Zeichenfläche um die Höhe
  von Kopfzeile und Original-Befehlsleiste nach oben verschoben (neue Datei `canvas-shift.js`);
  diese Bereiche liegen außerhalb des Bildschirms, das Modell nutzt die ganze Höhe.
- Oben bleiben nur kleine Knöpfe: Rückgängig, Werkzeug-Pille, Wiederholen und „Erweitert“.
  Rückgängig und Wiederholen sind nötig, weil die Original-Kopfzeile verdeckt ist.
- Alle Bildschirmkoordinaten der Browser-Schnittstelle werden umgerechnet, sodass Pencil,
  Ziffernfeld, Maßetiketten und Auswahl unverändert treffen.
- „Erweitert“, Verlassen der Skizze und `?fullsketch=off` zeigen die unveränderte Oberfläche.
- Weniger Maße an der Geometrie: freie Maße erscheinen nur noch an gewählter oder gerade
  gezeichneter Geometrie, gegenüberliegende gleich lange Seiten nur einmal, Maßlinien außerhalb
  der Form. Bisher erhielt jede Kante dauerhaft ein Etikett mit Maßlinie.
- Keine doppelten Bedingungssymbole mehr: SolidCraft zeichnet die Symbole selbst; die eigenen,
  größeren Symbole erscheinen nur noch an der Auswahl.
- Ziffernfeld kleiner und rechts über der Bedingungen-Leiste statt mitten über der Zeichnung.
- Die halb verdeckte Zustandszeile („… degrees of freedom“) liegt in der iPad-Ansicht außerhalb des
  Bildschirms (Versatz 40 Pixel größer, da sich die Zeile nicht abschalten lässt).
- Neuer Knopf „Extrudieren“ direkt unter „Skizze beenden“: Profil mit dem Pencil antippen,
  „Extrudieren“, Wert im Ziffernfeld eingeben, ✓. SolidCraft beendet die Skizze dabei selbst.

- Gemeinsame, überlappungsfreie Aktualisierung für Werkzeugstatus, Auswahl, Leisten und Zeichenfelder; Hintergrundabfragen während Finger-/Pencil-Gesten und in ausgeblendeten Tabs pausieren.
- Pencil-Tinte höchstens einmal pro Bildschirmbild aktualisieren, vorhandene Koordinatentexte wiederverwenden und den letzten Punkt beim Abheben sofort darstellen.
- Maßetiketten gesammelt einfügen/vermessen/platzieren; Projektion gemeinsam mit Pencil-Treffflächen in begrenzten Paketen abfragen.
- Veraltete Pencil-Treffflächen nach Kamera-/Dokumentwechsel verwerfen; Scrollen in der Bedingungen-Leiste löst keine Aktion aus.
- Gleichzeitige Skizzenabfragen warten auf aktuelle Auswahl; geänderte Dokumenteinheiten werden auch in einer geöffneten Skizze berücksichtigt.
- Messverfahren und Geräteprüfliste: `docs/IPAD-PERFORMANCE.md`.


- Zusammenführung mit den Performance-Verbesserungen aus PR #9; Koordinaten-Tests für Pixelverhältnis 1/2/3, Erweitert, Opt-out und Größenwechsel ergänzt.
- Vollflächenversatz nach Größenwechsel neu messen und Treffzonen nach dem Canvas-Umbau aktualisieren.

## [0.5.0] - vorbereitet, Geräteabnahme ausstehend

Rückmeldung aus dem ersten Gerätetest auf dem iPad:

- Kompaktere Oberfläche: Werkzeugleiste links, Bedingungen-Leiste rechts, Werkzeug-Pille und
  „Erweitert“ als kleine Knöpfe (32 statt 44 Pixel, Schrift 13 px). Die Leisten beginnen im
  abgedeckten Bereich der Original-Befehlsleiste; die rechte Leiste deckt die Original-Palette
  vollständig ab und ordnet die Bedingungen in zwei Spalten.
- Maß- und Bedingungsetiketten an der Geometrie deutlich kleiner (24 bzw. 22 px).
- Varianten-Auswahl direkt am Werkzeug: Ein Tipp auf ein Werkzeug mit Varianten (z. B. Rechteck)
  startet es und klappt daneben die Varianten auf (2 Punkte, Mitte, 3 Punkte, Abgerundet);
  ein kleines Dreieck kennzeichnet solche Werkzeuge.
- Behoben: ✓ nach dem ersten Wert eines Rechtecks (Breite) setzte sofort ein flaches Rechteck
  („the corners must differ“). ✓ wechselt jetzt zum nächsten Feld; das Ziffernfeld nennt das
  Feld (Breite 1/2, Höhe 2/2).
- Behoben: Ein Maß an einer bereits bestimmten Kante (z. B. obere Rechteckseite) erzeugte
  „over-constrain“. Jetzt wird das bestimmende Maß derselben Art auf den Wert gesetzt.
- Zwei Linien gewählt: Ein Etikett „∠ … festlegen“ bzw. „↔ … festlegen“ erscheint direkt
  zwischen den Linien und öffnet das Ziffernfeld für Winkel bzw. Abstand.

## [0.4.0] - vorbereitet, noch nicht veröffentlicht

- AP 2: Eingabeentwürfe für native Zeichen-/Dialogfelder, Validierung über den CAD-Kern, Fehleranzeige und Feldwechsel mit ⇥ ohne vorzeitiges Platzieren.
- Variablen-Knopf x+: vorhandene Parameter einfügen oder einen Wert bis zur Bestätigung als benannten Parameter vormerken.
- AP 6: Wackeln schaltet Linie/Bogen um; Spline-Striche übernehmen Druckpunkte (alternativ Verweilen), Abheben beendet den Strich.
- Langes Halten auf einem Spline durch Punkte fügt einen Punkt ein. Kontrollpunkt-Splines unterstützt der ursprüngliche Kern hierfür noch nicht.
- Spline-Werkzeug vor der Übergabe gezielt beenden; zwischen Escape-Ereignissen Frames abwarten, damit die aktive Skizze erhalten bleibt.

- AP 7: iPad-Skizzenansicht mit gruppierter Werkzeugleiste links und Werkzeug-Pille mit Varianten oben.
- Erweitert zeigt die originale Befehlsleiste; die iPad-Werkzeug- und Bedingungen-Leisten werden dabei ausgeblendet. Modus und Variantenwahl werden gespeichert.
- Im iPad-Modus keine zusätzliche Kontextleiste, keine doppelte Konstruktion/Bemaßung/Löschaktion für Bedingungen und keine zweite Rückgängig-Leiste.
- Eigene Bedienelemente mindestens 44 CSS-Pixel; Werkzeuge und Varianten bleiben in Hochformat und Split View scrollbar erreichbar.
- Native Canvas-Leisten werden überdeckt; ihr Platz wird ohne Änderung des Originalkerns nicht zurückgewonnen. Zeichenkoordinaten bleiben unverändert.
- Browser-Zustand beim Wechsel in die erweiterte Ansicht oder beim Verlassen der Skizze wiederherstellen; Tests für Moduswechsel und Varianten ergänzt.

## [0.3.0] - vorbereitet, Geräteabnahme ausstehend

- AP 3: direkte Maßetiketten mit frei/fest, Längen-/Durchmessermaß und Abstand-/Winkel-Auswahl für zwei Linien.
- Werte bleiben bis zur Bestätigung ein Entwurf; Fehler bleiben sichtbar, außerhalb tippen verwirft ohne CAD-Änderung.
- Bestehende Maßparameter bearbeiten und Maßbindung gezielt lösen; Sichtbarkeit aller Maße umschalten.
- AP 4: rechte, einklappbare Bedingungen-Leiste mit deutschen Knöpfen, passender Auswahl und vergrößerten Symbolen.
- Bedingungen auswählen/löschen, Zusammenfallend-Verbindung trennen, Elemente sperren/lösen und in Konstruktion umwandeln.
- Additive Pencil-Linienauswahl; Finger bleiben von der Geometrieauswahl getrennt.
- Node-Regressionstests, isolierte Browser-Testentwürfe und dokumentierte Geräteabnahme.
- Gemeinsame Prüfung der Beiträge: Pencil-Zugvorschau korrigiert; automatische Striche und Skizzenende gegen Dokumentwechsel abgesichert; Linienketten bei Dokumentwechsel zurückgesetzt.

- Skizze automatisch (AP 5): Ein Pencil-Strich ohne aktives Werkzeug startet eine Skizze auf der
  berührten ebenen Fläche, sonst auf der Grundebene. Ein Pencil-Tipp ins Leere beendet die Skizze,
  wenn nichts ausgewählt ist.
- Linie/Bogen automatisch (AP 6): Ein gerader Strich wird zur Linie, ein gebogener zum Bogen durch
  drei Punkte. Endpunkte rasten an vorhandenen Punkten ein; fast waagrechte oder senkrechte Linien
  werden ausgerichtet und bedingt; ein Bogen, der eine Linie fortsetzt, schließt tangential an.
  Der Strich ist als Tinte sichtbar, bis er umgewandelt ist.
- Ein Strich, der auf vorhandener Skizzengeometrie beginnt, zieht diese wie bisher.
- Pencil gedrückt halten: danach ziehen ergibt eine Bereichsauswahl, ohne Ziehen abheben öffnet
  das Kontextmenü (wie in Shapr3D).
- Neue Datei `pencil-sketch.js`; `touch-nav.js` bietet dafür eine kleine Erweiterungsschnittstelle.

## [0.2.0] - vorbereitet, noch nicht veröffentlicht

- Zeichnen per Pencil-Zug wie in Shapr3D: Aufsetzen setzt den ersten Punkt, Abheben den zweiten
  (Linie, Rechteck, Kreis, Bogen, Polygon, Langloch, Ellipse, Hilfslinie). Linien lassen sich
  mit weiteren Zügen am Endpunkt als Kette fortsetzen. Tippen bleibt möglich.
- Pencil-Hover: Ein über dem Display schwebender Stift bewegt den Zeiger, sodass Hervorhebung
  und Fangpunkte schon vor dem Aufsetzen erscheinen.
- Wertfelder beim Zeichnen (Länge, Winkel, Breite, Höhe, Durchmesser) öffnen das Ziffernfeld
  statt der Bildschirmtastatur; das Ziffernfeld erscheint neben dem bearbeiteten Feld.
- Ziffernfeld: neue Tasten ⇥ (nächstes Wertfeld) und m.
- Arbeitspakete AP 1 und AP 2 aus der Anforderungsliste zur Shapr3D-Bedienung.

## [0.1.0] - vorbereitet, noch nicht veröffentlicht

- Bestehende Finger-/Pencil-Steuerung, Kontextleiste und Ziffernfeld als erste eigene Ausgabe erfasst.
- Eigenständige SemVer-Version, getrennt von SolidCraft 0.29.0 und Offline-Build-Kennung.
- Herkunft des unveränderten CAD-Kerns gegen das offizielle Release verifiziert.
- Eigene Projektbeschreibung, sichtbarer Inoffiziell-Hinweis und erreichbare Lizenzinformationen.
- Deterministische ZIP-Pakete mit Prüfsummen, Herkunft und vollständigen Lizenzhinweisen.
- CI-Prüfung für Versionen, Offline-Dateiliste, Originaldateien und Release-Pakete.
- Tag-basierter Release-Workflow erstellt einen Entwurf; Veröffentlichung erfolgt nach Geräteprüfung.
- Diagnose-Uploads an lokale Server nur nach explizitem URL-Opt-in.
