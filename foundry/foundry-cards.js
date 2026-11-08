/* VA COMICS // Foundry v2 // foundry-cards.js
   ISSUES tab, panel VOLUME_CARDS: the issue cards on deaddrop/volN.html (cover, title, READ ONLINE, eBook,
   Paperback, DISCUSS). Add the card of a new issue and set / change its Amazon links, without editing HTML.
   It also keeps "Issues A-B" up to date on the volume page and on the Dead Drop hub (deaddrop/index.html).
   Safety: a page is only edited if Foundry can read every card back exactly as it is (round trip), and
   nothing outside the card grid changes except the "Issues A-B" text. Part 1 (FoundryCards) is tested in Node. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryCards = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var GRID = '<div class="grid grid-3" id="issues">', GRID_END = '\n        </div>\n\n    </main>';
    var OPEN = '            <article class="card card--static">', CLOSE = '            </article>';
    var RANGE = /Issues \d+-\d+/g;

    function escText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function escAttr(s) { return escText(s).replace(/"/g, '&quot;').replace(/'/g, '&#x27;'); }

    function frame(html) {
        var a = html.indexOf(GRID); if (a < 0) { return null; }
        a += GRID.length;
        var b = html.indexOf(GRID_END, a); if (b < 0) { return null; }
        return { a: a, b: b };
    }
    function btn(line) {
        if (/is-disabled/.test(line)) { return null; }
        var m = /href="([^"]*)"[^>]*>([^<]*)<\/a>/.exec(line);
        return m ? { href: m[1], label: m[2] } : undefined;
    }
    function buildBtn(b, label) {
        if (!b) { return '                        <a class="btn btn--block is-disabled" href="#" aria-disabled="true">N/A</a>'; }
        return '                        <a class="btn btn--block" href="' + b.href + '" target="_blank" rel="noopener noreferrer">' + (b.label || label) + '</a>';
    }
    function buildCard(c) {
        return [
            OPEN,
            '                <div class="media ratio-2x3"><div class="ph">[ COVER<br>' + c.ph + ' ]</div><img class="fade" src="/deaddrop/assets/' + c.cover + '.webp" alt="' + c.alt + '" loading="lazy" onerror="this.remove()"></div>',
            '                <div class="card-body">',
            '                    <div class="stack-sm"><span class="tag">' + c.tag + '</span><h3 class="h3">' + c.title + '</h3></div>',
            '                    <div class="btn-stack">',
            '                        <a class="btn btn--primary btn--block" href="/media/viewer.html?issue=' + c.key + '">READ ONLINE</a>',
            buildBtn(c.ebook, 'eBook'),
            buildBtn(c.paper, 'Paperback'),
            '                        <a class="btn btn--block" href="/media/talk.html?issue=' + c.key + '">DISCUSS</a>',
            '                    </div>',
            '                </div>',
            CLOSE
        ].join('\n');
    }
    /* -> { cards: [...], ok: bool, why } ; card fields are kept as raw HTML so an untouched card is rebuilt byte for byte */
    function parse(html) {
        var f = frame(html); if (!f) { return { cards: [], ok: false, why: 'The card grid (id="issues") was not found on this page.' }; }
        var block = html.slice(f.a, f.b), cards = [], re = /\n            <article class="card card--static">[\s\S]*?\n            <\/article>/g, m, last = 0, rest = '';
        while ((m = re.exec(block))) {
            rest += block.slice(last, m.index); last = re.lastIndex;
            var t = m[0].slice(1), c = {};
            var g = function (rx) { var x = rx.exec(t); return x ? x[1] : null; };
            c.ph = g(/\[ COVER<br>(.*?) \]/); c.cover = g(/src="\/deaddrop\/assets\/([\w-]+)\.webp"/); c.alt = g(/ alt="([^"]*)"/);
            c.tag = g(/<span class="tag">(.*?)<\/span>/); c.title = g(/<h3 class="h3">(.*?)<\/h3>/); c.key = g(/viewer\.html\?issue=([\w]+)"/);
            var lines = t.split('\n'), i = lines.findIndex(function (l) { return /class="btn-stack"/.test(l); });
            c.ebook = i >= 0 ? btn(lines[i + 2] || '') : undefined; c.paper = i >= 0 ? btn(lines[i + 3] || '') : undefined;
            cards.push(c);
            if (Object.keys(c).some(function (k) { return c[k] === undefined || (c[k] === null && k !== 'ebook' && k !== 'paper'); }) || buildCard(c) !== t) {
                return { cards: cards, ok: false, why: 'The card for "' + (c.tag || 'one issue') + '" has a shape Foundry does not know (edited by hand?). Nothing can be changed here until it matches the others.' };
            }
        }
        rest += block.slice(last);
        if (rest.trim()) { return { cards: cards, ok: false, why: 'There is extra code between the cards. Nothing can be changed here.' }; }
        return { cards: cards, ok: true };
    }
    function issueNum(key) { return parseInt(String(key).split('_')[0], 10); }
    function range(cards) {
        var n = cards.map(function (c) { return issueNum(c.key); }).filter(function (x) { return !isNaN(x); });
        return n.length ? { from: Math.min.apply(null, n), to: Math.max.apply(null, n) } : null;
    }
    function write(html, cards) {
        var f = frame(html); if (!f) { throw new Error('The card grid was not found.'); }
        var seen = {};
        cards.forEach(function (c) {
            if (!/^[\w]+$/.test(c.key)) { throw new Error('Bad issue key: ' + c.key); }
            if (seen[c.key]) { throw new Error('Issue ' + c.key + ' has two cards.'); } seen[c.key] = 1;
            [c.ebook, c.paper].forEach(function (b) { if (b && !/^https:\/\/(www\.)?amazon\.[a-z.]+\//.test(b.href)) { throw new Error('Links must be Amazon links starting with https://www.amazon.'); } });
        });
        var out = html.slice(0, f.a) + cards.map(function (c) { return '\n' + buildCard(c); }).join('') + html.slice(f.b);
        var r = range(cards);
        return r ? setRange(out, r) : out;
    }
    function setRange(html, r) { return html.replace(RANGE, 'Issues ' + r.from + '-' + r.to); }
    /* hub: only "Volume N // Issues A-B" of that volume */
    function setHubRange(html, vol, r) {
        var rx = new RegExp('(Volume ' + vol + ' // )Issues \\d+-\\d+', 'g');
        return html.replace(rx, '$1Issues ' + r.from + '-' + r.to);
    }
    function guard(oldHtml, newHtml, cards) {
        var o = frame(oldHtml), n = frame(newHtml);
        if (!o || !n) { throw new Error('Safety check: the card grid could not be found. Nothing was saved.'); }
        var norm = function (s) { return s.replace(RANGE, 'Issues #'); };
        if (norm(oldHtml.slice(0, o.a)) !== norm(newHtml.slice(0, n.a)) || norm(oldHtml.slice(o.b)) !== norm(newHtml.slice(n.b))) {
            throw new Error('Safety check: this would change the page outside the issue cards. Nothing was saved.');
        }
        var back = parse(newHtml);
        if (!back.ok || JSON.stringify(back.cards) !== JSON.stringify(cards)) { throw new Error('Safety check: the saved cards would not read back the same. Nothing was saved.'); }
    }
    function guardHub(oldHtml, newHtml) {
        var norm = function (s) { return s.replace(RANGE, 'Issues #'); };
        if (norm(oldHtml) !== norm(newHtml)) { throw new Error('Safety check: the hub page would change more than the issue range. Nothing was saved.'); }
    }
    /* a new card from an issue in the reader (key, title, badge like "ISSUE #11 [PT 1]") */
    function newCard(it, coverFile) {
        var tag = String(it.badge || ('ISSUE #' + it.key)).replace(/\s*\[PT (\d+)\]/, ' // PART $1').trim();
        return { ph: escText(tag), cover: coverFile, alt: escAttr(tag + ': ' + it.title), tag: escText(tag), title: escText(it.title), key: it.key, ebook: null, paper: null };
    }
    function link(url, label) {
        url = String(url || '').trim();
        return url ? { href: escAttr(url), label: label } : null;
    }
    function plain(s) { var t = String(s || '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); return t; }
    return { parse: parse, write: write, guard: guard, guardHub: guardHub, setHubRange: setHubRange, range: range, newCard: newCard, link: link, plain: plain, issueNum: issueNum };
});

/* ============================== the panel (browser only) ============================== */
(function () {
    'use strict';
    if (typeof document === 'undefined' || !document.getElementById('vcPanel')) { return; }
    var V = FoundryCards, C = window.FoundryCore, HUB = 'deaddrop/index.html';
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function say(msg, kind) {
        var s = $('status'); s.hidden = !msg; s.textContent = msg || ''; s.className = 'fstatus' + (kind ? ' is-' + kind : '');
        if (msg && s.scrollIntoView) { s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    function gh() {
        var cfg = { owner: 'laiho66', repo: 'va-comics.com-2.0', branch: 'main', token: '' };
        try { var s = JSON.parse(localStorage.getItem('foundry_v2_cfg')); if (s) { for (var k in cfg) { if (s[k]) { cfg[k] = s[k]; } } } } catch (e) { /* ignore */ }
        return cfg.token ? FoundryGH.make(cfg) : null;
    }
    var state = null;     /* { file, vol, cards, issues } */

    function load() {
        var g = gh(); if (!g) { say('Connect first: Settings → paste the GitHub token.', 'err'); return; }
        var vol = $('vcVol').value, file = 'deaddrop/vol' + vol + '.html', box = $('vcList');
        box.innerHTML = ''; box.appendChild(el('p', 'hint', 'Loading...')); $('vcAddBox').hidden = true;
        Promise.all([g.getFile(file), g.getFile('media/viewer.html')]).then(function (r) {
            var p = V.parse(r[0].text);
            if (!p.ok) { box.innerHTML = ''; box.appendChild(el('p', 'hint', p.why)); state = null; return; }
            state = { file: file, vol: vol, cards: p.cards, issues: C.parseIssues(r[1].text) };
            render(); addChoices();
        }).catch(function (e) { box.innerHTML = ''; box.appendChild(el('p', 'hint', e.message)); state = null; });
    }
    function render() {
        var box = $('vcList'); box.innerHTML = '';
        state.cards.forEach(function (c, i) {
            var row = el('div', 'fitem vc-item'), main = el('div', 'fitem-main');
            main.appendChild(el('b', '', V.plain(c.tag) + ' // ' + V.plain(c.title)));
            var grid = el('div', 'vc-links');
            [['ebook', 'eBook link'], ['paper', 'Paperback link']].forEach(function (x) {
                var f = el('div', 'field'), lb = el('label', '', x[1]), inp = el('input'); inp.type = 'url'; inp.placeholder = 'empty = N/A';
                inp.value = c[x[0]] ? V.plain(c[x[0]].href) : ''; inp.setAttribute('data-i', i); inp.setAttribute('data-k', x[0]);
                inp.addEventListener('input', function () { $('vcDirty').hidden = false; });
                f.appendChild(lb); f.appendChild(inp); grid.appendChild(f);
            });
            main.appendChild(grid);
            var acts = el('div', 'fitem-actions');
            if (i === state.cards.length - 1) {
                var rm = el('button', 'btn btn--sm btn--danger', 'REMOVE'); rm.type = 'button'; rm.title = 'Remove this card from the volume page';
                rm.addEventListener('click', function () { if (confirm('Remove the card of ' + V.plain(c.tag) + ' from this volume page? (The issue stays in the reader.)')) { collect(); state.cards.pop(); render(); addChoices(); $('vcDirty').hidden = false; } });
                acts.appendChild(rm);
            }
            row.appendChild(main); row.appendChild(acts); box.appendChild(row);
        });
        var r = V.range(state.cards);
        $('vcRange').textContent = r ? 'This page says: Issues ' + r.from + '-' + r.to + ' (updated automatically).' : '';
    }
    function addChoices() {
        var sel = $('vcIssue'); sel.innerHTML = '';
        var have = {}; state.cards.forEach(function (c) { have[c.key] = 1; });
        var last = state.cards.length ? V.issueNum(state.cards[state.cards.length - 1].key) : 0;
        var options = state.issues.filter(function (it) { return !have[it.key] && V.issueNum(it.key) > last; });
        options.forEach(function (it) { var o = el('option', '', it.badge + ' — ' + it.title); o.value = it.key; sel.appendChild(o); });
        $('vcAddBox').hidden = false;
        $('vcAddEmpty').hidden = !!options.length; $('vcAddForm').hidden = !options.length;
    }
    function collect() {
        Array.prototype.forEach.call($('vcList').querySelectorAll('input[data-k]'), function (inp) {
            var c = state.cards[+inp.getAttribute('data-i')], k = inp.getAttribute('data-k');
            var cur = c[k] ? V.plain(c[k].href) : '';
            if (inp.value.trim() !== cur) { c[k] = V.link(inp.value, k === 'ebook' ? 'eBook' : 'Paperback'); }
        });
    }
    $('vcLoad').addEventListener('click', load);
    $('vcVol').addEventListener('change', load);
    $('vcAdd').addEventListener('click', function () {
        if (!state) { return; }
        var it = state.issues.filter(function (x) { return x.key === $('vcIssue').value; })[0]; if (!it) { return; }
        collect();
        var c = V.newCard(it, C.coverFile(it.key));
        c.ebook = V.link($('vcEbook').value, 'eBook'); c.paper = V.link($('vcPaper').value, 'Paperback');
        state.cards.push(c); $('vcEbook').value = ''; $('vcPaper').value = '';
        render(); addChoices(); $('vcDirty').hidden = false;
        say('Card for ' + V.plain(c.tag) + ' added at the end. Press SAVE_CARDS to make it live.', 'info');
    });
    $('vcSave').addEventListener('click', function () {
        var g = gh(); if (!g || !state) { return; }
        collect();
        var want = state.cards.map(function (c) { return JSON.parse(JSON.stringify(c)); });
        try { want.forEach(function (c) { [c.ebook, c.paper].forEach(function (b) { if (b && !/^https:\/\/(www\.)?amazon\./.test(V.plain(b.href))) { throw new Error('Links must be Amazon links (https://www.amazon...). Check ' + V.plain(c.tag) + '.'); } }); }); }
        catch (e) { say(e.message, 'err'); return; }
        var b = $('vcSave'); b.disabled = true; say('Saving the volume page...', 'info');
        var r = V.range(want);
        g.update(state.file, function (t) { return V.write(t, want); }, 'Foundry: issue cards on volume ' + state.vol, function (o, n) { V.guard(o, n, want); })
            .then(function () {
                if (!r) { return null; }
                return g.getFile(HUB).then(function (h) {
                    var next = V.setHubRange(h.text, state.vol, r);
                    if (next === h.text) { return null; }
                    V.guardHub(h.text, next);
                    return g.putFile(HUB, next, h.sha, 'Foundry: Dead Drop hub, volume ' + state.vol + ' = issues ' + r.from + '-' + r.to);
                });
            })
            .then(function () { $('vcDirty').hidden = true; say('Saved. The volume page updates in about 1-2 minutes.', 'ok'); load(); })
            .catch(function (e) { say(e.message, 'err'); })
            .then(function () { b.disabled = false; });
    });
    /* open the panel the first time the ISSUES tab is shown */
    $('tabs').addEventListener('click', function (e) {
        var t = e.target.closest('button');
        if (t && t.getAttribute('data-tab') === 'issues' && !state && gh()) { load(); }
    });
})();
