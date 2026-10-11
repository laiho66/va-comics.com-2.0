/* VA COMICS // Reading Room (media/reader.html)  v2: one code can open one book, several, or all.
   Talks only to the guard Worker (/api/reader/*). The book text is never in this file or in the repo.
   Protections here are a deterrent (no copy, no right-click, no print, watermark); the real lock is on the server. */
(function () {
    'use strict';
    var API = '/api/reader/';
    var $ = function (id) { return document.getElementById(id); };
    var state = { books: [], book: null, label: '', code: '', expires: 0, ch: 0, size: 19 };

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
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function coverImg(b) {
        var img = document.createElement('img'); img.alt = b.title + ' cover'; img.loading = 'lazy';
        img.onerror = function () { this.remove(); };
        if (/^\/[\w\-./]+$/.test(b.cover || '')) { img.src = b.cover; }
        return img;
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
        $('rrShelf').hidden = view !== 'shelf';
        $('rrReader').hidden = view !== 'reader';
        $('rrWatermark').hidden = !(view === 'reader' || view === 'shelf');
    }
    function gate(msg) {
        show('gate');
        var m = $('rrMsg'); m.hidden = !msg; m.textContent = msg || '';
        if (!msg) { $('rrCode').focus(); }
    }

    /* gate picture + title follow the public list of books */
    api('library').then(function (j) {
        var books = j.books || [];
        if (books.length < 2) {
            if (books[0]) { $('rrGateTitle').textContent = books[0].title; }
            return;
        }
        var box = $('rrGateCover'); box.innerHTML = ''; box.classList.add('rr-gate-stack');
        books.slice(0, 4).forEach(function (b) { box.appendChild(coverImg(b)); });
        $('rrGateTitle').textContent = 'The Vanguard Chronicles';
        $('rrGateText').textContent = books.map(function (b) { return b.title; }).join(' · ') + '. Full books, chapter by chapter, with every illustration.';
    }).catch(function () { /* the gate still works with the default text */ });

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

    /* ---------- shelf ---------- */
    function fmtDate(sec) {
        try { return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
    }
    function shelf() {
        var box = $('rrBooks'); box.innerHTML = '';
        state.books.forEach(function (b) {
            var card = el('button', 'rr-book'); card.type = 'button';
            var cov = el('div', 'rr-book-cover', b.title.toUpperCase()); var img = coverImg(b);
            if (img.src) { cov.textContent = ''; cov.appendChild(img); }
            card.appendChild(cov); card.appendChild(el('b', '', b.title));
            if (b.series) { card.appendChild(el('span', 'meta', b.series)); }
            var pos = load('rr_pos_' + b.id, null);
            card.appendChild(el('span', 'btn btn--sm', pos ? 'CONTINUE' : 'READ'));
            card.addEventListener('click', function () { openBook(b.id); });
            box.appendChild(card);
        });
        save('rr_last_book', null);
        show('shelf'); window.scrollTo(0, 0);
    }

    /* ---------- reader ---------- */
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

    function openBook(id) {
        show('loading');
        return api('book/' + encodeURIComponent(id)).then(function (b) {
            state.book = b;
            $('rrBookTitle').textContent = b.title + (b.series ? ' // ' + b.series : '');
            $('rrShelfBtn').hidden = state.books.length < 2;
            buildToc(); toggleToc(false);
            show('reader');
            save('rr_last_book', b.id);
            var pos = load('rr_pos_' + b.id, null);
            var first = b.chapters.length > 1 ? 1 : 0;      /* first visit: skip the front matter */
            return openChapter(pos ? pos.ch : first, pos ? pos.at : 0);
        }).catch(fail);
    }

    var loadingCh = 0;
    function openChapter(n, scrollRatio) {
        var chs = state.book.chapters, idx = Math.max(0, Math.min(chs.length - 1, n)), my = ++loadingCh, bid = state.book.id;
        $('rrText').innerHTML = '<p class="meta">LOADING...</p>';
        return api('book/' + encodeURIComponent(bid) + '/chapter/' + chs[idx].n).then(function (c) {
            if (my !== loadingCh) { return; }
            state.ch = idx;
            $('rrChapterLabel').textContent = c.title.toUpperCase();
            var box = $('rrText');
            box.innerHTML = c.html;    /* our own cleaned book text, prepared once from the EPUB */
            Array.prototype.forEach.call(box.querySelectorAll('img[data-img]'), function (img) {
                img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
                img.src = API + 'book/' + encodeURIComponent(bid) + '/img/' + parseInt(img.getAttribute('data-img'), 10);
            });
            $('rrStamp').textContent = 'Reader copy for ' + state.label + ' · ' + state.code + ' · not for sharing';
            $('rrPrev').disabled = idx === 0; $('rrNext').disabled = idx === chs.length - 1;
            $('rrPos').textContent = (idx + 1) + ' / ' + chs.length;
            Array.prototype.forEach.call($('rrTocList').querySelectorAll('button'), function (b) { b.classList.toggle('is-current', +b.getAttribute('data-ch') === chs[idx].n); });
            save('rr_pos_' + bid, { ch: idx, at: 0 });
            requestAnimationFrame(function () {
                var bar = document.querySelector('.topbar'), off = bar && /fixed|sticky/.test(getComputedStyle(bar).position) ? bar.offsetHeight : 0;
                var top = $('rrReader').getBoundingClientRect().top + window.pageYOffset - 8 - off;
                if (scrollRatio) { top = $('rrPage').offsetTop + scrollRatio * $('rrPage').offsetHeight; }
                window.scrollTo(0, Math.max(0, top));
            });
        }).catch(fail);
    }
    function fail(err) {
        if (err && (err.status === 401 || (err.status === 403 && err.code !== 'not_your_book'))) { gate(err.status === 401 ? '' : err.message); return; }
        if (err && err.code === 'not_your_book') { if (state.books.length > 1) { shelf(); } else { gate(err.message); } return; }
        show('reader');
        $('rrText').innerHTML = '';
        $('rrText').appendChild(el('p', 'rr-msg', (err && err.message) || 'Something went wrong.'));
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

    function closeRoom() {
        api('logout', { method: 'POST' }).catch(function () { /* ignore */ }).then(function () { state.book = null; state.books = []; gate(''); });
    }
    $('rrPrev').addEventListener('click', function () { openChapter(state.ch - 1, 0); });
    $('rrNext').addEventListener('click', function () { openChapter(state.ch + 1, 0); });
    $('rrToc').addEventListener('click', function () { toggleToc(); });
    $('rrSmaller').addEventListener('click', function () { setSize(state.size - 1); });
    $('rrBigger').addEventListener('click', function () { setSize(state.size + 1); });
    $('rrShelfBtn').addEventListener('click', shelf);
    $('rrLogout').addEventListener('click', closeRoom);
    $('rrShelfLogout').addEventListener('click', closeRoom);

    /* ---------- deterrents (the server is the real lock) ---------- */
    function inBook(e) { return !$('rrReader').hidden && e.target && e.target.closest && e.target.closest('#rrReader'); }
    ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'].forEach(function (t) {
        document.addEventListener(t, function (e) { if (inBook(e)) { e.preventDefault(); } });
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
            state.books = s.books || []; state.label = s.label; state.code = s.code; state.expires = s.expires;
            var copy = 'Reader copy for ' + s.label + ' · open until ' + fmtDate(s.expires);
            $('rrCopy').textContent = copy; $('rrShelfCopy').textContent = copy + ' · ' + state.books.length + ' book' + (state.books.length === 1 ? '' : 's');
            watermark(); setSize(load('rr_size', 19));
            if (!state.books.length) { gate('This code does not open any book right now. Ask on Facebook or X.'); return; }
            var last = load('rr_last_book', null);
            if (state.books.length === 1) { return openBook(state.books[0].id); }
            if (last && state.books.some(function (b) { return b.id === last; })) { return openBook(last); }
            shelf();
        }).catch(function (err) { gate(err.status === 401 ? '' : err.message); });
    }
    start();
})();
