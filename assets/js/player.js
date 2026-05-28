document.addEventListener('DOMContentLoaded', () => {
  const Shared = window.VersuzShared;
  let data = Shared.loadAppData();

  const playBtn = document.getElementById('playPauseBtn');
  const volumeSlider = document.getElementById('volumeCtrl');
  const refreshMetaBtn = document.getElementById('refreshMetaBtn');
  const liveSongTitle = document.getElementById('liveSongTitle');
  const nowPlayingMeta = document.getElementById('nowPlayingMeta');
  const adStatusMsg = document.getElementById('adStatusMsg');
  const currentProgramName = document.getElementById('currentProgramName');
  const scheduleDate = document.getElementById('scheduleDate');
  const scheduleTableContainer = document.getElementById('scheduleTableContainer');
  const replacementBadge = document.getElementById('replacementBadge');
  const homeNewsPreview = document.getElementById('homeNewsPreview');
  const fullNewsList = document.getElementById('fullNewsList');
  const contactFeedback = document.getElementById('contactFeedback');

  const MIDROLL_COOLDOWN_MS = 180000;
  const HISTORY_LIMIT = 4;

  let mainAudio = new Audio();
  let adAudio = new Audio();
  let isPlaying = false;
  let prerollDone = false;
  let currentAdPlaying = false;
  let currentSong = '';
  let metadataHistory = [];
  let lastMidrollAt = 0;
  let pendingTriggerFingerprint = '';

  function setVolumeBoth() {
    const vol = Number(volumeSlider.value || 0.8);
    mainAudio.volume = vol;
    adAudio.volume = vol;
  }

  function updateStreamUrl() {
    mainAudio.pause();
    mainAudio.src = data.streamUrl;
    mainAudio.load();
    if (isPlaying && !currentAdPlaying) {
      mainAudio.play().catch(() => null);
    }
  }

  function playMain() {
    if (currentAdPlaying) return;
    mainAudio.play().catch(() => null);
    isPlaying = true;
    playBtn.innerHTML = '⏸';
    if (lastMidrollAt && (Date.now() - lastMidrollAt) < MIDROLL_COOLDOWN_MS) {
      const left = Math.ceil((MIDROLL_COOLDOWN_MS - (Date.now() - lastMidrollAt)) / 1000);
      adStatusMsg.innerHTML = `cooldown ${left}s`;
    } else {
      adStatusMsg.innerHTML = 'stream actief';
    }
    evaluateMetadataHistoryForMidroll();
  }

  function pauseMain() {
    mainAudio.pause();
    isPlaying = false;
    playBtn.innerHTML = '▶';
    adStatusMsg.innerHTML = 'stream gepauzeerd';
  }

  async function playSingleAdSource(src) {
    return new Promise((resolve, reject) => {
      adAudio.pause();
      adAudio.src = src;
      adAudio.onended = () => { adAudio.onended = null; resolve(true); };
      adAudio.onerror = () => { adAudio.onerror = null; reject(new Error('ad audio error')); };
      adAudio.play().catch(reject);
    });
  }

  async function playAdBreakSequence(ads, afterDone) {
    if (!ads.length || currentAdPlaying) return false;
    currentAdPlaying = true;
    const wasPlaying = isPlaying;
    mainAudio.pause();
    adStatusMsg.innerHTML = `reclame bezig (${ads.length} spot${ads.length === 1 ? '' : 's'})`;
    try {
      for (const ad of ads) {
        const src = await Shared.resolveAdAudioSource(ad);
        if (!src) continue;
        Shared.recordAdPlay(data, ad);
        await playSingleAdSource(src);
      }
    } catch (e) {
      console.warn('Advertentie afspelen mislukt', e);
    }
    currentAdPlaying = false;
    if (wasPlaying) playMain();
    else adStatusMsg.innerHTML = 'ads actief';
    if (afterDone) afterDone();
    return true;
  }

  function attemptPreroll() {
    data = Shared.loadAppData();
    const selected = Shared.chooseAdsForBreak(data, 'preroll', currentSong, 1);
    if (selected.length) {
      playAdBreakSequence(selected, () => { prerollDone = true; playMain(); });
      return true;
    }
    prerollDone = true;
    playMain();
    return false;
  }

  function addMetadataToHistory(songText) {
    const text = String(songText || '').trim();
    if (!text) return;
    const normalized = Shared.normalizeForMatch(text);
    const existingIndex = metadataHistory.findIndex(item => item.normalized === normalized);
    if (existingIndex !== -1) metadataHistory.splice(existingIndex, 1);
    metadataHistory.unshift({
      text,
      normalized,
      timestamp: Date.now()
    });
    metadataHistory = metadataHistory.slice(0, HISTORY_LIMIT);
  }

  function getCooldownRemainingMs() {
    if (!lastMidrollAt) return 0;
    return Math.max(0, MIDROLL_COOLDOWN_MS - (Date.now() - lastMidrollAt));
  }

  function findTriggerInHistory() {
    data = Shared.loadAppData();
    for (const item of metadataHistory) {
      if (Shared.hasMidrollTrigger(item.text, data)) {
        return item;
      }
    }
    return null;
  }

  function evaluateMetadataHistoryForMidroll() {
    if (currentAdPlaying || !isPlaying) return;

    const cooldownLeft = getCooldownRemainingMs();
    if (cooldownLeft > 0) {
      adStatusMsg.innerHTML = `cooldown ${Math.ceil(cooldownLeft / 1000)}s`;
      return;
    }

    const triggeredItem = findTriggerInHistory();
    if (!triggeredItem) return;

    const fingerprint = triggeredItem.normalized;
    if (fingerprint && fingerprint === pendingTriggerFingerprint) return;

    data = Shared.loadAppData();
    const desiredCount = Shared.parseAdCount(triggeredItem.text, data);
    const selected = Shared.chooseAdsForBreak(data, 'midroll', triggeredItem.text, desiredCount);
    if (!selected.length) return;

    pendingTriggerFingerprint = fingerprint;
    lastMidrollAt = Date.now();
    playAdBreakSequence(selected, () => {
      metadataHistory = metadataHistory.filter(item => item.normalized !== fingerprint);
      pendingTriggerFingerprint = '';
      adStatusMsg.innerHTML = 'ads actief';
    });
  }

  async function fetchMetadata() {
    data = Shared.loadAppData();
    let song = '';
    try {
      const res = await fetch((data.metadataSource.baseUrl || '/api/metadata') + '?_ts=' + Date.now(), { cache: 'no-store' });
      if (res.ok) song = (await res.text()).trim();
    } catch (e) {
      console.warn('Metadata ophalen mislukt', e);
    }

    if (!song && data.manualMetadata) song = data.manualMetadata;

    if (song) {
      liveSongTitle.innerHTML = song;
      nowPlayingMeta.innerHTML = song.substring(0, 60);
      addMetadataToHistory(song);
      if (song !== currentSong) currentSong = song;
      evaluateMetadataHistoryForMidroll();
    } else {
      liveSongTitle.innerHTML = 'Metadata niet beschikbaar';
      nowPlayingMeta.innerHTML = 'live metadata laden...';
      evaluateMetadataHistoryForMidroll();
    }
  }

  function renderSchedule(dateStr) {
    const info = Shared.getScheduleForDate(data, dateStr);
    const rows = info.slots.map(s => `<tr><td>${s.time}</td><td><strong>${s.title}</strong></td><td>${s.desc || ''}</td></tr>`).join('');
    scheduleTableContainer.innerHTML = `<table><thead><tr><th>Tijd</th><th>Programma</th><th>Info</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Geen programma</td></tr>'}</tbody></table>`;
    replacementBadge.innerHTML = info.overrides.length ? `${info.overrides.length} vervangingen` : '';
  }

  function renderNews() {
    const list = (data.news || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    homeNewsPreview.innerHTML = list.slice(0, 3).map(n => `<div class="news-card" data-id="${n.id}"><h4>${n.title}</h4><p>${n.content.substring(0, 70)}...</p></div>`).join('');
    fullNewsList.innerHTML = list.map(n => `<div class="news-card" data-id="${n.id}"><h4>${n.title}</h4><p>${n.content.substring(0, 100)}...</p><small>${n.date}</small></div>`).join('');

    document.querySelectorAll('.news-card').forEach(card => card.addEventListener('click', () => {
      const article = list.find(n => n.id === card.dataset.id);
      if (!article) return;
      document.getElementById('modalTitle').innerText = article.title;
      document.getElementById('modalContent').innerText = article.content;
      document.getElementById('modalDate').innerText = article.date;
      document.getElementById('modalImage').innerHTML = article.imageData ? `<img src="${article.imageData}" class="news-img">` : '';
      document.getElementById('newsModal').classList.add('active');
    }));
  }

  function updateCurrentProgram() {
    currentProgramName.innerHTML = Shared.getCurrentProgramTitle(data);
  }

  function bindPanels() {
    document.querySelectorAll('.nav-btn[data-panel]').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn[data-panel]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-panel'));
      document.getElementById(btn.dataset.panel + 'Panel').classList.add('active-panel');
      if (btn.dataset.panel === 'programs') renderSchedule(scheduleDate.value);
      if (btn.dataset.panel === 'news') renderNews();
    }));
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) pauseMain();
    else if (!prerollDone) attemptPreroll();
    else playMain();
  });
  volumeSlider.addEventListener('input', setVolumeBoth);
  refreshMetaBtn.addEventListener('click', fetchMetadata);
  scheduleDate.addEventListener('change', () => renderSchedule(scheduleDate.value));
  document.getElementById('sendContactBtn').addEventListener('click', () => {
    const naam = document.getElementById('contactNameInput').value.trim();
    const msg = document.getElementById('contactMsgInput').value.trim();
    contactFeedback.innerText = (naam && msg) ? `Bedankt ${naam}!` : 'Vul alles in';
  });
  document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('newsModal').classList.remove('active'));
  window.addEventListener('storage', () => {
    data = Shared.loadAppData();
    updateStreamUrl();
    renderNews();
    renderSchedule(scheduleDate.value);
    updateCurrentProgram();
  });

  setVolumeBoth();
  updateStreamUrl();
  scheduleDate.value = new Date().toISOString().slice(0, 10);
  renderSchedule(scheduleDate.value);
  renderNews();
  updateCurrentProgram();
  bindPanels();
  fetchMetadata();
  setInterval(fetchMetadata, 1000);
  setInterval(updateCurrentProgram, 60000);
});
