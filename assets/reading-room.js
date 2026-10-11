/* VA COMICS // Reading Room (media/reader.html)
   Talks only to the guard Worker (/api/reader/*). The book text is never in this file or in the repo.
   Protections here are a deterrent (no copy, no right-click, no print, watermark); the real lock is on the server. */
(function () {
    'use strict';
    var API = '/api/reader/';
    var $ = function (id) { return document.getElementById(id); };
    var state = { book: null, label: '', code: '', expires: 0, ch: 0, size: 19 };

    /* ---------- small storage helpers (may be blocked: never required) ---------- */
    function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: fine */ } }
    function deviceId() {
        var id = load('rr_device', null);
        if (!id || !/^[a-f0-9-]{16,64}$/.test(id)) {
            id = (crypto.randomUUID ? crypto.randomUUID() : Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''));
            save('rr_device', id);
        }
        return id;
    }

    function api(path, opts) {
        opts = opts || {};
        opts.credentials = 'same-origin'; opts.cache = 'no-store';
        return fetch(API + path, opts).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) { var e = new Error(j.message || 'Something went wrong. Try again.'); e.code = j.error || ''; e.status = r.status; throw e; }
                return j;
            });
        });
    }

    /* ---------- views ---------- */
    function show(view) {
        $('rrLoading').hidden = view !== 'loading';
        $('rrGate').hidden = view !== 'gate';
        $('rrReader').hidden = view !== 'reader';
        $('rrWatermark').hidden = view !== 'reader';
    }
    function gate(msg) {
        show('gate');
        var m = $('rrMsg'); m.hidden = !msg; m.textContent = msg || '';
        if (!msg) { $('rrCode').focus(); }
    }

    /* ---------- gate ---------- */
    $('rrForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var code = $('rrCode').value.trim(), b = $('rrOpen');
        if (code.replace(/[^A-Za-z0-9]/g, '').length < 11) { gate('The code looks like VNG-XXXX-XXXX. Check it and try again.'); return; }
        b.disabled = true; b.textContent = 'CHECKING...';
        api('unlock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code, device: deviceId() }) })
            .then(function () { $('rrCode').value = ''; return start(); })
            .catch(function (err) { gate(err.message); })
            .then(function () { b.disabled = false; b.textContent = 'OPEN_BOOK'; });
    });
    $('rrCode').addEventListener('input', function () {
        var p = this.selectionStart, v = this.value.toUpperCase();
        if (v !== this.value) { this.value = v; try { this.setSelectionRange(p, p); } catch (e) { /* ignore */ } }
    });

    /* ---------- reader ---------- */
    function fmtDate(sec) {
        try { return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
    }
    function watermark() {
        var t = ('READER COPY  ·  ' + state.label + '  ·  ' + state.code).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="260"><text x="230" y="130" fill="#ffffff" font-family="Courier New, monospace" font-size="15" letter-spacing="2" text-anchor="middle" transform="rotate(-28 230 130)">' + t + '</text></svg>';
        $('rrWatermark').style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    }
    function buildToc() {
        var ol = $('rrTocList'); ol.innerHTML = '';
        state.book.chapters.forEach(function (c) {
            var li = document.createElement('li'), b = document.createElement('button');
            b.type = 'button'; b.textContent = c.title; b.setAttribute('data-ch', c.n);
            b.addEventListener('click', function () { toggleToc(false); openChapter(c.n, 0); });
            li.appendChild(b); ol.appendChild(li);
        });
    }
    function toggleToc(force) {
        var p = $('rrTocPanel'), open = typeof force === 'boolean' ? force : p.hidden;
        p.hidden = !open; $('rrToc').setAttribute('aria-expanded', String(open));
    }
    function setSize(px) {
        state.size = Math.max(15, Math.min(26, px));
        $('rrPage').style.setProperty('--rr-size', state.size + 'px');
        save('rr_size', state.size);
    }

    var loadingCh = 0;
    function openChapter(n, scrollRatio) {
        var chs = state.book.chapters, idx = Math.max(0, Math.min(chs.length - 1, n)), my = ++loadingCh;
        $('rrText').innerHTML = '<p class="meta">LOADING...</p>';
        return api('chapter/' + chs[idx].n).then(function (c) {
            if (my !== loadingCh) { return; }
            state.ch = idx;
            $('rrChapterLabel').textContent = c.title.toUpperCase();
            var box = $('rrText');
            box.innerHTML = c.html;    /* our own cleaned book text, prepared once from the EPUB */
            Array.prototype.forEach.call(box.querySelectorAll('img[data-img]'), function (img) {
                img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
                img.src = API + 'img/' + parseInt(img.getAttribute('data-img'), 10);
            });
            $('rrStamp').textContent = 'Reader copy for ' + state.label + ' · ' + state.code + ' · not for sharing';
            $('rrPrev').disabled = idx === 0; $('rrNext').disabled = idx === chs.length - 1;
            $('rrPos').textContent = (idx + 1) + ' / ' + chs.length;
            Array.prototype.forEach.call($('rrTocList').querySelectorAll('button'), function (b) { b.classList.toggle('is-current', +b.getAttribute('data-ch') === chs[idx].n); });
            save('rr_pos_' + state.book.id, { ch: idx, at: 0 });
            requestAnimationFrame(function () {
                var bar = document.querySelector('.topbar'), off = bar && /fixed|sticky/.test(getComputedStyle(bar).position) ? bar.offsetHeight : 0;
                var top = $('rrReader').getBoundingClientRect().top + window.pageYOffset - 8 - off;
                if (scrollRatio) { top = $('rrPage').offsetTop + scrollRatio * $('rrPage').offsetHeight; }
                window.scrollTo(0, Math.max(0, top));
            });
        }).catch(fail);
    }
    function fail(err) {
        if (err && (err.status === 401 || err.status === 403)) { gate(err.status === 401 ? '' : err.message); return; }
        $('rrText').innerHTML = '';
        var p = document.createElement('p'); p.className = 'rr-msg'; p.textContent = (err && err.message) || 'Something went wrong.';
        $('rrText').appendChild(p);
    }

    /* remember how far into the chapter the reader is */
    var scrollTimer = null;
    window.addEventListener('scroll', function () {
        if ($('rrReader').hidden || !state.book) { return; }
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
            var page = $('rrPage'), r = (window.pageYOffset - page.offsetTop) / Math.max(1, page.offsetHeight);
            save('rr_pos_' + state.book.id, { ch: state.ch, at: Math.max(0, Math.min(0.98, r)) });
        }, 400);
    }, { passive: true });

    $('rrPrev').addEventListener('click', function () { openChapter(state.ch - 1, 0); });
    $('rrNext').addEventListener('click', function () { openChapter(state.ch + 1, 0); });
    $('rrToc').addEventListener('click', function () { toggleToc(); });
    $('rrSmaller').addEventListener('click', function () { setSize(state.size - 1); });
    $('rrBigger').addEventListener('click', function () { setSize(state.size + 1); });
    $('rrLogout').addEventListener('click', function () {
        api('logout', { method: 'POST' }).catch(function () { /* ignore */ }).then(function () { state.book = null; gate(''); });
    });

    /* ---------- deterrents (the server is the real lock) ---------- */
    function inReader(e) { return !$('rrReader').hidden && e.target && e.target.closest && e.target.closest('#rrReader'); }
    ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'].forEach(function (t) {
        document.addEventListener(t, function (e) { if (inReader(e)) { e.preventDefault(); } });
    });
    document.addEventListener('keydown', function (e) {
        if ($('rrReader').hidden) { return; }
        var k = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's' || k === 'c' || k === 'a')) { e.preventDefault(); }
        if (!e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement === document.body) {
            if (k === 'arrowright' && !$('rrNext').disabled) { openChapter(state.ch + 1, 0); }
            if (k === 'arrowleft' && !$('rrPrev').disabled) { openChapter(state.ch - 1, 0); }
        }
    });

    /* ---------- start ---------- */
    function start() {
        show('loading');
        return api('session').then(function (s) {
            state.book = s.book; state.label = s.label; state.code = s.code; state.expires = s.expires;
            $('rrBookTitle').textContent = s.book.title + ' // ' + s.book.series;
            $('rrCopy').textContent = 'Reader copy for ' + s.label + ' · open until ' + fmtDate(s.expires);
            watermark(); buildToc(); setSize(load('rr_size', 19));
            show('reader');
            var pos = load('rr_pos_' + s.book.id, { ch: 1, at: 0 });   /* first visit: start at the Prologue */
            return openChapter(pos.ch, pos.at);
        }).catch(function (err) { gate(err.status === 401 ? '' : err.message); });
    }
    start();
})();
