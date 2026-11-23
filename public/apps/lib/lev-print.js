/* ═══════════════════════════════════════════════════════════════════
   ΛΕΒΙΑΘΑΝ — Εκτύπωση φύλλων εργασίας σε iPhone/iPad (λειτουργία εφαρμογής)
   ───────────────────────────────────────────────────────────────────
   Όταν ο ΛΕΒΙΑΘΑΝ ανοίγει από το εικονίδιο της αρχικής οθόνης (web app),
   το iOS αγνοεί το window.print() και δείχνει τη σελίδα «blob:» του φύλλου
   χωρίς Κοινοποίηση/Εκτύπωση. Εδώ, ΜΟΝΟ σε αυτή την περίπτωση:
   το φύλλο εργασίας γίνεται PDF (σελίδες A4, καμία ερώτηση .pq δεν κόβεται)
   και ανοίγει το φύλλο Κοινοποίησης του iOS → «Εκτύπωση».
   Σε υπολογιστή και σε κανονικό Safari δεν αλλάζει τίποτα.
   Δοκιμή σε υπολογιστή: προσθέστε ?levpdf=1 στη διεύθυνση της εφαρμογής.
   Χρησιμοποιεί το html2pdf.bundle.min.js (MIT) του ίδιου φακέλου.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function isStandalone(w) {
    try {
      if (w.navigator.standalone === true) return true;
      if (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) {}
    return false;
  }
  var standalone = isStandalone(window);
  try { if (!standalone && window.top && window.top !== window) standalone = isStandalone(window.top); } catch (e) {}
  var force = /[?&#]levpdf=1\b/.test(location.href);
  if (!force && !(ios && standalone)) return;

  var cur = document.currentScript && document.currentScript.src;
  var LIB = (cur ? cur.replace(/[^\/]*$/, '') : '/apps/lib/') + 'html2pdf.bundle.min.js';

  // ── Κρατάμε το HTML των φύλλων: new Blob([html], {type:'text/html'}) → URL.createObjectURL ──
  var OrigBlob = window.Blob, htmlOf = {};
  function LevBlob(parts, opts) {
    var b = new OrigBlob(parts, opts);
    try {
      if (opts && /text\/html/i.test(opts.type || '') && parts && parts.length &&
          Array.prototype.every.call(parts, function (p) { return typeof p === 'string'; })) {
        b.__levHtml = Array.prototype.join.call(parts, '');
      }
    } catch (e) {}
    return b;
  }
  LevBlob.prototype = OrigBlob.prototype;
  window.Blob = LevBlob;
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var u = origCreate(obj);
    if (obj && obj.__levHtml) htmlOf[u] = obj.__levHtml;
    return u;
  };
  var origOpen = window.open;
  window.open = function (url) {
    if (typeof url === 'string' && htmlOf[url]) { makePdf(htmlOf[url]); return null; }
    return origOpen.apply(window, arguments);
  };

  // ── Μικρά μηνύματα / κουμπί «Έτοιμο» (όπως στον ΛΕΒΙΑΘΑΝ) ──
  var toastEl = null, btnEl = null;
  var BASE_CSS = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(28px + env(safe-area-inset-bottom));z-index:2147483647;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);';
  function hide() {
    if (toastEl) { try { toastEl.remove(); } catch (e) {} toastEl = null; }
    if (btnEl) { try { btnEl.remove(); } catch (e) {} btnEl = null; }
  }
  function toast(text, ms) {
    hide();
    toastEl = document.createElement('div');
    toastEl.textContent = text;
    toastEl.style.cssText = BASE_CSS + 'background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;white-space:nowrap;';
    document.body.appendChild(toastEl);
    if (ms) { var t = toastEl; setTimeout(function () { if (toastEl === t) hide(); }, ms); }
  }
  function readyButton(file) {
    hide();
    btnEl = document.createElement('button');
    btnEl.type = 'button';
    btnEl.textContent = '🖨️ Έτοιμο — πάτησε για εκτύπωση';
    btnEl.style.cssText = BASE_CSS + 'background:#16a34a;color:#fff;padding:14px 22px;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;';
    btnEl.onclick = function () { hide(); share(file, true); };
    document.body.appendChild(btnEl);
    var b = btnEl; setTimeout(function () { if (btnEl === b) hide(); }, 60000);
  }
  function share(file, fromButton) {
    var can = false;
    try { can = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
    if (!can || !navigator.share) {
      // Χωρίς κοινοποίηση αρχείων: απλό άνοιγμα του PDF
      var u = origCreate(file); try { location.href = u; } catch (e) {}
      return;
    }
    navigator.share({ files: [file], title: file.name }).catch(function (e) {
      if (e && e.name === 'AbortError') return;          // έκλεισε το φύλλο — εντάξει
      if (!fromButton) readyButton(file);                 // χάθηκε το «πάτημα» όσο ετοιμαζόταν το PDF
      else toast('Δεν άνοιξε η Κοινοποίηση — δοκιμάστε ξανά.', 4000);
    });
  }

  // ── Περιθώρια από το @page του φύλλου (cm/mm/in) → mm ──
  function toMm(v) {
    var m = /^\s*([\d.]+)\s*(mm|cm|in|px)?\s*$/.exec(v || ''); if (!m) return 15;
    var n = parseFloat(m[1]), u = m[2] || 'px';
    return u === 'mm' ? n : u === 'cm' ? n * 10 : u === 'in' ? n * 25.4 : n * 25.4 / 96;
  }
  function pageMargins(html) {
    var m = /@page\s*\{[^}]*?margin\s*:\s*([^;}]+)/i.exec(html);
    var p = m ? m[1].trim().split(/\s+/).map(toMm) : [15];
    var t = p[0], r = p.length > 1 ? p[1] : t, b = p.length > 2 ? p[2] : t, l = p.length > 3 ? p[3] : r;
    return [t, l, b, r];
  }
  function fileName(doc) {
    var t = '';
    try { var el = doc.querySelector('.print-title'); t = (el && el.textContent) || doc.title || ''; } catch (e) {}
    t = t.replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Φύλλο εργασίας';
    return t.slice(0, 80) + '.pdf';
  }

  // ── Σελιδοποίηση: καμία ερώτηση (.pq), κεφαλίδα ή τίτλος δεν κόβεται ανάμεσα σε σελίδες ──
  // Πριν από ό,τι θα έπεφτε πάνω στο όριο της σελίδας μπαίνει κενό, ώστε να ξεκινήσει στην επόμενη.
  // (Ό,τι είναι από μόνο του μεγαλύτερο από μία σελίδα συνεχίζει αναγκαστικά.)
  function paginate(d, pageH) {
    if (!(pageH > 100)) return;
    var els = Array.prototype.slice.call(d.querySelectorAll('.hdr-table, .print-title, .pq'));
    var base = d.body.getBoundingClientRect().top;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var top = r.top - base, bottom = top + r.height;
      if (r.height > pageH || r.height === 0) return;
      var first = Math.floor(top / pageH), last = Math.floor((bottom - 1) / pageH);
      if (last > first) {
        var sp = d.createElement('div');
        sp.style.cssText = 'height:' + Math.ceil((first + 1) * pageH - top + 2) + 'px;margin:0;padding:0;border:0;';
        el.parentNode.insertBefore(sp, el);
      }
    });
  }

  // ── Το φύλλο → PDF μέσα σε κρυφό iframe (τα στυλ του φύλλου μένουν απομονωμένα) ──
  var busy = false;
  function makePdf(html) {
    if (busy) return; busy = true;
    toast('⏳ Προετοιμασία PDF για εκτύπωση…');
    var mg = pageMargins(html);
    var contentMm = 210 - mg[1] - mg[3];
    var widthPx = Math.round(contentMm * 96 / 25.4);
    var fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + widthPx + 'px;height:1200px;border:0;visibility:hidden;';
    // iOS: χωρίς «αυτόματη μεγέθυνση κειμένου» (μεγάλωνε τις παραγράφους αλλά όχι τις σύντομες επιλογές)
    var extra = '<meta name="viewport" content="width=' + widthPx + ', initial-scale=1">' +
      '<style id="lev-pdf">html,body,*{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}' +
      '.no-print{display:none!important}' +
      'html,body{margin:0!important;padding:0!important;width:' + widthPx + 'px!important;max-width:none!important;background:#fff!important}' +
      '</style>';
    var doc = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, extra + '</head>') : extra + html;
    function done() { busy = false; setTimeout(function () { try { fr.remove(); } catch (e) {} }, 1000); }
    fr.onload = function () {
      var w = fr.contentWindow, d = fr.contentDocument;
      var s = d.createElement('script');
      s.src = LIB;
      s.onerror = function () { done(); toast('Δεν φορτώθηκε το εργαλείο PDF — ελέγξτε τη σύνδεση.', 5000); };
      s.onload = function () {
        // Περιμένουμε τις εικόνες (QR, λογότυπο) πριν από τη «φωτογράφιση»
        var imgs = Array.prototype.slice.call(d.images || []);
        Promise.all(imgs.map(function (im) {
          return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; setTimeout(r, 4000); });
        })).then(function () {
          paginate(d, Math.floor((297 - mg[0] - mg[2]) * 96 / 25.4));
          var name = fileName(d);
          // οι ρυθμίσεις φτιάχνονται με το JSON του iframe (αλλιώς το html2pdf δεν αναγνωρίζει τους πίνακες)
          var opt = w.JSON.parse(JSON.stringify({
            margin: mg,
            filename: name,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: widthPx, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: [] }   // η σελιδοποίηση έγινε ήδη από την paginate()
          }));
          return w.html2pdf().set(opt).from(d.body).outputPdf('blob').then(function (pdf) {
            done(); hide();
            share(new File([pdf], name, { type: 'application/pdf' }), false);
          });
        }).catch(function (e) {
          done(); toast('Δεν ήταν δυνατή η δημιουργία PDF.', 5000);
          try { console.error('[lev-print]', e); } catch (x) {}
        });
      };
      d.head.appendChild(s);
    };
    fr.srcdoc = doc;
    document.body.appendChild(fr);
  }
})();
