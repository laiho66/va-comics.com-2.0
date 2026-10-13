/* VA COMICS // Comments + Q&A widget (assets/board.js)
   Any element <div class="vboard" data-target="issue:13|book:sunken-pharaoh|qa" data-kind="comments|qa"></div>
   becomes a message board. Messages go through the va-board Worker (/api/board/*): English only, clean ones appear
   at once, doubtful ones wait for a review in Foundry. No account, no email.
   In the comic reader (media/viewer) it adds a DISCUSS button to the end-of-issue screen (the reader code is untouched). */
(function () {
    'use strict';
    var SITEKEY = '0x4AAAAAAFVu_xnbGtwUMwWX';       /* public Turnstile site key (safe to publish) */
    var API = '/api/board/';
    var MAX = 1000;

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } }
    function when(sec) {
        var s = Math.max(1, Math.floor(Date.now() / 1000 - sec));
        if (s < 3600) { return Math.max(1, Math.round(s / 60)) + ' min ago'; }
        if (s < 86400) { return Math.round(s / 3600) + ' h ago'; }
        try { return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
    }
    function api(path, opts) {
        opts = opts || {}; opts.credentials = 'same-origin';
        return fetch(API + path, opts).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) { var e = new Error(j.message || 'Something went wrong. Try again.'); e.status = r.status; throw e; }
                return j;
            });
        });
    }

    /* ---------- Turnstile (invisible anti-bot), loaded once ---------- */
    var tsReady = null;
    function turnstile() {
        if (tsReady) { return tsReady; }
        tsReady = new Promise(function (res, rej) {
            if (window.turnstile) { res(window.turnstile); return; }
            var s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            s.async = true; s.onload = function () { res(window.turnstile); }; s.onerror = function () { tsReady = null; rej(new Error('The anti-bot check could not load. Check your connection or ad blocker.')); };
            document.head.appendChild(s);
        });
        return tsReady;
    }

    /* ---------- one board ---------- */
    function Board(root) {
        var target = root.getAttribute('data-target'), qa = root.getAttribute('data-kind') === 'qa';
        var words = qa ? { title: 'Questions & answers', empty: 'No questions yet. Ask the first one.', field: 'Your question', btn: 'ASK', count: 'questions' }
                       : { title: 'Comments', empty: 'No comments yet. Be the first.', field: 'Your comment', btn: 'POST_COMMENT', count: 'comments' };
        root.innerHTML = '';
        var head = el('h2', 'section-label'); head.appendChild(el('span', '', words.title)); var cnt = el('span', 'meta vb-count', ''); head.appendChild(cnt); root.appendChild(head);

        /* form */
        var form = el('form', 'vb-form'); form.setAttribute('autocomplete', 'off');
        var row = el('div', 'vb-row');
        var nick = el('input', 'vb-nick'); nick.type = 'text'; nick.maxLength = 24; nick.placeholder = 'Nickname'; nick.setAttribute('aria-label', 'Nickname'); nick.value = load('vb_nick', '');
        row.appendChild(nick); form.appendChild(row);
        var area = el('textarea', 'vb-body'); area.maxLength = MAX; area.placeholder = words.field + ' (English only)'; area.setAttribute('aria-label', words.field); area.rows = 3;
        form.appendChild(area);
        var foot = el('div', 'vb-foot');
        var rules = el('span', 'vb-rules', 'English only · no swearing, sexual, religious or hateful content · see the board rules in our ');
        var a = el('a', '', 'Terms'); a.href = '/legal.html#terms'; rules.appendChild(a); rules.appendChild(document.createTextNode('.'));
        var left = el('span', 'meta vb-left', MAX + '');
        var btn = el('button', 'btn btn--primary btn--sm', words.btn); btn.type = 'submit';
        foot.appendChild(rules); foot.appendChild(left); foot.appendChild(btn); form.appendChild(foot);
        var ts = el('div', 'vb-ts'); form.appendChild(ts);
        var msg = el('p', 'vb-msg'); msg.hidden = true; form.appendChild(msg);
        root.appendChild(form);

        var listBox = el('div', 'vb-list'); root.appendChild(listBox);

        area.addEventListener('input', function () { left.textContent = String(MAX - area.value.length); });
        ['keydown', 'keyup', 'keypress'].forEach(function (t) { form.addEventListener(t, function (e) { e.stopPropagation(); }); });   /* typing never turns comic pages */

        var widgetId = null, token = '';
        function ensureWidget() {
            if (widgetId !== null) { return Promise.resolve(); }
            return turnstile().then(function (T) {
                widgetId = T.render(ts, { sitekey: SITEKEY, appearance: 'interaction-only', theme: 'dark', size: 'flexible',
                    callback: function (t) { token = t; }, 'expired-callback': function () { token = ''; }, 'error-callback': function () { token = ''; } });
            });
        }
        area.addEventListener('focus', function () { ensureWidget().catch(function (e) { say(e.message, 'err'); }); }, { once: true });
        nick.addEventListener('focus', function () { ensureWidget().catch(function () { /* shown on submit */ }); }, { once: true });

        function say(text, kind) { msg.hidden = !text; msg.textContent = text || ''; msg.className = 'vb-msg' + (kind ? ' is-' + kind : ''); }
        function waitToken(ms) {
            return new Promise(function (res) {
                var t0 = Date.now();
                (function check() { if (token || Date.now() - t0 > ms) { res(token); } else { setTimeout(check, 200); } })();
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var n = nick.value.trim(), b = area.value.trim();
            if (!/^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,22}[A-Za-z0-9_]$/.test(n)) { say('Nickname: 3 to 24 English letters or digits.', 'err'); nick.focus(); return; }
            if (b.length < 3) { say('Write a bit more.', 'err'); area.focus(); return; }
            btn.disabled = true; say('Sending...', 'info');
            ensureWidget().then(function () { return waitToken(8000); }).then(function (t) {
                return api('post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: target, nick: n, body: b, token: t }) });
            }).then(function (j) {
                save('vb_nick', n);
                if (j.status === 'published') { area.value = ''; left.textContent = String(MAX); say('Posted. Thanks!', 'ok'); render([j.message].concat(items), true); }
                else if (j.status === 'pending') { area.value = ''; left.textContent = String(MAX); say(j.message, 'info'); }
                else { say(j.message, 'err'); }
            }).catch(function (err) { say(err.message, 'err'); })
              .then(function () {
                  btn.disabled = false; token = '';
                  try { if (window.turnstile && widgetId !== null) { window.turnstile.reset(widgetId); } } catch (x) { /* ignore */ }
              });
        });

        /* list */
        var items = [];
        function render(list) {
            items = list; listBox.innerHTML = '';
            cnt.textContent = list.length ? ' ' + list.length + ' ' + (list.length === 1 ? words.count.replace(/s$/, '') : words.count) : '';
            if (!list.length) { listBox.appendChild(el('p', 'hint vb-empty', words.empty)); return; }
            list.forEach(function (m) {
                var it = el('article', 'vb-item');
                var top = el('div', 'vb-top'); top.appendChild(el('b', 'vb-who', m.nick)); top.appendChild(el('span', 'meta', when(m.created)));
                var rep = el('button', 'vb-report', 'REPORT'); rep.type = 'button'; rep.title = 'Report this message';
                rep.addEventListener('click', function () {
                    if (!confirm('Report this message? It will be hidden until we check it.')) { return; }
                    api('report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
                        .then(function () { it.remove(); }).catch(function (e) { alert(e.message); });
                });
                top.appendChild(rep); it.appendChild(top);
                it.appendChild(el('p', 'vb-text', m.body));
                if (m.reply) {
                    var r = el('div', 'vb-reply'); r.appendChild(el('span', 'tag', 'VA COMICS')); r.appendChild(el('p', 'vb-text', m.reply)); it.appendChild(r);
                }
                listBox.appendChild(it);
            });
        }
        listBox.appendChild(el('p', 'meta', 'LOADING...'));
        fetch(API + 'list?target=' + encodeURIComponent(target)).then(function (r) { return r.json(); })
            .then(function (j) { render(j.messages || []); })
            .catch(function () { listBox.innerHTML = ''; listBox.appendChild(el('p', 'hint', 'Messages could not load right now.')); });
    }

    function mountAll() { Array.prototype.forEach.call(document.querySelectorAll('.vboard[data-target]'), function (n) { if (!n.getAttribute('data-ready')) { n.setAttribute('data-ready', '1'); Board(n); } }); }

    /* ---------- comic reader: DISCUSS button on the end-of-issue screen ---------- */
    function readerHook() {
        var end = document.getElementById('rEnd');
        if (!end || !window.MutationObserver) { return; }
        new MutationObserver(function () {
            var box = end.querySelector('.notice');
            if (!box || box.querySelector('.vb-discuss')) { return; }
            var m = /ISSUE\s*#?\s*(\d+)(?:\s*\/\/\s*PART\s*(\d+))?/i.exec(box.getAttribute('data-label') || '');
            if (!m) { return; }
            var key = String(parseInt(m[1], 10)) + (m[2] ? '_' + m[2] : '');
            var a = el('a', 'btn btn--block vb-discuss', 'DISCUSS THIS ISSUE'); a.href = '/media/talk.html?issue=' + key;
            box.insertBefore(a, box.children[1] || null);
        }).observe(end, { childList: true, subtree: true });
    }

    /* ---------- talk page (/media/talk.html?issue=13) ---------- */
    function talkPage() {
        var root = document.getElementById('vbTalk'); if (!root) { return; }
        var key = (new URLSearchParams(location.search).get('issue') || '').replace(/[^0-9_]/g, '');
        if (!/^\d{1,3}(_\d{1,2})?$/.test(key)) { root.innerHTML = '<p class="hint">Unknown issue. <a href="/media/viewer.html">Back to the reader</a>.</p>'; return; }
        var p = key.split('_'), label = 'Issue #' + (p[0].length < 2 ? '0' + p[0] : p[0]) + (p[1] ? ' Part ' + p[1] : '');
        document.title = 'Discuss ' + label + ' // Dead Drop // VA Comics';
        var h = document.getElementById('vbTalkTitle'); if (h) { h.textContent = 'Dead Drop // ' + label; }
        var r = document.getElementById('vbTalkRead'); if (r) { r.href = '/media/viewer.html'; }
        root.setAttribute('data-target', 'issue:' + key);
    }

    function start() { talkPage(); mountAll(); readerHook(); }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
