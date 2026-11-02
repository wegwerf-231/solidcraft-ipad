# AP 3 und AP 4: Skizzenmaße und Bedingungen

Stand: iPad-Ausgabe 0.3.0, vorbereitet. Grundlage ist die vom Projekt bereitgestellte
Arbeitspaketliste vom 2. November 2026. Implementierung und Browserprüfung sind erfolgt;
die Abnahme mit echtem iPad und Apple Pencil steht aus.

## Bedienung

In einer aktiven Skizze eine Linie mit dem Pencil auswählen und das Etikett
„↔ … · frei“ antippen. Das eigene Ziffernfeld zeigt den aktuellen Wert;
die erste Zahl ersetzt ihn. ✓ erzeugt eine Maßbindung. Bestehende „🔒 … · fest“
Etiketten bearbeiten denselben Parameter. „Maßbindung lösen“ entfernt nur die
Bemaßungsbedingung, nicht die Linie. Freie Kreis-/Bogenetiketten bieten den Durchmesser.
„Frei“ beschreibt eine fehlende Maßbindung, nicht die Zahl der geometrischen Freiheitsgrade.

Weitere Pencil-Tipps auf Linien ergänzen die Auswahl. Zwei parallele Linien bieten
Abstand, zwei nicht parallele Linien Winkel an. Die andere Variante bleibt mit
Begründung deaktiviert: Der unveränderte Kern interpretiert den Abstand nicht paralleler
Linien als Winkel. Ein Tipp ins Leere verwendet weiterhin die native Abwahl.

Die Eingabe bleibt bis ✓/Enter ein Entwurf. Esc oder ein Tipp außerhalb verwirft sie.
Ungültige Ausdrücke bleiben mit Fehlermeldung bearbeitbar. Ein Dokumentwechsel oder eine
inzwischen veränderte Skizze verhindert die Übernahme auf veraltete Geometrie.
Einheitenausdrücke und Variablen wertet ausschließlich der bestehende CAD-Kern aus.

Rechts „Bedingungen“ öffnen. Nur zur vollständigen Auswahl passende Beziehungen sind
aktiv. Beispielsweise zwei Linien wählen → Parallel. Große Symbole an der Geometrie
wählen eine einzelne Bedingung; „Bedingung löschen“ entfernt sie. Für eine ausgewählte
Zusammenfallend-Bedingung bietet „Trennen“ denselben gezielten Löschvorgang.
„Sperren / Lösen“ fixiert ausgewählte Geometrie oder löst ihre Fixierung;
„Konstruktion“ schaltet den Konstruktionsstatus um.

„Alle Maße anzeigen“ und „Symbole: immer/Auswahl“ verwenden die Optionen der Skizze.
Freie Maße zuletzt gezeichneter/ausgewählter Linien und Kreise bleiben erreichbar;
bei „Alle Maße“ werden zusätzlich freie Maße der übrigen Geometrie angeboten.
Die Leiste speichert ihren geöffneten Zustand und lässt sich mit dem Finger scrollen.
Finger bedienen UI-Knöpfe und navigieren, wählen aber keine Geometrie oder Szenensymbole.

## Abdeckung und Grenzen

- AP 3 / B-01: native Maßvorschau beim Zeichnen bleibt erhalten. Die Behandlung sämtlicher
  Vorschau-Eingabefelder, Variablenknopf und Platzierung des Ziffernfelds am Etikett gehören zu AP 2.
- B-02/B-03: zusätzliche Maßlinien mit Pfeilen und frei/fest-Etiketten über die öffentliche API;
  das vollständige native Etikettenlayout und Bestimmtheitsfarben bleiben AP 8.
- B-04: außerhalb einer Skizze zeigt eine einzelne ausgewählte Körperkante ein freies,
  schreibgeschütztes Längenmaß. Native gebundene Maßdarstellung wird nicht verändert.
