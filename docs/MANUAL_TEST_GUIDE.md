# Spendlog Manual Test Guide

Complete walkthrough to test all features as a new user.

**Vorbereitung:**
```bash
# Optional: Alte Testdaten löschen für clean slate
rm -rf ~/.spendlog
rm -rf ~/Projects/spendlog/data/spendlog.db
rm -rf ~/Projects/spendlog/data/exports/*
rm -rf ~/Projects/spendlog/data/invoices/*
```

---

## Phase 1: Erste Schritte (Profil)

### 1.1 Status ohne Profil prüfen
```
"Zeig mein Profil"
```
**Erwartung:** Meldung "Noch kein Profil angelegt"

### 1.2 Profil anlegen
```
"Mein Firmenname ist Test GmbH, Adresse ist Musterstraße 1, 12345 Berlin"
```
**Erwartung:** Profil wird erstellt mit company_name und address

### 1.3 Profil erweitern
```
"Füge meine Steuernummer DE123456789 hinzu und ich bin Kleinunternehmer"
```
**Erwartung:** tax_id und is_kleinunternehmer werden gesetzt, §19 UStG Hinweis erscheint

### 1.4 Profil prüfen
```
"Zeig mein Profil"
```
**Erwartung:** Alle Daten korrekt angezeigt

---

## Phase 2: Kategorien

### 2.1 Standard-Kategorien prüfen
```
"Zeig alle Kategorien"
```
**Erwartung:** Default-Kategorien für Einnahmen (Dienstleistung, Produktverkauf, etc.) und Ausgaben (IT & Software, Marketing, etc.)

### 2.2 Eigene Kategorie erstellen
```
"Erstelle eine Einnahme-Kategorie 'Beratung'"
```
**Erwartung:** Neue Kategorie wird erstellt, nicht als Standard markiert

### 2.3 Kategorie löschen (sollte funktionieren)
```
"Lösche die Kategorie Beratung"
```
**Erwartung:** Erfolg (keine Transaktionen verwenden sie)

### 2.4 Standard-Kategorie löschen (sollte fehlschlagen)
```
"Lösche die Kategorie Dienstleistung"
```
**Erwartung:** Fehler - Standard-Kategorien können nicht gelöscht werden

---

## Phase 3: Transaktionen

### 3.1 Erste Einnahme
```
"Ich habe 2500€ für Webentwicklung bekommen"
```
**Erwartung:** Einnahme wird erstellt, Kategorie automatisch oder nachgefragt

### 3.2 Einnahme mit Kategorie
```
"1500€ Einnahme für Consulting, Kategorie Dienstleistung"
```
**Erwartung:** Einnahme mit korrekter Kategorie

### 3.3 Erste Ausgabe
```
"50€ für Notion ausgegeben"
```
**Erwartung:** Ausgabe erstellt

### 3.4 Ausgabe mit Kategorie und Datum
```
"Gestern 29,99€ für Hetzner Hosting ausgegeben, IT & Software"
```
**Erwartung:** Ausgabe mit gestrigem Datum und korrekter Kategorie

### 3.5 Transaktionen auflisten
```
"Zeig alle Transaktionen"
```
**Erwartung:** Alle 4 Transaktionen, sortiert nach Datum

### 3.6 Filtern nach Typ
```
"Zeig nur Einnahmen"
```
**Erwartung:** Nur die 2 Einnahmen

### 3.7 Transaktion bearbeiten
```
"Ändere die Notion-Ausgabe auf 45€"
```
**Erwartung:** Betrag wird aktualisiert

### 3.8 Transaktion löschen
```
"Lösche die Hetzner-Ausgabe"
```
**Erwartung:** Transaktion wird entfernt

---

## Phase 4: Budgets

### 4.1 Globales Budget setzen
```
"Setze ein monatliches Budget von 500€"
```
**Erwartung:** Budget wird erstellt

### 4.2 Kategorie-Budget setzen
```
"Setze ein Budget von 100€ für IT & Software"
```
**Erwartung:** Kategorie-spezifisches Budget

