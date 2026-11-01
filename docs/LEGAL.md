# Herkunft, Lizenzen und Grenzen der Prüfung

## Verifizierte Basis

Die offizielle [Web-Ausgabe v0.29.0](https://github.com/tangency-labs/solidcraft/releases/tag/v0.29.0)
ist auf Commit `3a5195b0a0aa359f6ebf10d890c1f887c70144b1` festgelegt.
Archive und WASM sind mit SHA-256 in `project.json` identifiziert.
Die zusammengefügten WASM-Teile, JavaScript-Bindings, mitgelieferten Fonts, Icons,
Ladegrafiken und Original-Lizenzhinweise wurden gegen dieses Archiv verglichen.
Die kopierten Quellhinweise in `legal/upstream/` stammen aus genau diesem Commit.

Der Rust-Quellcode der Basis ist [hier einsehbar](https://github.com/tangency-labs/solidcraft/tree/3a5195b0a0aa359f6ebf10d890c1f887c70144b1).
Die eigenen Ergänzungen liegen lesbar in diesem Repository vor. Eine verifizierte
Übernahme des offiziellen Binärpakets ist kein Nachweis eines reproduzierbaren Rust-Builds.

## Weitergabe

- Die Basis wird unter **MIT OR Apache-2.0** angeboten. Eine der beiden Lizenzen ist wählbar;
  beide vollständigen Originaltexte bleiben hier enthalten.
- `NOTICE` und `THIRD-PARTY-LICENSES.txt` werden unverändert weitergegeben.
- Fonts behalten ihre eigenen OFL-Texte in `fonts/`. Die umbenannten Craft-UI-Subsets
  werden unverändert übernommen; ihre ursprünglichen Reserved Font Names bleiben dokumentiert.
- Der ursprüngliche per-Datei-Nachweis steht in [ATTRIBUTION.md](../legal/upstream/ATTRIBUTION.md).
- `FORK-NOTICE.md` und Änderungsvermerke in modifizierten Originaldateien kennzeichnen
  die Anpassungen. Release-ZIPs enthalten diese Unterlagen auch offline.
- Neue Abhängigkeiten oder Assets brauchen vor Aufnahme eine eigene Lizenzprüfung;
  das vorhandene Drittanbieterverzeichnis darf nicht ungeprüft für neue Builds übernommen werden.

Maßgeblich sind die Originaltexte: [Apache-2.0, insbesondere Abschnitt 4 und 6](https://www.apache.org/licenses/LICENSE-2.0)
und [LICENSE-MIT](../LICENSE-MIT). Abschnitt 4 regelt bei Wahl von Apache-2.0 insbesondere
Lizenzkopien, Änderungsvermerke und die Beibehaltung einschlägiger Hinweise;
Abschnitt 6 gewährt keine allgemeine Markenlizenz.

## Namen und Außenauftritt

Der eigenständige Seiten-/App-Titel, die Infoseite und die Projektbeschreibung nennen
„inoffiziell“. Es wird keine Beauftragung, Partnerschaft, Zertifizierung oder Freigabe
von Tangency Labs oder Apple behauptet. Originalnamen und -grafiken dienen der
Herkunftskennzeichnung; die Softwarelizenz allein klärt mögliche Markenrechte nicht.
Vor einer kommerziellen Vermarktung oder weitergehenden Verwendung von Namen und
Logos müssen die Verantwortlichen mögliche Markenrechte gesondert klären.

Die [Original-Haftungshinweise](../legal/upstream/DISCLAIMER.md) werden erhalten.
Die Bedingungen in den Lizenztexten sind maßgeblich; ein pauschaler Ausschluss
zwingender gesetzlicher Haftung oder Gewährleistung wird hier nicht zugesichert.

## Was diese Prüfung nicht bescheinigt

Die technische Prüfung bestätigt Übereinstimmung und Mitlieferung bekannter Hinweise.
Sie ist keine umfassende Rechtsfreigabe, Markenrecherche oder Prüfung aller möglichen
Rechte Dritter. Der Status als Contributor ersetzt keine Nutzungsrechte oder
Vereinbarung mit den Rechteinhabern. Bei einer öffentlichen geschäftlichen Website
können zusätzlich Betreiber-, Datenschutz- und Verbraucherpflichten gelten, abhängig
von Betreiber, Nutzung und Rechtsordnung. Ohne diese Angaben lässt sich das nicht abschließend prüfen.

Diagnoseverhalten der eigenen Erweiterung: `IPAD-ANPASSUNG.md`. Externe Links sind
als solche erkennbar; die Infoseite lädt keine externen Grafiken oder Tracking-Skripte.
