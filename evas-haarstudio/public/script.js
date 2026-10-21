(function () {
  const CLOSED_WEEKDAYS = [0, 1, 6]; // So, Mo, Sa geschlossen (wie server.js)
  const DAYS_SHOWN = 14;

  const serviceSelect = document.getElementById('service-select');
  const dayPicker = document.getElementById('day-picker');
  const slotPicker = document.getElementById('slot-picker');
  const bookingSummary = document.getElementById('booking-summary');
  const submitBtn = document.getElementById('submit-btn');
  const form = document.getElementById('booking-form');
  const formNote = document.getElementById('form-note');

  let services = [];
  let selectedDate = null;
  let selectedTime = null;

  const dow = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  function fmtDateISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function loadServices() {
    const res = await fetch('/api/services');
    services = await res.json();
    serviceSelect.innerHTML = services.map(s =>
      `<option value="${s.id}">${s.name} — ${s.price} € (${s.duration} Min.)</option>`
    ).join('');

    const grid = document.getElementById('services-grid');
    grid.innerHTML = services.map(s => `
      <div class="service-card">
        <div><h3>${s.name}</h3><p>${s.duration} Minuten</p></div>
        <div class="service-price">${s.price} €</div>
      </div>
    `).join('');
  }

  function renderDays() {
    dayPicker.innerHTML = '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS_SHOWN; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      const iso = fmtDateISO(d);
      const closed = CLOSED_WEEKDAYS.includes(d.getDay());
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'day-btn'; btn.disabled = closed;
      btn.innerHTML = `<span class="dow">${dow[d.getDay()]}</span><span class="dnum">${d.getDate()}.${d.getMonth() + 1}.</span>`;
      btn.addEventListener('click', () => selectDay(iso, btn));
      dayPicker.appendChild(btn);
    }
  }

  function selectDay(iso, btn) {
    selectedDate = iso; selectedTime = null;
    [...dayPicker.children].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateSummary(); loadSlots();
  }

  async function loadSlots() {
    if (!selectedDate) return;
    slotPicker.innerHTML = '<div class="slot-hint">Lade freie Termine…</div>';
    const serviceId = serviceSelect.value;
    try {
      const res = await fetch(`/api/slots?date=${selectedDate}&serviceId=${encodeURIComponent(serviceId)}`);
      const data = await res.json();
      if (!data.slots || data.slots.length === 0) {
        slotPicker.innerHTML = '<div class="slot-empty">Keine freien Termine an diesem Tag — bitte einen anderen Tag wählen.</div>';
        return;
      }
      slotPicker.innerHTML = '';
      data.slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'slot-btn'; btn.textContent = slot;
        btn.addEventListener('click', () => selectSlot(slot, btn));
        slotPicker.appendChild(btn);
      });
    } catch (e) {
      slotPicker.innerHTML = '<div class="slot-empty">Termine konnten nicht geladen werden. Bitte Seite neu laden.</div>';
    }
  }

  function selectSlot(slot, btn) {
    selectedTime = slot;
    [...slotPicker.children].forEach(b => b.classList && b.classList.remove('active'));
    btn.classList.add('active');
    updateSummary();
  }

  function updateSummary() {
    if (selectedDate && selectedTime) {
      const service = services.find(s => s.id === serviceSelect.value);
      const [y, m, d] = selectedDate.split('-');
      bookingSummary.innerHTML = `<strong>${service ? service.name : ''}</strong> am <strong>${d}.${m}.${y}</strong> um <strong>${selectedTime} Uhr</strong> — ${service ? service.price + ' €' : ''}`;
      submitBtn.disabled = false;
    } else {
      bookingSummary.innerHTML = '<span class="summary-placeholder">Noch keine Zeit ausgewählt.</span>';
      submitBtn.disabled = true;
    }
  }

  serviceSelect.addEventListener('change', () => {
    selectedTime = null; updateSummary();
    if (selectedDate) loadSlots();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formNote.textContent = ''; formNote.className = 'form-note';
    if (!selectedDate || !selectedTime) {
      formNote.textContent = 'Bitte wähle zuerst Tag und Uhrzeit.';
      formNote.classList.add('error');
      return;
    }
    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      serviceId: serviceSelect.value, date: selectedDate, time: selectedTime
    };
    submitBtn.disabled = true; submitBtn.textContent = 'Wird gebucht…';
    try {
      const res = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        formNote.textContent = data.error || 'Buchung fehlgeschlagen.';
        formNote.classList.add('error');
        submitBtn.disabled = false; submitBtn.textContent = 'Termin verbindlich buchen';
        if (res.status === 409) loadSlots();
        return;
      }
      formNote.textContent = `Termin bestätigt! Wir haben dir eine Bestätigung an ${payload.email} geschickt. Buchungsnummer: ${data.booking.id}`;
      formNote.classList.add('success');
      form.reset(); selectedDate = null; selectedTime = null; updateSummary();
      slotPicker.innerHTML = '<div class="slot-hint">Bitte zuerst einen Tag wählen.</div>';
      [...dayPicker.children].forEach(b => b.classList.remove('active'));
      submitBtn.textContent = 'Termin verbindlich buchen';
    } catch (err) {
      formNote.textContent = 'Netzwerkfehler — bitte später erneut versuchen.';
      formNote.classList.add('error');
      submitBtn.disabled = false; submitBtn.textContent = 'Termin verbindlich buchen';
    }
  });

  loadServices();
  renderDays();
})();
