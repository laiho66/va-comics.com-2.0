/* VA COMICS // characters.js
   Characters page: filters by faction + the dossier (side panel on desktop, bottom sheet on phone).
   Works with the markup in deaddrop/characters.html (and the Vanguard page).
   Each character is an <article class="card char" id="..." data-faction="..."> with a hidden .char-bio. */
(function () {
    'use strict';
    var grid = document.getElementById('charGrid');
    if (!grid) { return; }

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.char'));
    var filters = document.getElementById('charFilters');
    var strip = document.getElementById('factionStrip');
    var info = document.getElementById('factionInfo');
    var initialHash = location.hash;   // read BEFORE the filters touch the address
    var current = null;           // the card shown in the dossier
    var lastFocus = null;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (text !== undefined) { n.textContent = text; }
        return n;
    }

    /* ---------- build the dossier once ---------- */
    var overlay = el('div', 'dossier-overlay'); overlay.hidden = true;
    var d = el('aside', 'dossier dossier--float'); d.hidden = true;
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Character file');
    d.innerHTML =
        '<div class="dossier-head"><span>PERSONNEL_FILE // <b id="dPos">01</b> / <span id="dTotal">00</span></span>' +
        '<span class="dossier-actions"><button type="button" id="dPrev" aria-label="Previous character">&lt;</button>' +
        '<button type="button" id="dNext" aria-label="Next character">&gt;</button>' +
        '<button type="button" id="dClose" aria-label="Close" class="is-accent">X</button></span></div>' +
        '<div class="dossier-body"><div class="media ratio-2x3 dossier-portrait"><div class="ph"></div><img id="dImg" alt=""></div>' +
        '<div class="stack-sm dossier-id"><span class="tag" id="dFaction"></span><h2 class="h2" id="dName"></h2><span class="meta" id="dCode"></span></div>' +
        '<p id="dBio"></p></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(d);

    var q = function (id) { return d.querySelector('#' + id); };
    var dImg = q('dImg'), dName = q('dName'), dFaction = q('dFaction'), dCode = q('dCode'), dBio = q('dBio'), dPos = q('dPos'), dTotal = q('dTotal');

    function visible() { return cards.filter(function (c) { return !c.hidden; }); }

    function fill(card) {
        var img = card.querySelector('img');
        dImg.style.display = img ? '' : 'none';
        dImg.src = img ? img.getAttribute('src') : '';
        dImg.alt = 'Portrait of ' + card.getAttribute('data-name');
        dImg.onerror = function () { dImg.style.display = 'none'; };
        dName.textContent = card.getAttribute('data-name');
        dFaction.textContent = card.getAttribute('data-label') || '';
        var code = card.getAttribute('data-code');
        dCode.textContent = code ? '[ ' + code + ' ]' : '';
        dCode.hidden = !code;
        var bio = card.querySelector('.char-bio');
        dBio.textContent = bio ? bio.textContent.trim() : '';
        var list = visible(), i = list.indexOf(card);
        dPos.textContent = String(i + 1).padStart(2, '0');
        dTotal.textContent = String(list.length).padStart(2, '0');
    }

    function open(card) {
        lastFocus = document.activeElement;
        current = card;
        fill(card);
        overlay.hidden = false; d.hidden = false;
        document.body.classList.add('gate-open');
        try { history.replaceState(null, '', '#' + card.id); } catch (e) { /* ignore */ }
        q('dClose').focus();
    }

    function close() {
        overlay.hidden = true; d.hidden = true; current = null;
        document.body.classList.remove('gate-open');
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
        if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    function step(dir) {
        if (!current) { return; }
        var list = visible(), i = list.indexOf(current);
        if (i < 0) { return; }
        current = list[(i + dir + list.length) % list.length];
        fill(current);
        try { history.replaceState(null, '', '#' + current.id); } catch (e) { /* ignore */ }
    }

    q('dClose').addEventListener('click', close);
    q('dPrev').addEventListener('click', function () { step(-1); });
    q('dNext').addEventListener('click', function () { step(1); });
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
        if (d.hidden) { return; }
        if (e.key === 'Escape') { close(); }
        else if (e.key === 'ArrowLeft') { step(-1); }
        else if (e.key === 'ArrowRight') { step(1); }
    });

    cards.forEach(function (c) {
        c.addEventListener('click', function () { open(c); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c); } });
    });

    /* ---------- filters ---------- */
    function applyFilter(key) {
        cards.forEach(function (c) {
            var f = (' ' + (c.getAttribute('data-faction') || '') + ' ');
            c.hidden = !(key === 'all' || f.indexOf(' ' + key + ' ') > -1);
        });
        if (filters) {
            Array.prototype.forEach.call(filters.querySelectorAll('button'), function (b) {
                var on = b.getAttribute('data-filter') === key;
                b.classList.toggle('chip--active', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        }
        if (strip) {
            var node = info && key !== 'all' ? info.querySelector('[data-faction="' + key + '"]') : null;
            if (node && node.textContent.trim()) {
                strip.querySelector('.tag').textContent = 'FACTION_FILE // ' + node.getAttribute('data-name');
                strip.querySelector('p').textContent = node.textContent.trim();
                strip.hidden = false;
            } else { strip.hidden = true; }
        }
        try {
            history.replaceState(null, '', key === 'all' ? location.pathname : location.pathname + '?f=' + key);
        } catch (e) { /* ignore */ }
    }

    if (filters) {
        /* counts */
        Array.prototype.forEach.call(filters.querySelectorAll('button'), function (b) {
            var key = b.getAttribute('data-filter');
            var n = key === 'all' ? cards.length : cards.filter(function (c) { return (' ' + c.getAttribute('data-faction') + ' ').indexOf(' ' + key + ' ') > -1; }).length;
            b.textContent = b.textContent.replace(/\s*·\s*\d+$/, '') + ' · ' + n;
            b.addEventListener('click', function () { applyFilter(key); });
        });
        var m = /[?&]f=([\w-]+)/.exec(location.search);
        applyFilter(m ? m[1] : 'all');
    }

    /* ---------- open a character from the address (#mace) ---------- */
    if (initialHash) {
        var target = document.getElementById(initialHash.slice(1));
        if (target && target.classList.contains('char')) {
            if (target.hidden) { applyFilter('all'); }
            open(target);
        }
    }
})();
