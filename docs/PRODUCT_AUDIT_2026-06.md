# Spendlog — Produkt-Status & Strategie-Audit

> Erstellt 2026-06-05 via Multi-Agent-Audit (7 Tiefen-Analysen + 2 adversariale Critiques + Synthese).
> Befunde gegen den realen Code (Commit-Stand v1.0.5) und Web-Recherche verifiziert.

## TL;DR

- **Konzept (Frage 1): schwach.** Der ehrliche Job-to-be-done („Ausgaben erfassen + Geldfragen beantworten, ohne Claude zu verlassen") ist real, aber eng. Manuelle Diktat-Erfassung ist *langsamer* als ein 10-Sekunden-App-Eintrag, und echte Finanzdaten kommen als Kontoauszug + Belege — die ein Chat-Interface nicht erfasst.
- **Architektur (Frage 2): solide gebaut, aber falsch dimensioniert.** Saubere Schichtung, 380 schnelle Tests — aber TypeORM + `synchronize:true` ohne Migrationen ist ein Datenverlust-Risiko bei jedem npm-Update, und Geld wird als Decimal-als-String/Float gehandhabt (65 `Number()`-Casts allein in 3 Dateien).
- **Security (Frage 6): adäquat lokal, aber unterbewertet.** CSV-Formel-Injection im Steuerberater-Export ist *live* und in einer Stunde fixbar. Plaintext-Token + überschreibbare API-URL werden kritisch, sobald Cloud-Sync bezahlt wird.
- **Freemium/Sync-Modell (Frage 4): strukturell nicht durchsetzbar.** Der Wedge existiert nicht. Die MIT-CLI liefert bereits DATEV/EXTF-Export; die einzig zahlbaren Features (Konnektoren, OCR) sind ungebaut; alles Gebaute ist self-hostbar. Null Entitlement-/Billing-Code.
- **Markt (Frage 1/7): besetzt von beiden Seiten.** Norman Finance (deutsch, AI-first, MCP live) verschenkt Rechnung + Bank-Sync + E-Rechnung gratis und nimmt 9-21€/Monat nur für die Finanzamt-Abgabe — die Schicht, die Spendlog rechtlich nicht betreten kann.
- **Monetarisierung (Frage 7): heute unmöglich, mittelfristig fraglich.** ~1.069 npm-Downloads in 17 Monaten, kein Launch, ~0 GSC-Impressionen, keine Zahlungsinfrastruktur.
- **Verständlichkeit/UX (Frage 8): adäquat für Techniker, kaputt für Zielpersona.**
- **Blindspot (Frage 9): Recht.** Rechnungsfunktion GoBD-nicht-konform by design; Cloud-Sync macht den Betreiber zum GDPR-Auftragsverarbeiter ohne AVV. Das ist Haftung, kein fehlendes Feature.
- **Distribution (Frage 3): nicht das Problem.**

**Gesamturteil:** Gut gebautes Werkzeug für eine Frage, die fast niemand zu zahlen bereit ist — mit einem besser finanzierten deutschen Wettbewerber, der sie bereits gratis beantwortet. CLI als Portfolio-/Credibility-Asset behalten, Dashboard einfrieren/einstellen, vor weiterer Investition einen ehrlichen No-Go-Test fahren.

## 1. Konzept & PMF

Echter Nutzen: reibungsarme Erfassung im Gesprächsfluss + natürlichsprachige Auswertung. Bruchstellen:
- **Erfassungs-Paradox:** Standalone (kein Bank-Sync) ist Differenzierung *und* Schwäche. Jeder Datenpunkt von Hand diktiert; Chat ist langsamer als ein Tippfeld. Retention-Killer.
- **Positionierung nicht lieferbar:** „Für deutsche Freelancer" ohne USt-Modell. `Invoice` speichert nur `totalAmount` ohne Netto/Brutto/Steuer-Split (`src/entities/Invoice.ts:43-47`); `get_tax_summary` rechnet EÜR ohne Vor-/Umsatzsteuer (`src/tools/summary.ts:488-527`).

## 2. Architektur & Technik

Gut: konsistente Schichtung, zentrales Error-Handling, 380 Integrationstests, lokale Hygiene (0700/0600, WAL, FK).
Riskant:
- **Geld als Decimal-als-String/Float** — 65 `Number()`-Casts (transactions.ts 7, summary.ts 23, export.ts 35). Ein vergessener Cast → `NaN`/Konkatenation im DATEV-File. **Fix: Integer-Cents end-to-end.**
- **`synchronize:true` in Produktion** (`data-source.ts:32`) ohne Migrationen → Datenverlust-Risiko bei jedem npm-Update. `db:reset`-Pfad falsch.
- **Grüne Tests täuschen:** `tests/setup.ts createTestInvoice` schreibt Felder, die die Entity nicht hat (TypeORM ignoriert still) → Invoice-Persistenz überschätzt.

## 3. Security (nach Schweregrad)

**Hoch:** CSV/DATEV-Formel-Injection — `escapeCSV` (`export.ts:185`) neutralisiert führende `= + - @` nicht; `cli.ts:972` ebenso. Trifft den menschlichen Empfänger (Steuerberater).
**Mittel (ab bezahltem Sync):** Token im Klartext in `connection.json`; `SPENDLOG_API_URL` überschreibbar ohne Pinning; Dashboard-API mit Supabase-Service-Key + manuellem user_id-Filter (RLS umgangen); `/auth/link/status` unauthentifiziert; 7 npm-Advisories.
**Niedrig:** DB/Exports nicht ge-chmod't, DB unverschlüsselt; Sync-Ack per Substring-Matching (`sync.ts:204`); PDF-Rechnung beworben aber nicht implementiert.

## 4. Freemium/Sync-Modell

Der Wedge existiert nicht:
1. **Nicht gated** — null Entitlement-Checks, kein Stripe/Paddle; PRO-Features (5€/Monat) sind alle schon gratis in der CLI.
2. **Selbst-Kannibalisierung** — `export_for_tax_advisor` erzeugt lokal DATEV-Files (`export.ts:803`); „Sharing" hostet nur eine gratis erzeugbare Datei.
3. **Self-hostbar** — Protokoll/Schema MIT offen; `SPENDLOG_API_URL` umbiegen.

Zusätzlich unvollständig: `processQueue` synct nur `entityType='transaction'` (`sync.ts:112-119`); Multi-Device existiert nicht; Dashboard- ≠ CLI-Zahlen.
**Moat-Problem:** Defensierbarkeit kommt von Integrationen (lexoffice/sevDesk-OAuth, OCR) — genau die sind ungebaut (XL). Gating ist rückwärts.

## 5. Markt & Konkurrenz

Kategorie real (74+ Finanz-MCP-Server), aber von beiden Enden besetzt: Hobby-Klone (null Moat) und **Norman Finance** (deutsch, AI-first, bank-connected, Buchhaltung+Rechnung gratis, Steuer-Abgabe 9-21€/Monat). Keine organische End-User-Nachfrage (~0 GSC-Impressionen). Spendlog kann die einzig zahlbare Schicht (Finanzamt-Abgabe) rechtlich nicht betreten.

## 6. Monetarisierung

Heute gar nicht (keine Billing, kein Gate, kein Funnel). Funnel = Vier-Wege-Schnittmenge → ~null.
- **Option A (aktuelles Dashboard):** ablehnen — schwächere Teilmenge von Normans Gratis-Tier.
- **Option B (B2B via Steuerberater):** stärkstes Pivot — Multi-Mandanten-Dashboard an Kanzleien, viele Seats, eingebauter Vertriebskanal. Vor Code: 2-3 Discovery-Calls.
- **Option C:** CLI als Credibility-Asset, Dashboard einstellen.

**Empfehlung:** Erst Go/No-Go-Test, nicht Pricing-Experiment. Wahrscheinlich No-Go. Falls positiv: Option B vor A, 9-15€/Monat.

## 7. Distribution

Ausreichend; anders publizieren ist nicht das Problem. Registry erreicht Devs, nicht die ICP. Launch-Post = Mess-Instrument, kein Hebel. stdio-only schließt Remote/Hosted-Clients aus (Ökosystem-Drift).

## 8. UX

Stärke: Ein-Befehl-Install mit Auto-Detection. Reibung: Connect-Strings bewerben gratis-Features; `create_invoice` scheitert ohne Profil; Desktop-Neustart stiller Hard-Stop; bilinguale Inkonsistenz; 43 Tools nicht entdeckbar.

## 9. Blindspots & Risiken

- **GoBD (P0-Haftung):** Rechnungen frei mutierbar (keine Unveränderbarkeit), Löschen erzeugt Nummern-Lücken. Betriebsprüfung lehnt Artefakte ab.
- **GDPR (P0 ab Sync):** Betreiber = Auftragsverarbeiter; nur Soft-Delete (Art. 17 unerfüllt); kein AVV; kein Daten-Export (Art. 20).
- **MIT vs. Bezahlprodukt:** „AS IS" waiver keine impliziten EU-Pflichten.
- **Anthropic-Plattformrisiko:** Produkt ist Mieter auf Claude.
- **Solo-Dev-Last:** Support für ein steuerberührendes Produkt = Haftung.
- **Retention unmessbar:** keine Telemetrie.
- **Sunk-Cost-Falle:** alles vor Validierung gebaut.

## Empfohlener Fahrplan

**P0 — Go/No-Go zuerst (1-2 Tage)**
1. Waitlist + Launch-Post (r/ClaudeAI, r/selbststaendig, Show HN) als Go/No-Go.
2. 10-15 Discovery-Interviews + 2-3 Steuerberater-Calls.

**P0 — Positionierung (S)**
3. Headline weg von „für deutsche Freelancer/Steuer"; Connect-Strings für gratis-Features entfernen.

**P0 — Falls als Tracker behalten (S-M)**
4. CSV-Formel-Injection fixen (`export.ts:185`, `cli.ts:972`) + Test.
5. Geld auf Integer-Cents end-to-end.

**P1 — Nur falls Test positiv (M-L)**
6. Freemium-Grenze neu ziehen: nur serverseitige, nicht-fälschbare Features gaten (lexoffice-Konnektor zuerst) + 402-Upgrade.
7. GoBD + GDPR vor Bezahl-Launch.

**P1 — Migrationen + Backup (M)**
8. `synchronize:true` durch versionierte Migrationen + Backup-vor-Migrate ersetzen.

## Schlussurteil

Als Geschäft: mit hoher Wahrscheinlichkeit nein — nächster Schritt ist ein ehrlicher Go/No-Go-Test, dessen wahrscheinliches Ergebnis das Einstellen des Dashboards ist. Als Asset: ja — die polierte MIT-CLI ist ein Credibility-/Portfolio-Träger und möglicher B2B2C-Integrations-Baustein.
