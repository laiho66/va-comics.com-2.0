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
