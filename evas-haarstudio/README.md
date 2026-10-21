# Evas Haarstudio — Webseite mit Online-Terminbuchung

Friseur in Inning am Ammersee, Münchener Straße 13. Eine Stylistin, ein Kalender:
Kunden wählen Leistung, Tag und Uhrzeit; der Server verhindert Doppelbuchungen.

## Lokal starten
```bash
npm install
npm start      # → http://localhost:3000
```

## VOR DEM LIVE-GANG (Checkliste)
Alles, was auf der Seite gelb markiert ist, ist noch Platzhalter:

- [ ] **Preise** in `server.js` → `SERVICES` mit Eva abstimmen (aktuell frei gewählte Platzhalter)
- [ ] **Öffnungszeiten**: Montag/Samstag sind als geschlossen angenommen → `server.js` → `OPENING_HOURS` und `public/script.js` → `CLOSED_WEEKDAYS`
- [ ] **E-Mail-Adresse** in `index.html`, `impressum.html`, `datenschutz.html`
- [ ] **Über Eva**: Text von Eva selbst, nur bestätigte Angaben
- [ ] **Fotos** (Vorher/Nachher, Salon): echte Bilder; Einverständnis der abgebildeten Personen einholen
- [ ] **Google-Bewertungen**: Sterne/Anzahl eintragen und den Link in `index.html` (Abschnitt `#bewertungen`) auf das echte Google-Profil setzen. Einzelne Bewertungstexte nur mit Erlaubnis der Verfasser:innen
- [ ] **Instagram**: Handle eintragen oder Zeile entfernen
- [ ] **Impressum**: Name, Rechtsform, ggf. USt-ID, ggf. Kammerangaben
- [ ] **Datenschutz**: Hosting-Anbieter eintragen, Auftragsverarbeitungsvertrag abschließen; Text gegenprüfen lassen (Vorlage, keine Rechtsberatung)
- [ ] **Admin-Passwort** ändern: in Render unter Environment `ADMIN_PASSWORD` setzen (Standard `bitte-aendern-1234` NICHT live lassen)
- [ ] **Render**: Starter-Tarif (kein Einschlafen) und möglichst Region Frankfurt wählen

## Wichtige Dateien
| Was | Wo |
|---|---|
| Texte, Kontaktdaten | `public/index.html` |
| Leistungen, Preise, Öffnungszeiten | `server.js` |
| Farben | `public/style.css` (`:root`) |
| Schriften (selbst gehostet) | `public/fonts.css`, `public/fonts/` |
| Admin-Übersicht | `/admin.html` (passwortgeschützt) |

## Deployment (Render.com)
Code ohne `node_modules` zu GitHub → Render: New → Web Service →
Build Command `npm install`, Start Command `npm start`.

## Hinweise
- Buchungen liegen in `bookings.json`. Auf Render geht diese Datei bei einem
  Neustart/Redeploy verloren, sofern kein persistenter Datenträger (Disk)
  angehängt ist — für den echten Betrieb einen Disk einrichten.
- Es werden noch **keine E-Mails** verschickt. `notifySalonOwner()` in `server.js`
  ist der Einstiegspunkt (z. B. Zapier-Webhook über `ZAPIER_WEBHOOK_URL`).
- Die Google-Karte wird beim Seitenaufruf geladen (im Datenschutztext vermerkt).
