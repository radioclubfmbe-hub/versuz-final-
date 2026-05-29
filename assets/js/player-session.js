document.addEventListener('DOMContentLoaded', () => {
  const Api = window.GitHubSessionStore;
  if (!Api) return;

  const mainAudio = document.getElementById('mainAudioEl');
  const adAudio = document.getElementById('adAudioEl');
  const playBtn = document.getElementById('playPauseBtn');
  const adStatusMsg = document.getElementById('adStatusMsg');

  if (!mainAudio || !playBtn) return;

  const sessionId = sessionStorage.getItem('versuz_session_id') || (crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  sessionStorage.setItem('versuz_session_id', sessionId);

  let heartbeatTimer = null;
  let sessionActive = false;
  let pendingRegister = false;

  function currentInfo() {
    return {
      ua: navigator.userAgent,
      page: location.href,
      label: 'radio-player'
    };
  }

  function isAnyAudioActive() {
    const mainActive = mainAudio && !mainAudio.paused && !mainAudio.ended;
    const adActive = adAudio && !adAudio.paused && !adAudio.ended;
    return !!(mainActive || adActive);
  }

  function setStatus(text) {
    if (adStatusMsg) adStatusMsg.innerHTML = text;
  }

  async function ensureSessionActive() {
    if (pendingRegister) return;
    pendingRegister = true;
    try {
      const result = await Api.registerSession(sessionId, currentInfo());
      sessionActive = true;
      setStatus(`stream actief • ${result.sessions.length}/5 sessies`);
    } catch (e) {
      if (String(e.message || '').includes('Maximum 5 actieve sessies bereikt')) {
        if (mainAudio) mainAudio.pause();
        if (adAudio) adAudio.pause();
        setStatus('maximum 5 luisteraars bereikt');
      } else {
        setStatus('GitHub sessielog mislukt');
      }
    } finally {
      pendingRegister = false;
    }
  }

  async function sendHeartbeat() {
    if (!sessionActive) return;
    try {
      const result = await Api.heartbeatSession(sessionId, currentInfo());
      setStatus(`stream actief • ${result.sessions.length}/5 sessies`);
    } catch (e) {
      console.warn('Heartbeat mislukt', e);
    }
  }

  async function stopOwnSession() {
    if (!sessionActive) return;
    try {
      const result = await Api.stopSession(sessionId);
      setStatus(`stream gepauzeerd • ${result.sessions.length}/5 sessies`);
    } catch (e) {
      console.warn('Sessie stoppen mislukt', e);
      setStatus('stream gepauzeerd');
    } finally {
      sessionActive = false;
    }
  }

  function startHeartbeatLoop() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      if (isAnyAudioActive()) {
        if (!sessionActive) ensureSessionActive();
        else sendHeartbeat();
      }
    }, 10000);
  }

  function stopHeartbeatLoop() {
    if (!heartbeatTimer) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  mainAudio.addEventListener('play', () => {
    ensureSessionActive();
    startHeartbeatLoop();
  });

  if (adAudio) {
    adAudio.addEventListener('play', () => {
      if (sessionActive) startHeartbeatLoop();
    });
  }

  playBtn.addEventListener('click', () => {
    const wasActive = sessionActive;

    setTimeout(() => {
      if (isAnyAudioActive()) {
        ensureSessionActive();
        startHeartbeatLoop();
        return;
      }

      if (wasActive) {
        stopOwnSession();
        stopHeartbeatLoop();
      }
    }, 900);
  });

  window.addEventListener('pagehide', () => {
    stopOwnSession();
    stopHeartbeatLoop();
  });

  window.addEventListener('beforeunload', () => {
    stopOwnSession();
    stopHeartbeatLoop();
  });

  setInterval(async () => {
    try {
      const result = await Api.listSessions();
      if (sessionActive && adStatusMsg && isAnyAudioActive()) {
        setStatus(`stream actief • ${result.sessions.length}/5 sessies`);
      }
    } catch (e) {}
  }, 15000);
});
