/* =============================================================================
   github.js — the data layer.
   Reads and writes /data/*.json in this repo through the GitHub Contents API.

   Three modes, decided at load time:
     live      token + repo work  -> read and write against GitHub
     readonly  no token, but the JSON files are fetchable -> read only
     demo      nothing fetchable  -> bundled seed data, edits kept in this
               browser only (this is what the shared preview link runs on)

   The token lives in localStorage and nowhere else. It is never written into
   any file in the repo.
   ============================================================================= */
(function (root) {
  'use strict';

  var CFG_KEY = 'carhisaab.config.v1';
  var DEMO_KEY = 'carhisaab.demo.v1';
  var FILES = ['cars', 'payouts', 'capital', 'settings'];

  var config = {
    owner: '', repo: '', branch: 'main', dataPath: 'data', token: ''
  };
  var mode = 'demo';
  var shas = {};          // filename -> blob sha, refreshed on every read/write
  var baselines = {};     // filename -> the exact text we last read or wrote
  var cache = {};         // filename -> parsed JSON
  var listeners = [];

  /* ---------- storage (never assume localStorage works) ------------------- */

  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function lsDel(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function loadConfig() {
    var raw = lsGet(CFG_KEY);
    if (!raw) return;
    try {
      var saved = JSON.parse(raw);
      Object.keys(config).forEach(function (k) {
        if (typeof saved[k] === 'string') config[k] = saved[k];
      });
    } catch (e) { /* corrupt config is the same as no config */ }
  }

  function saveConfig(next) {
    Object.keys(config).forEach(function (k) {
      if (next && typeof next[k] === 'string') config[k] = next[k].trim();
    });
    if (!config.branch) config.branch = 'main';
    if (!config.dataPath) config.dataPath = 'data';
    config.dataPath = config.dataPath.replace(/^\/+|\/+$/g, '');
    lsSet(CFG_KEY, JSON.stringify(config));
    return config;
  }

  function disconnect() {
    config.token = '';
    lsSet(CFG_KEY, JSON.stringify(config));
  }

  function forget() {
    lsDel(CFG_KEY);
    config = { owner: '', repo: '', branch: 'main', dataPath: 'data', token: '' };
  }

  function isConnected() {
    return !!(config.token && config.owner && config.repo);
  }

  /* ---------- base64 that survives non-ASCII notes ------------------------ */

  function encodeB64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function decodeB64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- api --------------------------------------------------------- */

  function pathFor(file) {
    return (config.dataPath ? config.dataPath + '/' : '') + file + '.json';
  }

  function contentsUrl(file) {
    return 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
      encodeURIComponent(config.repo) + '/contents/' + pathFor(file);
  }

  function apiHeaders() {
    return {
      'Authorization': 'Bearer ' + config.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  // fetch() rejects with a bare "Failed to fetch" for every network-level failure,
  // which tells the person nothing. Work out the actual reason and say it.
  function networkHint() {
    if (location.protocol === 'file:') {
      return 'Cannot reach GitHub because this page was opened straight from a file on ' +
        'your computer. Browsers block requests to github.com from file:// pages. Open the ' +
        'app from its GitHub Pages address (Settings \u2192 Pages in the repository) and ' +
        'connect the token there.';
    }
    var embedded = false;
    try { embedded = window.top !== window.self; } catch (e) { embedded = true; }
    if (embedded) {
      return 'Cannot reach GitHub from this preview. The preview runs in a sandbox that ' +
        'blocks outside requests, so it can only ever show sample data. To use real data, ' +
        'open the app from your GitHub Pages address and connect the token there.';
    }
    return 'Could not reach GitHub. Check your internet connection, and whether an ad ' +
      'blocker, firewall or VPN is blocking api.github.com.';
  }

  async function netFetch(url, options) {
    try {
      return await fetch(url, options);
    } catch (e) {
      var err = new Error(networkHint());
      err.code = 'network';
      throw err;
    }
  }

  function httpError(res, body) {
    var msg = (body && body.message) || res.statusText || ('HTTP ' + res.status);
    if (res.status === 401) msg = 'Token rejected (401). It may be expired, or pasted incomplete.';
    if (res.status === 403) msg = 'Forbidden (403). The token needs Contents: Read and write on this repo.';
    if (res.status === 404) msg = 'Not found (404). Check the owner, repo name and branch.';
    var err = new Error(msg);
    err.status = res.status;
    return err;
  }

  async function apiGet(file) {
    var url = contentsUrl(file) + '?ref=' + encodeURIComponent(config.branch) +
      '&t=' + encodeURIComponent(String(new Date().getTime()));
    var res = await netFetch(url, { headers: apiHeaders(), cache: 'no-store' });
    if (res.status === 404) return null;              // file not created yet
    var body = await res.json().catch(function () { return null; });
    if (!res.ok) throw httpError(res, body);
    return { sha: body.sha, text: decodeB64(body.content || '') };
  }

  async function apiPut(file, text, message, sha) {
    var payload = {
      message: message,
      content: encodeB64(text),
      branch: config.branch
    };
    if (sha) payload.sha = sha;
    var res = await netFetch(contentsUrl(file), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, apiHeaders()),
      body: JSON.stringify(payload)
    });
    var body = await res.json().catch(function () { return null; });
    if (!res.ok) throw httpError(res, body);
    return body && body.content ? body.content.sha : null;
  }

  async function testConnection(candidate) {
    var previous = JSON.parse(JSON.stringify(config));
    try {
      saveConfig(candidate);
      var res = await netFetch(
        'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
        encodeURIComponent(config.repo),
        { headers: apiHeaders(), cache: 'no-store' }
      );
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw httpError(res, body);
      var branchRes = await netFetch(
        'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' +
        encodeURIComponent(config.repo) + '/branches/' + encodeURIComponent(config.branch),
        { headers: apiHeaders(), cache: 'no-store' }
      );
      if (!branchRes.ok) {
        throw new Error('Repo found, but branch "' + config.branch + '" does not exist. ' +
          'Default branch is "' + (body && body.default_branch) + '".');
      }
      if (body && body.permissions && body.permissions.push === false) {
        throw new Error('Token can read this repo but not write to it. Give it Contents: Read and write.');
      }
      return { ok: true, repo: body && body.full_name, private: body && body.private };
    } catch (err) {
      config = previous;
      lsSet(CFG_KEY, JSON.stringify(config));
      throw err;
    }
  }

  /* ---------- demo persistence (the shared preview link) ------------------ */

  function demoRead() {
    var raw = lsGet(DEMO_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function demoWrite(all) {
    return lsSet(DEMO_KEY, JSON.stringify(all));
  }

  function resetDemo() {
    lsDel(DEMO_KEY);
  }

  function seedFor(file) {
    var seed = root.SEED_DATA || {};
    var value = seed[file];
    return value === undefined ? (file === 'settings' ? {} : []) : JSON.parse(JSON.stringify(value));
  }

  /* ---------- load -------------------------------------------------------- */

  // Relative fetch: works on GitHub Pages and any local web server, and is the
  // read path for a public repo with no token connected.
  async function fetchLocal(file) {
    try {
      var res = await fetch(pathFor(file) + '?t=' + new Date().getTime(), { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;                                     // file:// or offline
    }
  }

  async function load() {
    shas = {};
    var warnings = [];

    if (isConnected()) {
      try {
        var missing = [];
        for (var i = 0; i < FILES.length; i++) {
          var file = FILES[i];
          var got = await apiGet(file);
          if (got === null) {
            cache[file] = seedFor(file);
            missing.push(file + '.json');
          } else {
            shas[file] = got.sha;
            baselines[file] = got.text;
            try {
              cache[file] = JSON.parse(got.text);
            } catch (e) {
              throw new Error(pathFor(file) + ' is not valid JSON. Fix it on GitHub, then reload.');
            }
          }
        }
        mode = 'live';
        if (missing.length) {
          warnings.push(missing.join(', ') + ' not in the repo yet — starter data is loaded. ' +
            'Your next save will create ' + (missing.length > 1 ? 'them' : 'it') + '.');
        }
        return { mode: mode, data: snapshot(), warnings: warnings };
      } catch (err) {
        warnings.push('GitHub read failed: ' + err.message + ' Falling back to read-only.');
      }
    }

    var local = {};
    var haveAll = true;
    for (var j = 0; j < FILES.length; j++) {
      var f = FILES[j];
      var value = await fetchLocal(f);
      if (value === null) { haveAll = false; break; }
      local[f] = value;
    }

    if (haveAll) {
      cache = local;
      mode = 'readonly';
      return { mode: mode, data: snapshot(), warnings: warnings };
    }

    var stored = demoRead();
    FILES.forEach(function (file) {
      cache[file] = (stored && stored[file] !== undefined)
        ? JSON.parse(JSON.stringify(stored[file]))
        : seedFor(file);
    });
    mode = 'demo';
    return { mode: mode, data: snapshot(), warnings: warnings };
  }

  function snapshot() {
    return {
      cars: cache.cars || [],
      payouts: cache.payouts || [],
      capital: cache.capital || [],
      settings: cache.settings || {}
    };
  }

  /* ---------- save -------------------------------------------------------- */

  function canWrite() {
    return mode === 'live' || mode === 'demo';
  }

  // GET for the current sha, PUT with it. On a 409/422 conflict, re-read once
  // and retry — then surface a real error rather than silently losing an edit.
  async function save(file, value, message, opts) {
    var force = !!(opts && opts.force);
    cache[file] = value;
    emit('saving', { file: file });

    if (mode === 'demo') {
      baselines[file] = JSON.stringify(value);
      var ok = demoWrite(snapshot());
      emit(ok ? 'saved' : 'error', {
        file: file,
        message: ok
          ? 'Saved in this browser (preview mode)'
          : 'Could not save — this browser is blocking local storage.'
      });
      if (!ok) throw new Error('Local storage is blocked in this browser.');
      return { mode: 'demo' };
    }

    if (mode !== 'live') {
      var err = new Error('Read-only. Connect a GitHub token in Settings to make changes.');
      emit('error', { file: file, message: err.message });
      throw err;
    }

    var text = JSON.stringify(value, null, 2) + '\n';
    var commitMessage = message || ('Update ' + file + '.json');

    try {
      var newSha = await apiPut(file, text, commitMessage, shas[file]);
      if (newSha) shas[file] = newSha;
      baselines[file] = text;
      emit('saved', { file: file, message: 'Saved to GitHub' });
      return { mode: 'live', sha: newSha };
    } catch (err) {
      if (err.status === 409 || err.status === 422) {
        // A stale sha has two very different causes, and they must not be treated
        // the same. Re-read and compare against the text we last held:
        //   · identical  -> nothing really changed, our sha just drifted. Safe to retry.
        //   · different  -> somebody edited the file (on github.com, another device,
        //                   another tab) since we loaded it. Retrying here would
        //                   overwrite their work with our stale copy and destroy it
        //                   silently, so refuse and hand the decision to the user.
        var fresh;
        try {
          fresh = await apiGet(file);
        } catch (readErr) {
          emit('error', { file: file, message: 'Conflict on ' + pathFor(file) + ': ' + readErr.message });
          throw readErr;
        }
        shas[file] = fresh ? fresh.sha : undefined;

        var remoteChanged = fresh && baselines[file] !== undefined &&
          normalise(fresh.text) !== normalise(baselines[file]);

        if (remoteChanged && !force) {
          var conflict = new Error(
            pathFor(file) + ' was changed on GitHub after you loaded it. ' +
            'Your change has NOT been saved — saving it now would erase that other edit.');
          conflict.code = 'remote-changed';
          conflict.file = file;
          conflict.remoteText = fresh.text;
          emit('error', { file: file, message: conflict.message });
          throw conflict;
        }

        try {
          var retrySha = await apiPut(file, text,
            commitMessage + (remoteChanged ? ' (overwrote a newer version on request)' : ' (retry)'),
            shas[file]);
          if (retrySha) shas[file] = retrySha;
          baselines[file] = text;
          emit('saved', {
            file: file,
            message: remoteChanged ? 'Saved — replaced the newer version on GitHub'
                                   : 'Saved to GitHub (sha had drifted, retried)'
          });
          return { mode: 'live', sha: retrySha, retried: true, overwrote: remoteChanged };
        } catch (retryErr) {
          emit('error', { file: file, message: 'Conflict on ' + pathFor(file) + ': ' + retryErr.message });
          throw retryErr;
        }
      }
      emit('error', { file: file, message: err.message });
      throw err;
    }
  }

  // Whitespace and key order are not meaningful differences in these files.
  function normalise(text) {
    try { return JSON.stringify(JSON.parse(text)); } catch (e) { return String(text).trim(); }
  }

  /* ---------- events ------------------------------------------------------ */

  function on(fn) { listeners.push(fn); }
  function emit(type, detail) {
    listeners.forEach(function (fn) {
      try { fn(type, detail || {}); } catch (e) { /* a bad listener must not break a save */ }
    });
  }

  loadConfig();

  root.Store = {
    FILES: FILES,
    get config() { return JSON.parse(JSON.stringify(config)); },
    get mode() { return mode; },
    get data() { return snapshot(); },
    pathFor: pathFor,
    networkHint: networkHint,
    canReachGitHub: function () {
      if (location.protocol === 'file:') return false;
      try { return window.top === window.self; } catch (e) { return false; }
    },
    isConnected: isConnected,
    canWrite: canWrite,
    saveConfig: saveConfig,
    disconnect: disconnect,
    forget: forget,
    testConnection: testConnection,
    load: load,
    save: save,
    resetDemo: resetDemo,
    on: on
  };
}(window));