- B-05/B-06/B-17/B-18: Auswahlmaße, Sichtbarkeit, Bindung/Lösen und Abbruch implementiert.
- AP 4 / C-03/C-04/C-06–C-08: deutsche Leiste, kompatible Aktionen, Symbolauswahl und
  gezieltes Entfernen, Sichtbarkeit und Fixierung implementiert. „Trennen“ verlangt die
  explizite Auswahl einer Zusammenfallend-Bedingung; es löscht nicht pauschal Verbindungen.
- Desktop-Befehlsleiste bleibt sichtbar. Das umschaltbare Layout ohne doppelte Befehle ist AP 7.
- Symbol-/Maßprojektion ist begrenzt auf 200 Einträge je Kategorie, additive Linienprojektion
  auf 256 Linien. Sehr dichte Skizzen können Etiketten überlagern; native Bedienung bleibt verfügbar.
- Keine neue iPadOS-/Pencil-Pro-Anbindung, kein eigener Rust-/WASM-Build, keine proprietären
  Quelltexte oder Gestaltungselemente übernommen. Originalversion und Lizenzen unverändert.

## Prüfung und Geräteabnahme

Automatisch: `node --test tests/*.test.cjs` prüft Auswahlkompatibilität, Parameterübergabe,
Einheiten, ungültige Eingaben, Abbruch ohne Schreibzugriff, Dokumentwechsel,
Löschumfang, Sichtbarkeit und konkurrierende Bestätigung. Python-Tests prüfen Paket,
Herkunft und Offline-Inventar. Syntaxchecks in CI und Release-Workflow.

Im lokalen Browser mit dem echten SolidCraft-0.29.0-WASM geprüft: Linie 25 mm binden,
gebundenes Etikett öffnen, 1/0 abweisen, außerhalb abbrechen (25 mm bleibt),
Winkel 45 deg (Kernwert π/4), zwei Linien per simuliertem Pencil auswählen,
Parallel setzen, Symbol auswählen und gezielt löschen. Keine Adapter-Diagnosefehler.

Reproduzierbare, isolierte Testdaten: nach lokalem HTTP-Start
`/tests/sketch-browser.html` öffnen. Die Knöpfe ersetzen ausschließlich den Entwurf
in der eingebetteten Testinstanz. Nicht für eigene Designs verwenden.

Auf echtem Gerät noch abzunehmen (Modell/iPadOS/Safari-Version dokumentieren):

1. Linie nur mit Pencil wählen, Etikett öffnen, 30 mm über Ziffernfeld bestätigen.
2. Zwei schräge Linien wählen, Winkel 45 deg setzen; zwei parallele Linien mit Abstand bemaßen.
3. Festes Maß öffnen, ändern, außerhalb abbrechen; Maßbindung lösen.
4. Zwei Linien wählen, Parallel setzen; Symbol wählen und Bedingung löschen.
5. Zusammenfallend-Symbol wählen und Trennen; Sperren/Lösen einer Linie prüfen.
6. Sichtbarkeit umschalten; mit Finger auf Geometrie/Symbol tippen: keine Auswahl.
7. Hochformat und Split View: Leiste öffnen, mit Finger bis zum Löschen-Knopf scrollen;
   Ziffernfeld vollständig bedienen. Home-Bildschirm/offline nach vollständigem Update prüfen.

Diese Geräteabnahme ist keine bereits bestandene Prüfung. AP 1/2 stammen aus PR #2,
AP 5/6 aus dem separaten PR #3 des zweiten Contributors. Dieser Branch baut auf dessen
Commit 59ec705 auf; die gemeinsame Version 0.3.0 enthält beide Beiträge. AP 7/8 bleiben offen.
Nach der Zusammenführung zusätzlich im echten WASM geprüft: automatische Skizze mit
Linie, automatische Bogenkonvertierung, Finger-Tipps ohne Auswahl und additive Pencil-Auswahl.
20 Node-Tests einschließlich Dokumentwechsel beim automatischen Zeichnen und 6 Python-Tests
bestanden. Hochformat 768 × 1024 CSS-Pixel geprüft; neue Leistenknöpfe und Szenensymbole
haben mindestens 44 CSS-Pixel Bedienhöhe. Das ersetzt keine vollständige Geräteabnahme
von AP 1/2 oder AP 5/6.
