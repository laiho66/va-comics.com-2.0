/* VA COMICS // counts.js
   Volume pages: shows how many messages each issue's discussion has, e.g. DISCUSS [3].
   Reads /api/board/counts (published messages only). If it cannot load, the buttons stay as they are. */
(function () {
    'use strict';
    var links = document.querySelectorAll('a[href^="/media/talk.html?issue="]');
    if (!links.length || !window.fetch) { return; }
    fetch('/api/board/counts?prefix=issue', { cache: 'default' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.counts) { return; }
        Array.prototype.forEach.call(links, function (a) {
            var key = (a.getAttribute('href').split('issue=')[1] || '').split('&')[0], n = j.counts['issue:' + key];
            if (!n || a.querySelector('.vb-cnt')) { return; }
            var s = document.createElement('span'); s.className = 'vb-cnt'; s.textContent = n > 99 ? '99+' : String(n);
            s.setAttribute('aria-label', n + (n === 1 ? ' message' : ' messages'));
            a.appendChild(s);
        });
    }).catch(function () { /* the buttons stay plain */ });
})();

/* Volume pages: the cover and the title of each card open the issue page (/deaddrop/issue-N.html).
   Done here, not in the HTML, so the cards keep the exact shape Foundry VOLUME_CARDS expects.
   New issue page? Add its key to ISSUE_PAGES (same key as in viewer.html?issue=KEY; 11_1 -> issue-11-1.html). */
(function () {
    'use strict';
    var ISSUE_PAGES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11_1', '11_2', '12', '13'];
    var cards = document.querySelectorAll('#issues .card');
    Array.prototype.forEach.call(cards, function (card) {
        var read = card.querySelector('a[href^="/media/viewer.html?issue="]');
        var key = read ? (read.getAttribute('href').split('issue=')[1] || '').split('&')[0] : '';
        if (ISSUE_PAGES.indexOf(key) < 0) { return; }
        var href = '/deaddrop/issue-' + key.replace('_', '-') + '.html';
        var h = card.querySelector('h3'), media = card.querySelector('.media');
        if (h && !h.querySelector('a')) {
            var a = document.createElement('a'); a.href = href; a.style.textDecoration = 'none';
            while (h.firstChild) { a.appendChild(h.firstChild); }
            h.appendChild(a);
        }
        if (media && !media.querySelector('a')) {
            var cover = document.createElement('a'); cover.href = href; cover.setAttribute('aria-label', 'About this issue');
            cover.style.cssText = 'position:absolute;inset:0;z-index:1;';
            media.appendChild(cover);
        }
    });
})();
