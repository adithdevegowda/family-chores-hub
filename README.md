# Family Chores Hub – kostenlose Live-Version

Diese Version ersetzt die Claude-spezifische Datenbank der ursprünglichen HTML-Datei durch **Cloudflare Workers + D1**. Das Layout orientiert sich am Original. Jeder Nutzer erstellt sein eigenes Profil mit **Name + sechsstelliger Zahlen-PIN** und dem einmalig vom Host mitgeteilten Familiencode. Die gemeinsame Speicherung liegt auf dem Server, nicht im Browser.

## Einrichtung (Windows, möglichst wenige Schritte)

1. Kostenloses Konto bei https://dash.cloudflare.com/sign-up erstellen. Den **Workers Free**-Tarif verwenden und nicht zu Paid wechseln.
2. Falls noch nicht vorhanden: **Node.js LTS** von https://nodejs.org installieren.
3. Diesen Ordner entpacken. Im Ordner `family-chores-live` das Windows-Terminal (PowerShell) öffnen.
4. Nacheinander ausführen:

   ```powershell
   npm install
   npx wrangler login
   npm run deploy
   npm run db:remote
   ```

   Wrangler kann die D1-Datenbank beim Deployment anhand der Konfiguration automatisch provisionieren. Falls dabei die Migration auf Anhieb nicht ausgeführt werden kann: `npm run deploy` erneut ausführen und danach `npm run db:remote` wiederholen.
5. Anschließend die angezeigte Adresse der Form `https://family-chores-hub-private.<dein-subdomain>.workers.dev` im Browser öffnen. Beim ersten Aufruf Host-Namen und eigene **6-stellige PIN** festlegen.
6. Im Tab **Verwaltung** steht ein **8-stelliger Familiencode**. Diesen und die Website-Adresse an deine Familienmitglieder weitergeben. Sie klicken auf **Profil erstellen**, wählen Namen und eigene Zahlen-PIN. Alle sehen den gleichen Datenbestand.

Für spätere Änderungen am Code genügt `npm run deploy`. Für normale Aufgabenplanung und Geldverwaltung ist kein Terminal und kein KI-Modell nötig.

## Wichtige Hinweise

- Diese Anwendung verwaltet nur **virtuelle Euro-Beträge**. Die Auszahlung erfolgt manuell und wird anschließend als ausgezahlt markiert.
- **Nicht erledigt** bedeutet in dieser Version: Die Belohnung entfällt. Es gibt **keinen automatischen Geldabzug**. Das schützt vor unfairen oder versehentlichen Strafen. Ein abgestuftes Strafsystem benötigt weitere Implementierung.
- Der **Host** bestätigt Aufgaben und bucht Auszahlungen. Andere können nur ihre eigenen Aufgaben als erledigt melden.
- Die Einladungs-PIN ist kein zweiter Anmeldefaktor. **Eine sechsstellige PIN ist schwächer als ein langes Passwort.** Nutze einen schwer zu erratenden PIN, teile den Familiencode nur privat und verwende die Anwendung nicht zur Verwaltung echter Bankdaten oder besonders sensibler Informationen.
- Die Anwendung bietet bisher **keine PIN-Wiederherstellung, keine Rate-Limit-Sperre, keine Wochenvorlagen und keine automatischen wiederkehrenden Aufgaben**. Für die private kleine Familie ist dies eine erste funktionale Version, aber kein auditiertes Produktivsystem.
- Beim kostenlosen Cloudflare-Tarif können Nutzungslimits greifen; dann werden Anfragen vorübergehend abgelehnt. Preise und Bedingungen bitte im Dashboard prüfen.
- Die Ersteinrichtung legt den ersten Host an. Daher **die Datenbank nicht vor dem eigenen ersten Aufruf mit Fremden teilen**.

## Datenschutz

PIN-Hashes werden mit PBKDF2 und individuellem Salt gespeichert. Session-Cookies sind HttpOnly, Secure und SameSite=Lax. Nur der Host kann Geld- und Aufgabenfreigaben durchführen. Mitgliederprofile und Kontostände sind für die angemeldeten Familienmitglieder sichtbar.

## Ordner

- `public/index.html` – responsive Website
- `public/app.js` – Bedienoberfläche
- `src/worker.js` – abgesicherte API
- `migrations/0001_init.sql` – Datenbankschema
- `ORIGINAL.html` – deine ursprüngliche Datei, unverändert als Referenz