### 4.3 Budget-Status prüfen
```
"Wie ist mein Budget-Status?"
```
**Erwartung:** Beide Budgets mit Verbrauch angezeigt

### 4.4 Budget-Warnung triggern
```
"85€ für Software-Tools ausgegeben, IT & Software"
```
**Erwartung:** Budget-Warnung erscheint (85% von 100€ = 85%)

### 4.5 Budgets auflisten
```
"Zeig alle Budgets"
```
**Erwartung:** Liste mit Status (ok/warning/exceeded)

### 4.6 Budget deaktivieren
```
"Deaktiviere das IT & Software Budget"
```
**Erwartung:** Budget wird deaktiviert

---

## Phase 5: Projekte (Freemium: max 3)

### 5.1 Erstes Projekt erstellen
```
"Erstelle Projekt 'Website Relaunch' mit Budget 5000€"
```
**Erwartung:** Projekt wird erstellt

### 5.2 Transaktion mit Projekt
```
"800€ Einnahme für Website Relaunch erhalten"
```
**Erwartung:** Einnahme dem Projekt zugeordnet

### 5.3 Projekt-Ausgabe
```
"120€ für Hosting ausgegeben, Projekt Website Relaunch"
```
**Erwartung:** Ausgabe dem Projekt zugeordnet

### 5.4 Projekte auflisten
```
"Zeig alle Projekte"
```
**Erwartung:** Projekt mit Budget, Spent, Earned, Transaktionen

### 5.5 Zweites und drittes Projekt
```
"Erstelle Projekt 'App Development'"
"Erstelle Projekt 'SEO Beratung'"
```
**Erwartung:** Beide werden erstellt, Limit-Hinweis (2/3, dann 3/3)

### 5.6 Viertes Projekt (sollte fehlschlagen)
```
"Erstelle Projekt 'Neues Projekt'"
```
**Erwartung:** Fehler - Limit von 3 Projekten erreicht

### 5.7 Projekt umbenennen
```
"Benenne 'SEO Beratung' um in 'SEO Consulting'"
```
**Erwartung:** Name wird geändert

### 5.8 Projekt löschen
```
"Lösche das Projekt SEO Consulting"
```
**Erwartung:** Projekt gelöscht, Transaktionen bleiben erhalten (ohne Projekt-Zuordnung)

---

## Phase 6: Wiederkehrende Transaktionen

### 6.1 Monatliche Ausgabe erstellen
```
"Erstelle wiederkehrende Ausgabe: 29,99€ monatlich für Netflix"
```
**Erwartung:** Recurring wird erstellt mit next_due heute

### 6.2 Jährliche Ausgabe
```
"Jährlich 199€ für Domain-Renewal"
```
**Erwartung:** Recurring mit yearly interval

### 6.3 Monatliche Einnahme
```
"Monatlich 500€ Retainer-Einnahme ab nächsten Monat"
```
**Erwartung:** Recurring mit start_date im nächsten Monat

### 6.4 Recurring auflisten
```
"Zeig wiederkehrende Transaktionen"
```
**Erwartung:** Liste mit monthly_projection (monatliche Hochrechnung)

### 6.5 Recurring verarbeiten
```
"Verarbeite fällige Transaktionen"
```
**Erwartung:** Fällige Recurring werden zu echten Transaktionen, next_due wird aktualisiert

### 6.6 Recurring löschen
```
"Lösche das Netflix-Abo"
```
**Erwartung:** Recurring wird entfernt

---

## Phase 7: Rechnungen

### 7.1 Einfache Rechnung erstellen
```
"Erstelle eine Rechnung für 'Kunde AG' über 1500€ für Beratung"
```
**Erwartung:** PDF wird generiert, Rechnungsnummer 2026-001

### 7.2 Rechnung mit mehreren Positionen
```
"Rechnung für 'Startup GmbH': 10 Stunden Entwicklung à 150€, 5 Stunden Support à 100€"
```
**Erwartung:** Rechnung mit 2 Positionen, Total 2000€

### 7.3 Rechnungen auflisten
```
"Zeig alle Rechnungen"
```
**Erwartung:** 2 Rechnungen im Status 'Entwurf'

