/* ============================================================================
 * reporter.js — ΛΕΒΙΑΘΑΝ live reporter (κοινός, εξωτερικός)
 * ----------------------------------------------------------------------------
 * Ένας πυρήνας για ΟΛΑ τα ζωντανά κανάλια ΕΚΤΟΣ από τα αποτελέσματα κουίζ
 * (το κουίζ έχει δικό του ενσωματωμένο μηχανισμό → /api/quiz-results).
 *
 * Χρήση: φόρτωσέ το ΜΙΑ φορά (same-origin) και κάλεσε μία γραμμή ανά ενέργεια:
 *
 *     LeviathanReporter.poll ({ code, optionId });
 *     LeviathanReporter.cloud({ code, text });
 *     LeviathanReporter.text ({ code, text });
 *
 * Ο κωδικός (code) είναι ο 4ψήφιος της δραστηριότητας (από QR/σύνδεσμο).
 * Ο reporter προσθέτει αυτόματα ανώνυμο σταθερό studentKey (για «μία ψήφος
 * ανά μαθητή» στο poll και για dedup), κρατά offline ουρά και ξαναπροσπαθεί.
 * ========================================================================== */
(function (global) {
  'use strict';

  var CFG = {
    base: '',
    endpoints: { poll: '/api/live-poll', cloud: '/api/live-cloud', text: '/api/live-text' },
    retry: { max: 5, baseDelay: 800, maxDelay: 15000 },
    queueKey: 'lev:reporter:queue',
    idKey: 'lev:reporter:sid',
    dedupMs: 500,
  };

  var flushTimer = null;
  var studentKey = null;
  var lastSig = {};

  function safeLS(fn, fb) { try { return fn(); } catch (e) { return fb; } }

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getStudentKey() {
    if (studentKey) return studentKey;
    studentKey = safeLS(function () { return localStorage.getItem(CFG.idKey); }, null);
    if (!studentKey) { studentKey = uid(); safeLS(function () { localStorage.setItem(CFG.idKey, studentKey); }); }
    return studentKey;
  }

  function loadQueue() { return safeLS(function () { var r = localStorage.getItem(CFG.queueKey); return r ? JSON.parse(r) : []; }, []); }
  function saveQueue(q) { safeLS(function () { localStorage.setItem(CFG.queueKey, JSON.stringify(q)); }); }
  function enqueue(it) { var q = loadQueue(); q.push(it); saveQueue(q); scheduleFlush(0); }

  function postItem(it) {
    return fetch(CFG.base + CFG.endpoints[it.channel], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(it.body),
      keepalive: true,
    }).then(function (r) { if (!r.ok && r.status >= 500) throw new Error('HTTP ' + r.status); return true; });
    // 4xx (π.χ. έληξε ο κωδικός): θεωρείται «οριστικό» → βγαίνει από την ουρά.
  }

  function scheduleFlush(delay) {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(0); }, delay);
  }

  function flush(attempt) {
    var q = loadQueue();
    if (!q.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    postItem(q[0]).then(function () {
      var rest = loadQueue(); rest.shift(); saveQueue(rest);
      if (rest.length) scheduleFlush(0);
    }).catch(function () {
      if (attempt + 1 >= CFG.retry.max) { var rest = loadQueue(); rest.shift(); saveQueue(rest); if (rest.length) scheduleFlush(0); return; }
      var d = Math.min(CFG.retry.baseDelay * Math.pow(2, attempt), CFG.retry.maxDelay);
      flushTimer = setTimeout(function () { flushTimer = null; flush(attempt + 1); }, d);
    });
  }

  function send(channel, code, payload) {
    if (!code) return false;
    var sig = channel + '|' + code + '|' + JSON.stringify(payload);
    var now = Date.now();
    if (lastSig[channel] && lastSig[channel].sig === sig && now - lastSig[channel].t < CFG.dedupMs) return false;
    lastSig[channel] = { sig: sig, t: now };

    var body = Object.assign({ code: String(code), studentKey: getStudentKey() }, payload);
    enqueue({ channel: channel, body: body });
    return true;
  }

  function nonEmpty(s) { return typeof s === 'string' && s.trim().length > 0; }

  var Reporter = {
    init: function (opts) {
      opts = opts || {};
      if (opts.base) CFG.base = opts.base;
      if (opts.endpoints) CFG.endpoints = Object.assign({}, CFG.endpoints, opts.endpoints);
      getStudentKey();
      scheduleFlush(0);
      return this;
    },
    studentKey: function () { return getStudentKey(); },

    /** Ψήφος σε live poll. */
    poll: function (p) { p = p || {}; if (!p.code || !p.optionId) return false; return send('poll', p.code, { optionId: p.optionId }); },

    /** Λέξη/φράση για νέφος λέξεων. */
    cloud: function (p) { p = p || {}; if (!p.code || !nonEmpty(p.text)) return false; return send('cloud', p.code, { text: p.text.trim() }); },

    /** Σύντομος γραπτός λόγος. */
    text: function (p) { p = p || {}; if (!p.code || !nonEmpty(p.text)) return false; return send('text', p.code, { text: p.text.trim() }); },

    flush: function () { scheduleFlush(0); return this; },
  };

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('online', function () { scheduleFlush(0); });
    global.addEventListener('pagehide', function () {
      var q = loadQueue();
      if (!q.length || !navigator.sendBeacon) return;
      q.forEach(function (it) {
        try {
          var blob = new Blob([JSON.stringify(it.body)], { type: 'application/json' });
          navigator.sendBeacon(CFG.base + CFG.endpoints[it.channel], blob);
        } catch (e) {}
      });
    });
  }

  global.LeviathanReporter = Reporter;
})(typeof window !== 'undefined' ? window : this);
