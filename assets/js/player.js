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
  const MONITOR_STORAGE_KEY = 'versuz_monitor_state';

  let mainAudio = new Audio();
  let adAudio = new Audio();
  let isPlaying = false;
  let prerollDone = false;
  let currentAdPlaying = false;
  let currentSong = '';
  let metadataHistory = [];
  let lastMidrollAt = 0;
  let lastTriggerAt = 0;
  let lastTriggerText = '';
  let lastBreakStartedAt = 0;
  let lastBreakSpotCount = 0;
  let currentBreakSpotCount = 0;
  let currentBreakTriggerText = '';
  let lastHandledFingerprint = '';
  let lastHandledAt = 0;
  let lastMonitorReason = 'init';
  let appliedStreamUrl = '';
  let pendingStreamReload = false;

  function setVolumeBoth() {
    const vol = Number(volumeSlider.value || 0.8);
    mainAudio.volume = vol;
    adAudio.volume = vol;
  }

  function pluralSpots(n) {
    return `${n} spot${Number(n) === 1 ? '' : 's'}`;
  }

  function clearMetadataHistory() {
    metadataHistory = [];
  }

  function getCooldownRemainingMs() {
    if (!lastMidrollAt) return 0;
    return Math.max(0, MIDROLL_COOLDOWN_MS - (Date.now() - lastMidrollAt));
  }

  function getPublicStatusText() {
    if (currentAdPlaying) return `reclame bezig (${pluralSpots(currentBreakSpotCount)})`;
    if (!isPlaying) return 'stream gepauzeerd';
    return 'stream actief';
  }

  function getInternalStatusText() {
    if (currentAdPlaying) return `ad-break (${pluralSpots(currentBreakSpotCount)})`;
    if (!isPlaying) return pendingStreamReload ? 'paused (config wacht)' : 'paused';
    const cooldownLeft = getCooldownRemainingMs();
    if (cooldownLeft > 0) return `cooldown ${Math.ceil(cooldownLeft / 1000)}s`;
    return pendingStreamReload ? 'playing (config wacht)' : 'playing';
  }

  function refreshPublicStatus() {
    adStatusMsg.innerHTML = getPublicStatusText();
  }

  function writeMonitorState(reason = '') {
    if (reason) lastMonitorReason = reason;
    try {
      localStorage.setItem(MONITOR_STORAGE_KEY, JSON.stringify({
        updatedAt: Date.now(),
        reason: lastMonitorReason,
        isPlaying,
        currentAdPlaying,
        metadataPollingActive: isPlaying && !currentAdPlaying,
        publicStatus: getPublicStatusText(),
        internalStatus: getInternalStatusText(),
        currentSong,
        visibleLiveTitle: liveSongTitle ? liveSongTitle.textContent : '',
        visibleNowPlaying: nowPlayingMeta ? nowPlayingMeta.textContent : '',
        cooldownRemainingMs: getCooldownRemainingMs(),
        historyLimit: HISTORY_LIMIT,
        metadataHistory: metadataHistory.map(item => ({
          text: item.text,
          normalized: item.normalized,
          timestamp: item.timestamp
        })),
        lastMidrollAt,
        lastTriggerAt,
        lastTriggerText,
        lastBreakStartedAt,
        lastBreakSpotCount,
        currentBreakSpotCount,
        currentBreakTriggerText,
        pendingStreamReload,
        appliedStreamUrl,
        configuredStreamUrl: data.streamUrl || ''
      }));
    } catch (e) {
      console.warn('Monitor state opslaan mislukt', e);
    }
  }

  function applyConfiguredStreamUrl(force = false) {
    const nextUrl = String(data.streamUrl || '').trim();
    if (!nextUrl) return;
    if (!force && appliedStreamUrl === nextUrl) return;

    const wasPlaying = isPlaying && !currentAdPlaying;
    mainAudio.pause();
    mainAudio.src = nextUrl;
    mainAudio.load();
    appliedStreamUrl = nextUrl;
    pendingStreamReload = false;

    if (wasPlaying) {
      mainAudio.play().catch(() => null);
    }

    writeMonitorState('stream-url-applied');
  }

  function playMain() {
    if (currentAdPlaying) return;
    if (!appliedStreamUrl) {
      applyConfiguredStreamUrl(true);
    }
    if (pendingStreamReload && !isPlaying) {
      applyConfiguredStreamUrl(true);
    }
    mainAudio.play().catch(() => null);
    isPlaying = true;
    playBtn.innerHTML = '⏸';
    refreshPublicStatus();
    writeMonitorState('stream-playing');
    fetchMetadata(true);
    evaluateMetadataHistoryForMidroll();
  }

  function pauseMain() {
    mainAudio.pause();
    isPlaying = false;
    playBtn.innerHTML = '▶';
    clearMetadataHistory();
    refreshPublicStatus();
    writeMonitorState('stream-paused');
  }

  async function playSingleAdSource(src) {
    return new Promise((resolve, reject) => {
      adAudio.pause();
      adAudio.src = src;
      adAudio.onended = () => {
        adAudio.onended = null;
        resolve(true);
      };
      adAudio.onerror = () => {
        adAudio.onerror = null;
        reject(new Error('ad audio error'));
      };
      adAudio.play().catch(reject);
    });
  }

  async function playAdBreakSequence(ads, afterDone) {
    if (!ads.length || currentAdPlaying) return false;

    currentAdPlaying = true;
    const wasPlaying = isPlaying;
    lastBreakStartedAt = Date.now();
    lastBreakSpotCount = ads.length;
    clearMetadataHistory();
    mainAudio.pause();
    refreshPublicStatus();
    writeMonitorState('ad-break-start');

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
    currentBreakSpotCount = 0;
    currentBreakTriggerText = '';

    if (wasPlaying) {
      playMain();
    } else {
      refreshPublicStatus();
      writeMonitorState('ad-break-finished-paused');
    }

    if (afterDone) afterDone();
    writeMonitorState('ad-break-end');
    return true;
  }

  function attemptPreroll() {
    data = Shared.loadAppData();
    const selected = Shared.chooseAdsForBreak(data, 'preroll', currentSong, 1);

    if (selected.length) {
      currentBreakSpotCount = selected.length;
      currentBreakTriggerText = 'preroll';
      playAdBreakSequence(selected, () => {
        prerollDone = true;
        refreshPublicStatus();
        writeMonitorState('preroll-finished');
      });
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
    if (currentAdPlaying || !isPlaying) {
      writeMonitorState('midroll-check-skipped-paused');
      return;
    }

    const triggeredItem = findTriggerInHistory();
    if (!triggeredItem) {
      writeMonitorState('midroll-check-no-trigger');
      return;
    }

    const cooldownLeft = getCooldownRemainingMs();
    if (cooldownLeft > 0) {
      metadataHistory = metadataHistory.filter(item => item.normalized !== triggeredItem.normalized);
      writeMonitorState('trigger-skipped-during-cooldown');
      return;
    }

    const fingerprint = triggeredItem.normalized;
    if (fingerprint && fingerprint === lastHandledFingerprint && (Date.now() - lastHandledAt) < 15000) {
      writeMonitorState('trigger-skipped-duplicate');
      return;
    }

    data = Shared.loadAppData();
    const desiredCount = Shared.parseAdCount(triggeredItem.text, data);
    const selected = Shared.chooseAdsForBreak(data, 'midroll', triggeredItem.text, desiredCount);

    if (!selected.length) {
      metadataHistory = metadataHistory.filter(item => item.normalized !== fingerprint);
      writeMonitorState('trigger-without-matching-ads');
      return;
    }

    lastHandledFingerprint = fingerprint;
    lastHandledAt = Date.now();
    lastMidrollAt = Date.now();
    lastTriggerAt = Date.now();
    lastTriggerText = triggeredItem.text;
    currentBreakSpotCount = selected.length;
    currentBreakTriggerText = triggeredItem.text;
    clearMetadataHistory();
    writeMonitorState('midroll-started');

    playAdBreakSequence(selected, () => {
      refreshPublicStatus();
      writeMonitorState('midroll-finished');
      fetchMetadata(true);
    });
  }

  async function fetchMetadata(force = false) {
    data = Shared.loadAppData();

    if (!force && (!isPlaying || currentAdPlaying)) {
      writeMonitorState('metadata-paused');
      return;
    }

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
      writeMonitorState('metadata-fetched');
      evaluateMetadataHistoryForMidroll();
    } else {
      liveSongTitle.innerHTML = 'Metadata niet beschikbaar';
      nowPlayingMeta.innerHTML = 'live metadata laden...';
      writeMonitorState('metadata-empty');
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
  refreshMetaBtn.addEventListener('click', () => fetchMetadata(true));
  scheduleDate.addEventListener('change', () => renderSchedule(scheduleDate.value));

  document.getElementById('sendContactBtn').addEventListener('click', () => {
    const naam = document.getElementById('contactNameInput').value.trim();
    const msg = document.getElementById('contactMsgInput').value.trim();
    contactFeedback.innerText = (naam && msg) ? `Bedankt ${naam}!` : 'Vul alles in';
  });

  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('newsModal').classList.remove('active');
  });

  window.addEventListener('storage', e => {
    data = Shared.loadAppData();

    if (!e || !e.key) {
      renderNews();
      renderSchedule(scheduleDate.value);
      updateCurrentProgram();
      writeMonitorState('storage-sync-generic');
      return;
    }

    if (e.key === Shared.STORAGE.metadataSource || e.key === Shared.STORAGE.manualMetadata || e.key === Shared.STORAGE.metaKeywordQuotas || e.key === Shared.STORAGE.adRules) {
      writeMonitorState('config-updated-without-stream-reload');
    }

    if (e.key === Shared.STORAGE.news) {
      renderNews();
    }

    if (e.key === Shared.STORAGE.weeklySchedule || e.key === Shared.STORAGE.overrides) {
      renderSchedule(scheduleDate.value);
      updateCurrentProgram();
    }

    if (e.key === Shared.STORAGE.streamUrl) {
      pendingStreamReload = true;
      writeMonitorState('stream-url-change-saved-for-next-restart');
    }
  });

  setVolumeBoth();
  applyConfiguredStreamUrl(true);
  scheduleDate.value = new Date().toISOString().slice(0, 10);
  renderSchedule(scheduleDate.value);
  renderNews();
  updateCurrentProgram();
  bindPanels();
  refreshPublicStatus();
  writeMonitorState('init-ready');

  setInterval(() => {
    refreshPublicStatus();
    writeMonitorState('heartbeat');
  }, 1000);

  setInterval(() => {
    fetchMetadata(false);
  }, 1000);

  setInterval(updateCurrentProgram, 60000);
});