### 7.4 Rechnung als versendet markieren
```
"Markiere Rechnung 2026-001 als versendet"
```
**Erwartung:** Status wird 'sent'

### 7.5 Rechnung als bezahlt markieren
```
"Rechnung 2026-001 wurde bezahlt"
```
**Erwartung:** Status wird 'paid'

### 7.6 Rechnung duplizieren
```
"Dupliziere die Rechnung für Startup GmbH"
```
**Erwartung:** Neue Rechnung 2026-003 als Entwurf

### 7.7 Rechnung anzeigen
```
"Zeig Details zu Rechnung 2026-002"
```
**Erwartung:** Vollständige Rechnungsdetails inkl. Positionen

---

## Phase 8: Zusammenfassungen & Reports

### 8.1 Monatsübersicht
```
"Wie lief mein Januar?"
```
**Erwartung:** Einnahmen, Ausgaben, Netto, nach Kategorie

### 8.2 Quartalsübersicht
```
"Zeig Q1 Übersicht"
```
**Erwartung:** Quartalszahlen

### 8.3 Kategorie-Aufschlüsselung
```
"Wofür gebe ich am meisten aus?"
```
**Erwartung:** Ausgaben nach Kategorie sortiert mit Prozent

### 8.4 Periodenvergleich
```
"Vergleiche Januar mit Dezember"
```
**Erwartung:** Änderungen bei Einnahmen, Ausgaben, Netto

### 8.5 Steuerübersicht
```
"Zeig Steuerübersicht für 2026"
```
**Erwartung:** EÜR-Struktur mit Betriebseinnahmen/-ausgaben, Gewinn

---

## Phase 9: Export

### 9.1 Transaktionen als CSV
```
"Exportiere alle Transaktionen als CSV"
```
**Erwartung:** CSV-Datei in data/exports/

### 9.2 Transaktionen als JSON
```
"Exportiere Transaktionen als JSON"
```
**Erwartung:** JSON-Datei mit Zusammenfassung

### 9.3 Rechnungen exportieren
```
"Exportiere alle Rechnungen"
```
**Erwartung:** JSON-Datei mit Rechnungsdaten

### 9.4 Steuerberater-Export (CSV)
```
"Exportiere für meinen Steuerberater, Jahr 2026"
```
**Erwartung:** CSV mit SKR03-Konten, EÜR-Zeilen

### 9.5 Steuerberater-Export (DATEV)
```
"DATEV-Export für 2026"
```
**Erwartung:** DATEV-kompatible CSV mit EXTF-Header

### 9.6 Export-Dateien prüfen
```bash
ls -la ~/Projects/spendlog/data/exports/
```
**Erwartung:** Alle Export-Dateien vorhanden

---

## Phase 10: Benachrichtigungen

### 10.1 Benachrichtigungen prüfen
```
"Was steht an?"
```
**Erwartung:** Liste mit fälligen Recurring, überfälligen Rechnungen, Budget-Warnungen

---

## Phase 11: Verbindung (optional)

### 11.1 Verbindungsstatus
```
"Zeig Verbindungsstatus"
```
**Erwartung:** Nicht verbunden, Hinweis auf Features

### 11.2 Verbinden
```
"Verbinde Spendlog mit Web"
```
**Erwartung:** Link wird generiert (funktioniert ohne echte API nicht)

---

## Checkliste

- [ ] Phase 1: Profil
- [ ] Phase 2: Kategorien
- [ ] Phase 3: Transaktionen
- [ ] Phase 4: Budgets
- [ ] Phase 5: Projekte
- [ ] Phase 6: Recurring
- [ ] Phase 7: Rechnungen
- [ ] Phase 8: Reports
- [ ] Phase 9: Export
- [ ] Phase 10: Notifications
- [ ] Phase 11: Connection

---

## Cleanup nach Test

```bash
# Testdaten löschen
rm -rf ~/.spendlog
rm ~/Projects/spendlog/data/spendlog.db
rm -rf ~/Projects/spendlog/data/exports/*
rm -rf ~/Projects/spendlog/data/invoices/*
```
