# Changelog

Dieses Changelog beschreibt die iPad-Ausgabe, nicht die Versionsfolge von SolidCraft.

## [Unreleased]

## [0.4.0] - vorbereitet, noch nicht veröffentlicht

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
