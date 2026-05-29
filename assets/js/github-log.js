(function () {
  const STORAGE = {
    token: 'gh_pat_personal',
    owner: 'gh_repo_owner',
    repo: 'gh_repo_name',
    branch: 'gh_repo_branch',
    filePath: 'gh_repo_file_path'
  };

  function getConfig() {
    return {
      token: localStorage.getItem(STORAGE.token) || '',
      owner: localStorage.getItem(STORAGE.owner) || '',
      repo: localStorage.getItem(STORAGE.repo) || '',
      branch: localStorage.getItem(STORAGE.branch) || 'main',
      filePath: localStorage.getItem(STORAGE.filePath) || 'data/sessions.json'
    };
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE.token, (cfg.token || '').trim());
    localStorage.setItem(STORAGE.owner, (cfg.owner || '').trim());
    localStorage.setItem(STORAGE.repo, (cfg.repo || '').trim());
    localStorage.setItem(STORAGE.branch, (cfg.branch || 'main').trim());
    localStorage.setItem(STORAGE.filePath, (cfg.filePath || 'data/sessions.json').trim());
    return getConfig();
  }

  function clearToken() {
    localStorage.removeItem(STORAGE.token);
  }

  function toBase64Unicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64Unicode(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  async function githubRequest(url, options = {}) {
    const cfg = getConfig();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      throw new Error('GitHub instellingen zijn niet volledig ingevuld.');
    }

    const headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${cfg.token}`
    }, options.headers || {});

    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub fout ${res.status}: ${txt}`);
    }

    return res.json();
  }

  function makeContentUrl() {
    const cfg = getConfig();
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.filePath}?ref=${encodeURIComponent(cfg.branch)}`;
  }

  function makeWriteUrl() {
    const cfg = getConfig();
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.filePath}`;
  }

  async function getSessionsFile() {
    const url = makeContentUrl();
    try {
      const data = await githubRequest(url);
      const content = JSON.parse(fromBase64Unicode((data.content || '').replace(/\n/g, '')) || '{"sessions":[]}');
      return {
        sha: data.sha,
        content: {
          updatedAt: content.updatedAt || new Date().toISOString(),
          sessions: Array.isArray(content.sessions) ? content.sessions : []
        }
      };
    } catch (e) {
      if (String(e.message || '').includes('404')) {
        return {
          sha: null,
          content: { updatedAt: new Date().toISOString(), sessions: [] }
        };
      }
      throw e;
    }
  }

  async function saveSessionsFile(content, sha) {
    const cfg = getConfig();
    const body = {
      message: `update sessions ${new Date().toISOString()}`,
      content: toBase64Unicode(JSON.stringify(content, null, 2)),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;

    return githubRequest(makeWriteUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function cleanSessions(sessions, ttlMs = 30000) {
    const now = Date.now();
    return (Array.isArray(sessions) ? sessions : []).filter(s => {
      return s && s.id && typeof s.lastSeen === 'number' && (now - s.lastSeen) < ttlMs;
    });
  }

  async function updateSessions(mutator, attempts = 2) {
    let lastError = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const current = await getSessionsFile();
        const nextContent = await mutator({
          sha: current.sha,
          content: {
            updatedAt: current.content.updatedAt,
            sessions: cleanSessions(current.content.sessions)
          }
        });
        await saveSessionsFile(nextContent, current.sha);
        return nextContent;
      } catch (e) {
        lastError = e;
        await new Promise(r => setTimeout(r, 500 + (i * 400)));
      }
    }
    throw lastError || new Error('Opslaan mislukt.');
  }

  async function registerSession(sessionId, info = {}) {
    return updateSessions(({ content }) => {
      const now = Date.now();
      let sessions = cleanSessions(content.sessions);
      const existing = sessions.find(s => s.id === sessionId);

      if (!existing && sessions.length >= 5) {
        throw new Error('Maximum 5 actieve sessies bereikt.');
      }

      if (existing) {
        existing.lastSeen = now;
        existing.status = 'active';
        existing.ua = info.ua || existing.ua || '';
        existing.page = info.page || existing.page || '';
      } else {
        sessions.push({
          id: sessionId,
          status: 'active',
          startedAt: now,
          lastSeen: now,
          ua: info.ua || '',
          page: info.page || '',
          label: info.label || 'player'
        });
      }

      return {
        updatedAt: new Date().toISOString(),
        sessions
      };
    });
  }

  async function heartbeatSession(sessionId, info = {}) {
    return updateSessions(({ content }) => {
      const now = Date.now();
      let sessions = cleanSessions(content.sessions);
      const existing = sessions.find(s => s.id === sessionId);
      if (existing) {
        existing.lastSeen = now;
        existing.status = 'active';
        existing.ua = info.ua || existing.ua || '';
        existing.page = info.page || existing.page || '';
      }
      return {
        updatedAt: new Date().toISOString(),
        sessions
      };
    });
  }

  async function stopSession(sessionId) {
    return updateSessions(({ content }) => {
      const sessions = cleanSessions(content.sessions).filter(s => s.id !== sessionId);
      return {
        updatedAt: new Date().toISOString(),
        sessions
      };
    });
  }

  async function listSessions() {
    const current = await getSessionsFile();
    return {
      updatedAt: current.content.updatedAt,
      sessions: cleanSessions(current.content.sessions)
    };
  }

  async function clearAllSessions() {
    return updateSessions(() => ({
      updatedAt: new Date().toISOString(),
      sessions: []
    }));
  }

  window.GitHubSessionStore = {
    STORAGE,
    getConfig,
    saveConfig,
    clearToken,
    getSessionsFile,
    saveSessionsFile,
    registerSession,
    heartbeatSession,
    stopSession,
    listSessions,
    clearAllSessions,
    cleanSessions
  };
})();
