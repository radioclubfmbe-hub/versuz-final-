(function () {
  const ADMIN_USERNAME = 'jasper.cool';
  const ADMIN_PASSWORD = 'Appels54';

  const STORAGE = {
    weeklySchedule: 'versuz_weekly_schedule',
    overrides: 'versuz_overrides',
    news: 'versuz_news',
    adRules: 'versuz_ad_rules',
    metaKeywordQuotas: 'versuz_meta_quotas',
    streamUrl: 'versuz_stream_url',
    metadataSource: 'versuz_metadata_source',
    manualMetadata: 'versuz_manual_metadata'
  };

  const DEFAULT_WEEKLY_SCHEDULE = [
    { day: 'Maandag', slots: [{ time:'06:00-10:00', title:'Morning Energy', desc:'Energieke start'},{ time:'10:00-14:00', title:'Workout Beats', desc:'Sportieve tunes'},{ time:'14:00-18:00', title:'Drive Time', desc:'Verkeer en hits'},{ time:'18:00-22:00', title:'Versuz Vibes', desc:'Club sound'},{ time:'22:00-00:00', title:'Late Night Selecta', desc:''}] },
    { day: 'Dinsdag', slots: [{ time:'06:00-10:00', title:'Morning Energy', desc:''},{ time:'10:00-14:00', title:'Non-stop werkdag', desc:''},{ time:'14:00-18:00', title:'Versuz Choice', desc:''},{ time:'18:00-22:00', title:'Future Hits', desc:''},{ time:'22:00-00:00', title:'Midnight Mix', desc:''}] },
    { day: 'Woensdag', slots: [{ time:'06:00-10:00', title:'Goeiemorgen Versuz', desc:''},{ time:'10:00-14:00', title:'Fresh Wednesday', desc:''},{ time:'14:00-18:00', title:'Back2Back', desc:''},{ time:'18:00-22:00', title:'Dance Injection', desc:''},{ time:'22:00-00:00', title:'Underground Sessions', desc:''}] },
    { day: 'Donderdag', slots: [{ time:'06:00-10:00', title:'Wake Up!', desc:''},{ time:'10:00-14:00', title:'Middagshow', desc:''},{ time:'14:00-18:00', title:'Vintage Thursday', desc:''},{ time:'18:00-22:00', title:'The Warm Up', desc:''},{ time:'22:00-00:00', title:'Guest Mix', desc:''}] },
    { day: 'Vrijdag', slots: [{ time:'06:00-10:00', title:'Vrijdag Ochtend', desc:''},{ time:'10:00-14:00', title:'Frisse start', desc:''},{ time:'14:00-18:00', title:'Weekend countdown', desc:''},{ time:'18:00-22:00', title:'Versuz Friday Night', desc:''},{ time:'22:00-01:00', title:'Club Versuz', desc:''}] },
    { day: 'Zaterdag', slots: [{ time:'10:00-14:00', title:'Saturday Brunch', desc:''},{ time:'14:00-18:00', title:'Ultimate Dance', desc:''},{ time:'18:00-22:00', title:'Versuz Top 40', desc:''},{ time:'22:00-02:00', title:'Weekend Massive', desc:''}] },
    { day: 'Zondag', slots: [{ time:'10:00-14:00', title:'Relax Classics', desc:''},{ time:'14:00-18:00', title:'Soulful Sunday', desc:''},{ time:'18:00-22:00', title:'Retro Rewind', desc:''},{ time:'22:00-00:00', title:'Chillout', desc:''}] }
  ];

  function safeParse(text, fallback) {
    try { return JSON.parse(text); } catch (e) { return fallback; }
  }

  function normalizeMetadataSource(config) {
    if (!config || !config.baseUrl) return { baseUrl: '/api/metadata', type: 'proxy' };
    const url = String(config.baseUrl || '');
    if (url.includes('85.215.152.155') || url.includes('212.84.160.3')) return { baseUrl: '/api/metadata', type: 'proxy' };
    return { baseUrl: config.baseUrl, type: config.type || 'proxy' };
  }

  function normalizeStreamUrl(url) {
    if (!url || String(url).includes('85.215.152.155')) return 'https://212.84.160.3:11609/stream';
    return url;
  }

  function normalizeAdRule(ad) {
    return {
      id: ad?.id || ('ad' + Date.now() + Math.floor(Math.random() * 1000)),
      name: ad?.name || 'Nieuwe spot',
      advertiser: ad?.advertiser || 'Onbekende adverteerder',
      type: ad?.type || 'midroll',
      triggerType: ad?.triggerType || 'metadata',
      triggerValue: ad?.triggerValue || '',
      audioMode: ad?.audioMode || (ad?.audioUrl ? 'url' : 'upload'),
      audioUrl: ad?.audioUrl || '',
      hasUploadedAudio: !!ad?.hasUploadedAudio,
      startDateTime: ad?.startDateTime || new Date().toISOString().slice(0, 16),
      endDateTime: ad?.endDateTime || '2099-12-31T23:59',
      hourStart: ad?.hourStart ?? '',
      hourEnd: ad?.hourEnd ?? '',
      maxPlays: Number(ad?.maxPlays ?? 999999),
      currentPlays: Number(ad?.currentPlays ?? 0),
      maxPerDay: Number(ad?.maxPerDay ?? 999),
      playsToday: Number(ad?.playsToday ?? 0),
      lastPlayedAt: ad?.lastPlayedAt || '',
      lastPlayedDate: ad?.lastPlayedDate || '',
      enabled: ad?.enabled !== false,
      notes: ad?.notes || ''
    };
  }

  function loadAppData() {
    const weeklySchedule = safeParse(localStorage.getItem(STORAGE.weeklySchedule), DEFAULT_WEEKLY_SCHEDULE) || DEFAULT_WEEKLY_SCHEDULE;
    const overrides = safeParse(localStorage.getItem(STORAGE.overrides), []) || [];
    const news = safeParse(localStorage.getItem(STORAGE.news), []) || [];
    const adRules = (safeParse(localStorage.getItem(STORAGE.adRules), []) || []).map(normalizeAdRule);
    let metaKeywordQuotas = safeParse(localStorage.getItem(STORAGE.metaKeywordQuotas), { 'adcount-': 2, 'headlines': 3 }) || { 'adcount-': 2, 'headlines': 3 };
    if (Array.isArray(metaKeywordQuotas)) metaKeywordQuotas = { 'adcount-': 2, 'headlines': 3 };
    const streamUrl = normalizeStreamUrl(localStorage.getItem(STORAGE.streamUrl) || 'https://212.84.160.3:11609/stream');
    const metadataSource = normalizeMetadataSource(safeParse(localStorage.getItem(STORAGE.metadataSource), { baseUrl: '/api/metadata', type: 'proxy' }));
    const manualMetadata = localStorage.getItem(STORAGE.manualMetadata) || '';

    if (!news.length) {
      news.push(
        { id: 'n1', title: 'Versuz Radio 2 jaar!', content: 'Speciale uitzending 15 juni met live dj’s.', date: '2026-05-20', imageData: '' },
        { id: 'n2', title: 'Nieuwe programmadirecteur', content: 'Kevin van den Berg zorgt voor frisse sound.', date: '2026-05-18', imageData: '' }
      );
      localStorage.setItem(STORAGE.news, JSON.stringify(news));
    }

    localStorage.setItem(STORAGE.streamUrl, streamUrl);
    localStorage.setItem(STORAGE.metadataSource, JSON.stringify(metadataSource));

    return { weeklySchedule, overrides, news, adRules, metaKeywordQuotas, streamUrl, metadataSource, manualMetadata };
  }

  function saveWeeklySchedule(data) { localStorage.setItem(STORAGE.weeklySchedule, JSON.stringify(data.weeklySchedule)); }
  function saveOverrides(data) { localStorage.setItem(STORAGE.overrides, JSON.stringify(data.overrides)); }
  function saveNews(data) { localStorage.setItem(STORAGE.news, JSON.stringify(data.news)); }
  function saveAdRules(data) { localStorage.setItem(STORAGE.adRules, JSON.stringify(data.adRules.map(normalizeAdRule))); }
  function saveMetaKeywordQuotas(data) { localStorage.setItem(STORAGE.metaKeywordQuotas, JSON.stringify(data.metaKeywordQuotas)); }
  function saveStreamUrl(data) { localStorage.setItem(STORAGE.streamUrl, normalizeStreamUrl(data.streamUrl)); }
  function saveMetadataSource(data) { localStorage.setItem(STORAGE.metadataSource, JSON.stringify(normalizeMetadataSource(data.metadataSource))); }
  function saveManualMetadata(value) { localStorage.setItem(STORAGE.manualMetadata, value || ''); }

  function weekdays() { return ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']; }

  function getScheduleForDate(data, dateStr) {
    const dayName = weekdays()[new Date(dateStr).getDay()];
    let base = data.weeklySchedule.find(d => d.day === dayName) || { day: dayName, slots: [] };
    let slots = JSON.parse(JSON.stringify(base.slots || []));
    const dayOverrides = (data.overrides || []).filter(ov => ov.date === dateStr);
    dayOverrides.forEach(ov => {
      slots = slots.filter(s => !String(s.time || '').includes(ov.startTime));
      slots.push({ time: `${ov.startTime}-${ov.endTime}`, title: ov.programTitle, desc: ov.desc || 'Vervanging' });
    });
    slots.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return { dayName, slots, overrides: dayOverrides };
  }

  function getCurrentProgramTitle(data, now = new Date()) {
    const dateStr = now.toISOString().slice(0, 10);
    const { slots } = getScheduleForDate(data, dateStr);
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const active = slots.find(s => {
      const [start, end] = String(s.time || '').split('-');
      if (!start || !end) return false;
      const [sh, sm] = start.split(':').map(v => parseInt(v || '0', 10));
      const [eh, em] = end.split(':').map(v => parseInt(v || '0', 10));
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      return currentTime >= startMin && currentTime < endMin;
    });
    return active ? active.title : 'Geen programma';
  }

  function openAdsAudioDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('versuzAdsDB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function saveAdAudioToDB(id, dataUrl) {
    const db = await openAdsAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').put({ id, dataUrl });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAdAudioFromDB(id) {
    const db = await openAdsAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readonly');
      const req = tx.objectStore('audio').get(id);
      req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteAdAudioFromDB(id) {
    const db = await openAdsAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function resetDailyAdCounters(data) {
    const today = todayKey();
    let changed = false;
    data.adRules = data.adRules.map(ad => {
      ad = normalizeAdRule(ad);
      if (ad.lastPlayedDate && ad.lastPlayedDate !== today && ad.playsToday !== 0) {
        ad.playsToday = 0;
        changed = true;
      }
      return ad;
    });
    if (changed) saveAdRules(data);
  }

  function parseHour(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }

  function isAdAllowedAtThisHour(ad, now = new Date()) {
    const start = parseHour(ad.hourStart);
    const end = parseHour(ad.hourEnd);
    if (start === null || end === null) return true;
    const h = now.getHours();
    if (start === end) return true;
    if (start < end) return h >= start && h < end;
    return h >= start || h < end;
  }

  function isAdActiveNow(ad, now = new Date()) {
    ad = normalizeAdRule(ad);
    if (!ad.enabled) return false;
    if (ad.currentPlays >= ad.maxPlays) return false;
    if (ad.playsToday >= ad.maxPerDay) return false;
    if (!isAdAllowedAtThisHour(ad, now)) return false;
    return new Date(ad.startDateTime) <= now && new Date(ad.endDateTime) >= now;
  }

  function metadataMatches(ad, songText) {
    if (ad.triggerType === 'datetime') return true;
    if (ad.triggerType !== 'metadata') return true;
    const hay = String(songText || '').toLowerCase();
    if (!hay) return false;
    const trigger = String(ad.triggerValue || '').trim().toLowerCase();
    if (!trigger) return false;
    return hay.includes(trigger);
  }

  function parseAdCount(songText, data) {
    const hay = String(songText || '').toLowerCase();
    for (const [keyword, count] of Object.entries(data.metaKeywordQuotas || {})) {
      if (hay.includes(String(keyword).toLowerCase())) {
        const n = parseInt(count, 10);
        return Math.max(1, Math.min(10, Number.isNaN(n) ? 1 : n));
      }
    }
    const m = hay.match(/adcount\s*-\s*(\d+)/i);
    const n = m ? parseInt(m[1], 10) : 1;
    return Math.max(1, Math.min(10, Number.isNaN(n) ? 1 : n));
  }

  function chooseAdsForBreak(data, type, songText, desiredCount = 1) {
    resetDailyAdCounters(data);
    const now = new Date();
    let candidates = data.adRules.map(normalizeAdRule).filter(ad => {
      const typeOk = ad.type === type || ad.type === 'both';
      const triggerOk = type === 'midroll' ? metadataMatches(ad, songText) : true;
      return typeOk && triggerOk && isAdActiveNow(ad, now);
    });
    candidates.sort((a, b) => {
      const byToday = a.playsToday - b.playsToday;
      if (byToday !== 0) return byToday;
      const byTotal = a.currentPlays - b.currentPlays;
      if (byTotal !== 0) return byTotal;
      return String(a.lastPlayedAt || '').localeCompare(String(b.lastPlayedAt || ''));
    });
    const picked = [];
    const usedAdvertisers = new Set();
    for (const ad of candidates) {
      if (picked.find(x => x.id === ad.id)) continue;
      if (desiredCount > 1 && usedAdvertisers.has(ad.advertiser) && candidates.some(c => !usedAdvertisers.has(c.advertiser) && !picked.find(x => x.id === c.id))) continue;
      picked.push(ad);
      usedAdvertisers.add(ad.advertiser);
      if (picked.length >= desiredCount) break;
    }
    if (picked.length < desiredCount) {
      for (const ad of candidates) {
        if (!picked.find(x => x.id === ad.id)) picked.push(ad);
        if (picked.length >= desiredCount) break;
      }
    }
    return picked.slice(0, desiredCount);
  }

  function recordAdPlay(data, ad) {
    const today = todayKey();
    data.adRules = data.adRules.map(item => {
      item = normalizeAdRule(item);
      if (item.id === ad.id) {
        if (item.lastPlayedDate !== today) item.playsToday = 0;
        item.currentPlays += 1;
        item.playsToday += 1;
        item.lastPlayedDate = today;
        item.lastPlayedAt = new Date().toISOString();
      }
      return item;
    });
    saveAdRules(data);
  }

  async function resolveAdAudioSource(ad) {
    if (ad.audioMode === 'upload') return await getAdAudioFromDB(ad.id);
    return ad.audioUrl || '';
  }

  function metadataKeywordOptionsHtml(data, selectedValue = '') {
    const entries = Object.entries(data.metaKeywordQuotas || {});
    if (!entries.length) return '<option value="">Geen metadata keywords ingesteld</option>';
    return entries.map(([keyword, count]) => `<option value="${keyword}" ${String(selectedValue) === String(keyword) ? 'selected' : ''}>${keyword} (${count} spot${Number(count) === 1 ? '' : 's'})</option>`).join('');
  }

  window.VersuzShared = {
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    STORAGE,
    DEFAULT_WEEKLY_SCHEDULE,
    normalizeAdRule,
    loadAppData,
    saveWeeklySchedule,
    saveOverrides,
    saveNews,
    saveAdRules,
    saveMetaKeywordQuotas,
    saveStreamUrl,
    saveMetadataSource,
    saveManualMetadata,
    getScheduleForDate,
    getCurrentProgramTitle,
    readFileAsDataURL,
    saveAdAudioToDB,
    getAdAudioFromDB,
    deleteAdAudioFromDB,
    resetDailyAdCounters,
    parseAdCount,
    chooseAdsForBreak,
    recordAdPlay,
    resolveAdAudioSource,
    metadataKeywordOptionsHtml
  };
})();
