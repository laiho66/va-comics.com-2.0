/* VA COMICS // latest.js
   Home: "From the board" = the last 3 published messages from readers, each with a link to where it was written.
   The section stays hidden when there is nothing to show (or the board cannot be reached). */
(function () {
    'use strict';
    var box = document.getElementById('boardLatest'), sec = document.getElementById('boardLatestSec');
    if (!box || !sec || !window.fetch) { return; }
    var BOOKS = { 'sunken-pharaoh': ['/vanguard/book1.html', 'The Sunken Pharaoh'], 'jade-seal-of-leyre': ['/vanguard/book2.html', 'The Jade Seal of Leyre'] };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function place(t) {
        if (t === 'qa') { return ['/qa.html', 'Q&A']; }
        var m = /^issue:(\d+)(?:_(\d+))?$/.exec(t);
        if (m) { return ['/media/talk.html?issue=' + m[1] + (m[2] ? '_' + m[2] : ''), 'Dead Drop #' + (m[1].length < 2 ? '0' + m[1] : m[1]) + (m[2] ? ' Part ' + m[2] : '')]; }
        m = /^book:(.+)$/.exec(t);
        if (m && BOOKS[m[1]]) { return [BOOKS[m[1]][0], 'Vanguard: ' + BOOKS[m[1]][1]]; }
        return null;
    }
    function ago(sec) {
        var d = Math.floor(Date.now() / 1000) - sec;
        if (d < 3600) { return Math.max(1, Math.round(d / 60)) + ' min ago'; }
        if (d < 86400) { return Math.round(d / 3600) + ' h ago'; }
        if (d < 172800) { return 'yesterday'; }
        if (d < 30 * 86400) { return Math.round(d / 86400) + ' days ago'; }
        return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    fetch('/api/board/latest?n=3').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var list = (j && j.messages || []).filter(function (m) { return place(m.target); });
        if (!list.length) { return; }
        list.forEach(function (m) {
            var p = place(m.target), it = el('article', 'vb-item'), top = el('div', 'vb-top');
            top.appendChild(el('b', 'vb-who', m.nick)); top.appendChild(el('span', 'meta', ago(m.created)));
            it.appendChild(top);
            it.appendChild(el('p', 'vb-text', m.body + (m.len > 220 ? '…' : '')));
            var w = el('p', 'vb-where'); w.appendChild(document.createTextNode('on '));
            var a = el('a', '', p[1] + ' →'); a.href = p[0]; w.appendChild(a); it.appendChild(w);
            box.appendChild(it);
        });
        sec.hidden = false;
    }).catch(function () { /* stays hidden */ });
})();
