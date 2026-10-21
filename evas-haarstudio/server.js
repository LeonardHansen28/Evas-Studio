// Evas Haarstudio — Buchungs-Server
// Node.js + Express, dateibasierte JSON-"Datenbank" (bookings.json)

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'bookings.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Konfiguration ----------

// Öffnungszeiten in Minuten seit Mitternacht (Evas Haarstudio öffnet um 8:30).
// ANNAHME: Montag und Samstag geschlossen, da nicht angegeben — bei Bedarf hier anpassen.
const OPENING_HOURS = {
  0: null,                      // Sonntag geschlossen
  1: null,                      // Montag geschlossen (Annahme)
  2: [8 * 60 + 30, 18 * 60],    // Dienstag 8:30–18:00
  3: [8 * 60 + 30, 18 * 60],    // Mittwoch 8:30–18:00
  4: [8 * 60 + 30, 19 * 60],    // Donnerstag 8:30–19:00
  5: [8 * 60 + 30, 18 * 60],    // Freitag 8:30–18:00
  6: null                       // Samstag geschlossen (Annahme)
};

const SLOT_MINUTES = 30;
const BOOKING_HORIZON_DAYS = 21;

// PLATZHALTERPREISE — frei gewählt, da die echten Preise noch nicht feststehen.
// Vor dem Live-Gang mit Eva abstimmen und anpassen!
const SERVICES = [
  { id: 'damen-schnitt-kurz', name: 'Damenhaarschnitt kurz/mittel inkl. Waschen & Föhnen', duration: 45, price: 42 },
  { id: 'damen-schnitt-lang', name: 'Damenhaarschnitt lang inkl. Waschen & Föhnen', duration: 60, price: 52 },
  { id: 'herren-schnitt', name: 'Herrenhaarschnitt', duration: 30, price: 26 },
  { id: 'farbe-ansatz', name: 'Ansatzfarbe', duration: 60, price: 48 },
  { id: 'straehnen', name: 'Strähnen / Balayage', duration: 120, price: 89 },
  { id: 'waschen-foehnen', name: 'Waschen & Föhnen', duration: 30, price: 22 },
  { id: 'hochsteckfrisur', name: 'Hochsteckfrisur (Events/Feiern)', duration: 60, price: 59 },
  { id: 'dauerwelle', name: 'Dauerwelle', duration: 90, price: 79 },
];

function loadBookings() {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch { return []; }
}
function saveBookings(bookings) {
  fs.writeFileSync(DB_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
}

function pad(n) { return String(n).padStart(2, '0'); }

function generateSlotsForDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = date.getDay();
  const hours = OPENING_HOURS[weekday];
  if (!hours) return [];
  const [startMin, endMin] = hours;
  const slots = [];
  for (let t = startMin; t < endMin; t += SLOT_MINUTES) {
    slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return slots;
}

function isDateBookable(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((target - today) / 86400000);
  return diffDays >= 0 && diffDays <= BOOKING_HORIZON_DAYS;
}

// ---------- API ----------

app.get('/api/services', (req, res) => res.json(SERVICES));

app.get('/api/slots', (req, res) => {
  const { date, serviceId } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Ungültiges oder fehlendes Datum (YYYY-MM-DD).' });
  }
  if (!isDateBookable(date)) return res.json({ date, slots: [] });

  const service = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
  const allSlots = generateSlotsForDate(date);
  const bookings = loadBookings().filter(b => b.date === date && b.status !== 'storniert');
  const toMinutes = (t) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; };
  const bookedRanges = bookings.map(b => {
    const bService = SERVICES.find(s => s.id === b.serviceId) || SERVICES[0];
    const start = toMinutes(b.time);
    return [start, start + bService.duration];
  });

  const freeSlots = allSlots.filter(slot => {
    const start = toMinutes(slot);
    const end = start + service.duration;
    const weekday = new Date(date + 'T00:00:00').getDay();
    const hours = OPENING_HOURS[weekday];
    if (!hours) return false;
    if (end > hours[1]) return false;
    return !bookedRanges.some(([bStart, bEnd]) => start < bEnd && end > bStart);
  });

  res.json({ date, slots: freeSlots });
});

app.post('/api/book', (req, res) => {
  const { name, email, phone, serviceId, date, time } = req.body || {};
  if (!name || !email || !serviceId || !date || !time) {
    return res.status(400).json({ error: 'Bitte alle Pflichtfelder ausfüllen.' });
  }
  if (!isDateBookable(date)) {
    return res.status(400).json({ error: 'Dieses Datum liegt außerhalb des buchbaren Zeitraums.' });
  }
  const service = SERVICES.find(s => s.id === serviceId);
  if (!service) return res.status(400).json({ error: 'Unbekannte Leistung.' });

  const bookings = loadBookings();
  const toMinutes = (t) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; };
  const newStart = toMinutes(time);
  const newEnd = newStart + service.duration;

  const conflict = bookings
    .filter(b => b.date === date && b.status !== 'storniert')
    .some(b => {
      const bService = SERVICES.find(s => s.id === b.serviceId) || SERVICES[0];
      const bStart = toMinutes(b.time);
      const bEnd = bStart + bService.duration;
      return newStart < bEnd && newEnd > bStart;
    });

  if (conflict) {
    return res.status(409).json({ error: 'Dieser Termin wurde gerade eben vergeben. Bitte wähle einen anderen Slot.' });
  }

  const booking = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name, email, phone: phone || '',
    serviceId, serviceName: service.name,
    date, time, status: 'bestätigt',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  saveBookings(bookings);
  notifySalonOwner(booking);

  res.status(201).json({ booking });
});

app.post('/api/cancel/:id', (req, res) => {
  const bookings = loadBookings();
  const b = bookings.find(b => b.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Buchung nicht gefunden.' });
  b.status = 'storniert';
  saveBookings(bookings);
  res.json({ ok: true });
});

// ---------- Admin-Zugang ----------
// WICHTIG: Dieses Passwort vor dem Live-Gang ändern (z.B. über eine Umgebungsvariable)!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bitte-aendern-1234';

function checkAdminAuth(req, res) {
  const provided = req.query.password || (req.body && req.body.password);
  if (provided !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Falsches Passwort.' });
    return false;
  }
  return true;
}

app.get('/api/admin/bookings', (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  const bookings = loadBookings().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json({ bookings });
});

// ---------- Benachrichtigung bei neuer Buchung ----------
async function notifySalonOwner(booking) {
  console.log(`[Neue Buchung] ${booking.name} — ${booking.serviceName} am ${booking.date} um ${booking.time}`);

  const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL || '';
  if (ZAPIER_WEBHOOK_URL) {
    try {
      await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });
    } catch (err) {
      console.error('Zapier-Webhook fehlgeschlagen:', err.message);
    }
  }
  // Schritt B (optional): E-Mail-Versand per nodemailer / Resend / SendGrid ergänzen.
}

app.listen(PORT, () => {
  console.log(`Evas Haarstudio Buchungsserver läuft auf http://localhost:${PORT}`);
});
