/* VA COMICS // news.js
   Home page: shows the latest 2 posts from /chronicles.html, automatically.
   Foundry adds new posts at the top of chronicles.html, so nothing else is needed.
   If the page cannot be read, the static "See all news" card stays. */
(function () {
    'use strict';
    var box = document.getElementById('newsList');
    if (!box) { return; }
    var HOW_MANY = 2;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (text) { n.textContent = text; }
        return n;
    }

    fetch('/chronicles.html', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) { throw new Error('no news'); } return r.text(); })
        .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var posts = doc.querySelectorAll('article.chronicle-post');
            if (!posts.length) { throw new Error('no posts'); }
            var out = document.createDocumentFragment();
            for (var i = 0; i < posts.length && i < HOW_MANY; i++) {
                var p = posts[i];
                var title = p.querySelector('.post-title');
                var time = p.querySelector('time');
                var first = p.querySelector('.chronicle-p, .post-body p');
                var excerpt = first ? first.textContent.replace(/\s+/g, ' ').trim() : '';
                if (excerpt.length > 150) { excerpt = excerpt.slice(0, 147).replace(/\s+\S*$/, '') + '...'; }

                var a = el('a', 'card');
                a.href = '/chronicles.html' + (p.id ? '#' + p.id : '');
                var body = el('div', 'card-body');
                var stack = el('div', 'stack');
                stack.appendChild(el('span', 'tag', 'REPORT_LOG // ' + (time ? time.textContent.trim() : '')));
                stack.appendChild(el('h3', 'h3', title ? title.textContent.trim() : 'Field report'));
                if (excerpt) { stack.appendChild(el('p', 'small', excerpt)); }
                body.appendChild(stack);
                body.appendChild(el('span', 'meta', '[ READ ]'));
                a.appendChild(body);
                out.appendChild(a);
            }
            box.innerHTML = '';
            box.appendChild(out);
        })
        .catch(function () { /* keep the static fallback */ });
})();
