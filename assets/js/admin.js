document.addEventListener('DOMContentLoaded', () => {
  const Shared = window.VersuzShared;
  let data = Shared.loadAppData();
  const root = document.getElementById('adminRoot');
  let adminLogged = false;

  function renderLogin() {
    root.innerHTML = `
      <div class="login-overlay">
        <h3>🔐 Backoffice login</h3>
        <input type="text" id="adminUsername" placeholder="Gebruikersnaam">
        <input type="password" id="adminPassword" placeholder="Wachtwoord">
        <button id="submitAdminLogin" class="small-btn">Inloggen</button>
        <p class="warning">${Shared.ADMIN_USERNAME} / ${Shared.ADMIN_PASSWORD}</p>
      </div>
    `;
    document.getElementById('submitAdminLogin').addEventListener('click', () => {
      const user = document.getElementById('adminUsername').value.trim();
      const pwd = document.getElementById('adminPassword').value.trim();
      if (user === Shared.ADMIN_USERNAME && pwd === Shared.ADMIN_PASSWORD) {
        adminLogged = true;
        renderAdmin();
      } else {
        alert('Ongeldige login');
      }
    });
  }

  function adminShell() {
    return `
      <h2>🛠️ Admin dashboard</h2>
      <div class="admin-tabs">
        <button class="admin-tab-btn active" data-tab="stream">Stream</button>
        <button class="admin-tab-btn" data-tab="schedule">Planning</button>
        <button class="admin-tab-btn" data-tab="news">Nieuws</button>
        <button class="admin-tab-btn" data-tab="metadata">Metadata</button>
        <button class="admin-tab-btn" data-tab="ads">Advertenties</button>
      </div>

      <div id="tab-stream" class="admin-tab-panel active">
        <div class="admin-form">
          <h3>🎵 Stream & metadata bron</h3>
          <label>Stream URL</label>
          <input type="text" id="streamUrlInput" value="${data.streamUrl}">
          <label>Metadata URL</label>
          <input type="text" id="metaBaseUrl" value="${data.metadataSource.baseUrl}">
          <label>Metadata type</label>
          <select id="metaType"><option value="proxy" ${data.metadataSource.type === 'proxy' ? 'selected' : ''}>Plain text via proxy</option></select>
          <button id="saveStreamBtn" class="small-btn">Opslaan</button>
          <div class="inline-note">Gebruik normaal <code class="code-inline">/api/metadata</code> als metadata URL.</div>
        </div>
      </div>

      <div id="tab-schedule" class="admin-tab-panel">
        <div class="admin-form"><h3>📅 Weekprogramma</h3><div id="weeklyScheduleEditor"></div><button id="saveWeeklyBtn" class="small-btn">Opslaan</button></div>
        <div class="admin-form"><h3>📌 Vervangingen</h3><input type="date" id="ovDate"><input type="text" id="ovStart" placeholder="Start vb 14:00"><input type="text" id="ovEnd" placeholder="Eind vb 16:00"><input type="text" id="ovTitle" placeholder="Programma"><textarea id="ovDesc" rows="2" placeholder="Omschrijving"></textarea><button id="addOvBtn" class="small-btn">Toevoegen</button><div id="overrideListAdmin"></div></div>
      </div>

      <div id="tab-news" class="admin-tab-panel">
        <div class="admin-form"><h3>📰 Nieuws</h3><input type="text" id="newsTitleInput" placeholder="Titel"><textarea id="newsContentInput" rows="3" placeholder="Inhoud"></textarea><input type="file" id="newsImageUpload" accept="image/*"><div class="flex-row"><button id="addNewsAdminBtn" class="small-btn">Toevoegen</button><select id="newsSelectDelete"></select><button id="delNewsBtn" class="small-btn">Verwijder</button></div><div id="newsCountAdmin"></div></div>
      </div>

      <div id="tab-metadata" class="admin-tab-panel">
        <div class="admin-form"><h3>🔑 Metadata keywords & aantal spots</h3><p class="warning">Hier leg je vast: welke metadata keyword bestaat en hoeveel spots moeten spelen als die keyword verschijnt.</p><div class="flex-row"><input type="text" id="metaKeywordInput" placeholder="vb adcount- of sponsor-a"><input type="number" id="metaKeywordCountInput" min="1" max="10" value="1" style="width:120px"><button id="addMetaKeywordBtn" class="small-btn">Toevoegen / updaten</button></div><div id="metaKeywordListAdmin"></div></div>
        <div class="admin-form"><h3>🎵 Handmatige metadata fallback</h3><input type="text" id="manualMetaInput" value="${data.manualMetadata || ''}" placeholder="Titel artiest - nummer"><button id="setManualMetaBtn" class="small-btn">Opslaan</button></div>
      </div>

      <div id="tab-ads" class="admin-tab-panel">
        <div class="admin-form">
          <h3>📢 Spots toevoegen</h3>
          <input type="text" id="adNameInput" placeholder="Spotnaam">
          <input type="text" id="advertiserInput" placeholder="Adverteerder">
          <select id="adTypeSelect"><option value="preroll">Preroll</option><option value="midroll">Midroll</option><option value="both">Beide</option></select>
          <select id="triggerTypeSelect"><option value="metadata">Metadata-keyword</option><option value="datetime">Vaste datum/tijd</option></select>
          <label>Metadata keyword</label>
          <select id="triggerKeywordSelect">${Shared.metadataKeywordOptionsHtml(data)}</select>
          <input type="text" id="adUrlInput" placeholder="Audio URL mp3 (optioneel)">
          <input type="file" id="adFileUpload" accept="audio/mpeg,audio/mp3,audio/*">
          <input type="datetime-local" id="adStart">
          <input type="datetime-local" id="adEnd">
          <div class="flex-row"><label>Startuur <input type="number" id="adHourStart" min="0" max="23" style="width:90px"></label><label>Einduur <input type="number" id="adHourEnd" min="0" max="23" style="width:90px"></label><label>Max per dag <input type="number" id="adMaxPerDay" min="1" value="4" style="width:110px"></label><label>Max totaal <input type="number" id="adMaxPlays" min="1" value="50" style="width:110px"></label></div>
          <textarea id="adNotesInput" rows="2" placeholder="Notities / campagne-info"></textarea>
          <button id="addAdRuleBtn" class="small-btn">Spot toevoegen</button>
        </div>
        <div class="admin-form"><h3>📋 Spotoverzicht</h3><div id="adRulesListAdmin"></div></div>
        <div class="admin-form"><h3>📊 Per adverteerder</h3><div id="advertiserStatsAdmin"></div></div>
      </div>

      <div class="top-actions" style="margin-top:1rem;"><button id="resetDemoBtn" class="small-btn" style="background:#7a2e2e;">Reset lokale data</button><button id="logoutAdminBtn" class="small-btn">Uitloggen</button></div>
    `;
  }

  function renderWeeklyEditor() {
    const editor = document.getElementById('weeklyScheduleEditor');
    editor.innerHTML = data.weeklySchedule.map((day, dayIndex) => {
      const rows = day.slots.map((slot, slotIndex) => `<div class="flex-row"><input type="text" value="${slot.time}" data-day="${dayIndex}" data-slot="${slotIndex}" data-field="time" style="width:130px"><input type="text" value="${slot.title}" data-day="${dayIndex}" data-slot="${slotIndex}" data-field="title"><input type="text" value="${slot.desc || ''}" data-day="${dayIndex}" data-slot="${slotIndex}" data-field="desc"><button class="small-btn removeSlotBtn" data-day="${dayIndex}" data-slot="${slotIndex}">X</button></div>`).join('');
      return `<div style="border:1px solid #3f4560; border-radius:1rem; margin-bottom:1rem; padding:0.8rem;"><h4>${day.day}</h4>${rows}<button class="small-btn addSlotBtn" data-day="${dayIndex}">Tijdslot toevoegen</button></div>`;
    }).join('');

    document.querySelectorAll('[data-field]').forEach(inp => inp.addEventListener('change', () => {
      const d = parseInt(inp.dataset.day, 10);
      const s = parseInt(inp.dataset.slot, 10);
      const f = inp.dataset.field;
      data.weeklySchedule[d].slots[s][f] = inp.value;
      Shared.saveWeeklySchedule(data);
    }));

    document.querySelectorAll('.removeSlotBtn').forEach(btn => btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day, 10);
      const s = parseInt(btn.dataset.slot, 10);
      data.weeklySchedule[d].slots.splice(s, 1);
      Shared.saveWeeklySchedule(data);
      renderWeeklyEditor();
    }));

    document.querySelectorAll('.addSlotBtn').forEach(btn => btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day, 10);
      data.weeklySchedule[d].slots.push({ time: '00:00-00:00', title: 'Nieuw', desc: '' });
      Shared.saveWeeklySchedule(data);
      renderWeeklyEditor();
    }));
  }

  function renderOverrides() {
    const div = document.getElementById('overrideListAdmin');
    div.innerHTML = data.overrides.map((o, idx) => `<div><b>${o.date} ${o.startTime}-${o.endTime}</b> ${o.programTitle} <button class="small-btn" data-ovidx="${idx}">X</button></div>`).join('') || '<p class="warning">Nog geen vervangingen.</p>';
    document.querySelectorAll('[data-ovidx]').forEach(btn => btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.ovidx, 10);
      data.overrides.splice(idx, 1);
      Shared.saveOverrides(data);
      renderOverrides();
    }));
  }

  function renderNewsAdmin() {
    const sel = document.getElementById('newsSelectDelete');
    sel.innerHTML = data.news.map(n => `<option value="${n.id}">${n.title}</option>`).join('');
    document.getElementById('newsCountAdmin').innerHTML = `${data.news.length} nieuwsitems`;
  }

  function renderMetadataKeywords() {
    const list = document.getElementById('metaKeywordListAdmin');
    const entries = Object.entries(data.metaKeywordQuotas || {});
    document.getElementById('triggerKeywordSelect').innerHTML = Shared.metadataKeywordOptionsHtml(data, document.getElementById('triggerKeywordSelect').value || '');
    if (!entries.length) {
      list.innerHTML = '<p class="warning">Nog geen metadata keywords ingesteld.</p>';
      return;
    }
    list.innerHTML = `<table><thead><tr><th>Metadata keyword</th><th>Aantal spots</th><th>Actie</th></tr></thead><tbody>${entries.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td><button class="small-btn" data-edit-meta="${k}">Bewerk</button> <button class="small-btn" data-del-meta="${k}">Verwijder</button></td></tr>`).join('')}</tbody></table>`;
    document.querySelectorAll('[data-edit-meta]').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.editMeta;
      document.getElementById('metaKeywordInput').value = key;
      document.getElementById('metaKeywordCountInput').value = data.metaKeywordQuotas[key];
    }));
    document.querySelectorAll('[data-del-meta]').forEach(btn => btn.addEventListener('click', () => {
      delete data.metaKeywordQuotas[btn.dataset.delMeta];
      Shared.saveMetaKeywordQuotas(data);
      renderMetadataKeywords();
    }));
  }

  function renderAdRules() {
    Shared.resetDailyAdCounters(data);
    const div = document.getElementById('adRulesListAdmin');
    if (!data.adRules.length) {
      div.innerHTML = '<p class="warning">Nog geen spots toegevoegd.</p>';
      return;
    }
    div.innerHTML = data.adRules.map((r, i) => {
      r = Shared.normalizeAdRule(r);
      return `<div style="border-left:3px solid #ff8855; margin:6px 0; padding:8px; border-radius:0.7rem; background:#13182a;"><b>${r.name}</b> — ${r.advertiser}<br>type: ${r.type} • metadata: ${r.triggerType}:${r.triggerValue || '-'}<br>uur: ${r.hourStart === '' ? 'altijd' : r.hourStart + ':00'} - ${r.hourEnd === '' ? 'altijd' : r.hourEnd + ':00'}<br>vandaag: ${r.playsToday}/${r.maxPerDay} • totaal: ${r.currentPlays}/${r.maxPlays}<br>periode: ${r.startDateTime} tot ${r.endDateTime}<br>audio: ${r.audioMode === 'upload' ? 'upload in browser' : (r.audioUrl || '-')}<br><button class="small-btn" data-adidx="${i}">Verwijder</button></div>`;
    }).join('');
    document.querySelectorAll('[data-adidx]').forEach(btn => btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.adidx, 10);
      const ad = Shared.normalizeAdRule(data.adRules[idx]);
      data.adRules.splice(idx, 1);
      Shared.saveAdRules(data);
      if (ad.audioMode === 'upload') await Shared.deleteAdAudioFromDB(ad.id).catch(() => null);
      renderAdRules();
      renderAdvertiserStats();
    }));
  }

  function renderAdvertiserStats() {
    const div = document.getElementById('advertiserStatsAdmin');
    const grouped = {};
    data.adRules.map(Shared.normalizeAdRule).forEach(ad => {
      if (!grouped[ad.advertiser]) grouped[ad.advertiser] = { spots: 0, today: 0, total: 0 };
      grouped[ad.advertiser].spots += 1;
      grouped[ad.advertiser].today += ad.playsToday;
      grouped[ad.advertiser].total += ad.currentPlays;
    });
    const rows = Object.entries(grouped);
    div.innerHTML = rows.length ? `<table><thead><tr><th>Adverteerder</th><th>Spots</th><th>Vandaag</th><th>Totaal</th></tr></thead><tbody>${rows.map(([n, v]) => `<tr><td>${n}</td><td>${v.spots}</td><td>${v.today}</td><td>${v.total}</td></tr>`).join('')}</tbody></table>` : '<p class="warning">Nog geen adverteerders of spots toegevoegd.</p>';
  }

  function bindTabs() {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    }));
  }

  function bindEvents() {
    document.getElementById('saveStreamBtn').addEventListener('click', () => {
      data.streamUrl = document.getElementById('streamUrlInput').value.trim();
      data.metadataSource = { baseUrl: document.getElementById('metaBaseUrl').value.trim(), type: document.getElementById('metaType').value };
      Shared.saveStreamUrl(data);
      Shared.saveMetadataSource(data);
      alert('Stream en metadata opgeslagen.');
    });

    document.getElementById('saveWeeklyBtn').addEventListener('click', () => {
      Shared.saveWeeklySchedule(data);
      alert('Weekprogramma opgeslagen.');
    });

    document.getElementById('addOvBtn').addEventListener('click', () => {
      const date = document.getElementById('ovDate').value;
      const start = document.getElementById('ovStart').value.trim();
      const end = document.getElementById('ovEnd').value.trim();
      const title = document.getElementById('ovTitle').value.trim();
      const desc = document.getElementById('ovDesc').value.trim();
      if (!date || !start || !end || !title) return alert('Vul datum, start, eind en programma in.');
      data.overrides.push({ date, startTime: start, endTime: end, programTitle: title, desc });
      Shared.saveOverrides(data);
      renderOverrides();
    });

    document.getElementById('addNewsAdminBtn').addEventListener('click', () => {
      const title = document.getElementById('newsTitleInput').value.trim();
      const content = document.getElementById('newsContentInput').value.trim();
      const file = document.getElementById('newsImageUpload').files[0];
      if (!title || !content) return alert('Titel en inhoud zijn verplicht.');
      const addNews = imageData => {
        data.news.push({ id: 'n' + Date.now(), title, content, date: new Date().toISOString().slice(0, 10), imageData: imageData || '' });
        Shared.saveNews(data);
        renderNewsAdmin();
        alert('Nieuws toegevoegd.');
      };
      if (file) {
        const reader = new FileReader();
        reader.onload = e => addNews(e.target.result);
        reader.readAsDataURL(file);
      } else {
        addNews('');
      }
    });

    document.getElementById('delNewsBtn').addEventListener('click', () => {
      const id = document.getElementById('newsSelectDelete').value;
      data.news = data.news.filter(n => n.id !== id);
      Shared.saveNews(data);
      renderNewsAdmin();
    });

    document.getElementById('addMetaKeywordBtn').addEventListener('click', () => {
      const keyword = document.getElementById('metaKeywordInput').value.trim().toLowerCase();
      const count = parseInt(document.getElementById('metaKeywordCountInput').value || '1', 10);
      if (!keyword) return alert('Geef een metadata keyword in.');
      if (Number.isNaN(count) || count < 1) return alert('Geef een geldig aantal spots in.');
      data.metaKeywordQuotas[keyword] = count;
      Shared.saveMetaKeywordQuotas(data);
      document.getElementById('metaKeywordInput').value = '';
      document.getElementById('metaKeywordCountInput').value = 1;
      renderMetadataKeywords();
    });

    document.getElementById('setManualMetaBtn').addEventListener('click', () => {
      data.manualMetadata = document.getElementById('manualMetaInput').value.trim();
      Shared.saveManualMetadata(data.manualMetadata);
      alert('Handmatige metadata opgeslagen.');
    });

    document.getElementById('addAdRuleBtn').addEventListener('click', async () => {
      const name = document.getElementById('adNameInput').value.trim();
      const advertiser = document.getElementById('advertiserInput').value.trim();
      const type = document.getElementById('adTypeSelect').value;
      const triggerType = document.getElementById('triggerTypeSelect').value;
      const triggerValue = document.getElementById('triggerKeywordSelect').value.trim();
      const url = document.getElementById('adUrlInput').value.trim();
      const file = document.getElementById('adFileUpload').files[0];
      const start = document.getElementById('adStart').value;
      const end = document.getElementById('adEnd').value;
      const hourStart = document.getElementById('adHourStart').value;
      const hourEnd = document.getElementById('adHourEnd').value;
      const maxPerDay = parseInt(document.getElementById('adMaxPerDay').value || '4', 10);
      const maxPlays = parseInt(document.getElementById('adMaxPlays').value || '50', 10);
      const notes = document.getElementById('adNotesInput').value.trim();

      if (!name || !advertiser || !start || !end) return alert('Vul minstens spotnaam, adverteerder, start en eind in.');
      if (!file && !url) return alert('Upload een mp3 of geef een audio URL in.');
      if (triggerType === 'metadata' && !triggerValue) return alert('Maak eerst een metadata keyword aan en kies het in de dropdown.');

      const ad = Shared.normalizeAdRule({
        id: 'ad' + Date.now(),
        name, advertiser, type, triggerType, triggerValue,
        audioMode: file ? 'upload' : 'url', audioUrl: url, hasUploadedAudio: !!file,
        startDateTime: start, endDateTime: end,
        hourStart: hourStart === '' ? '' : String(hourStart),
        hourEnd: hourEnd === '' ? '' : String(hourEnd),
        maxPerDay, maxPlays, notes,
        currentPlays: 0, playsToday: 0, enabled: true
      });

      if (file) {
        const dataUrl = await Shared.readFileAsDataURL(file);
        await Shared.saveAdAudioToDB(ad.id, dataUrl);
      }

      data.adRules.push(ad);
      Shared.saveAdRules(data);
      renderAdRules();
      renderAdvertiserStats();
      alert('Spot toegevoegd.');
    });

    document.getElementById('resetDemoBtn').addEventListener('click', () => {
      if (!confirm('Alles lokaal resetten?')) return;
      localStorage.clear();
      location.reload();
    });
    document.getElementById('logoutAdminBtn').addEventListener('click', () => { adminLogged = false; renderLogin(); });
  }

  function renderAdmin() {
    data = Shared.loadAppData();
    root.innerHTML = adminShell();
    bindTabs();
    bindEvents();
    renderWeeklyEditor();
    renderOverrides();
    renderNewsAdmin();
    renderMetadataKeywords();
    renderAdRules();
    renderAdvertiserStats();
  }

  renderLogin();
});
