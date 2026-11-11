/* VA COMICS // continue.js  (nov 2026)
   Home: "Continue reading". Shows the Dead Drop issue this browser was reading last, with the page and a
   CONTINUE button. If that issue is finished, it offers the next one instead.
   It only reads what the reader (assets/reader.js) saved in this browser: no server, nothing to maintain.
   The section stays hidden for a first-time visitor, or when there is nothing left to continue. */
(function () {
    'use strict';
    var sec = document.getElementById('continueSec');
    if (!sec) { return; }
    var KEY = /^\d{1,3}(_\d)?$/;
    var s = null;
    try { s = JSON.parse(window.localStorage.getItem('vc_reader_v1')); } catch (e) { return; }
    if (!s || !s.last || !s.p || !s.p[s.last]) { return; }
    var k = String(s.last), p = s.p[k], page = parseInt(p.page, 10), total = parseInt(p.total, 10);
    if (!KEY.test(k) || !(page > 0) || !(total > 0)) { return; }

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function label(key) {
        var a = key.split('_'), n = String(parseInt(a[0], 10));
        return 'Issue #' + (n.length < 2 ? '0' + n : n) + (a[1] ? ' // Part ' + a[1] : '');
    }
    function cover(key) { return '/deaddrop/assets/cover' + key.replace('_', 'p') + '.webp'; }

    var done = page >= total, show = k, title = p.t || '', tag = 'CONTINUE_READING', line, btn = 'CONTINUE', href, pct = 0;
    if (done) {
        if (!p.n || !KEY.test(String(p.n))) { return; }                 /* finished the last available issue: nothing to offer */
        show = String(p.n); title = p.nt || ''; tag = 'NEXT_UP'; btn = 'READ NEXT ISSUE';
        line = 'You finished ' + label(k) + '.';
        href = '/media/viewer.html?issue=' + show;
    } else {
        pct = Math.round(page / total * 100);
        line = 'Page ' + page + ' / ' + total;
        href = '/media/viewer.html?issue=' + show + '&page=' + page;
    }

    var box = el('article', 'card card--row card--static card--band');
    box.style.borderLeft = '3px solid var(--accent)';
    var media = el('div', 'media ratio-2x3'); media.style.cssText = 'flex: 0 0 78px; min-height: 104px;';
    media.appendChild(el('div', 'ph'));
    var im = el('img'); im.alt = ''; im.onerror = function () { im.remove(); }; im.src = cover(show); media.appendChild(im);
    var body = el('div', 'card-body');
    body.style.cssText = 'flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 18px; padding: 18px 22px;';
    var info = el('div', 'stack-sm'); info.style.cssText = 'flex: 1 1 240px; min-width: 0;';
    info.appendChild(el('span', 'tag', tag));
    info.appendChild(el('span', 'h3', 'Dead Drop // ' + label(show) + (title ? ' // ' + String(title).slice(0, 60) : '')));
    info.appendChild(el('span', 'meta', line));
    if (!done) { var bar = el('div', 'progress'), fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill); info.appendChild(bar); }
    var a = el('a', 'btn btn--primary', btn); a.href = href;
    body.appendChild(info); body.appendChild(a);
    box.appendChild(media); box.appendChild(body);
    sec.appendChild(box);
    sec.hidden = false;
})();
