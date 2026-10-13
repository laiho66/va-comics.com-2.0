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

    /* ---------- are you the studio? (logged in to Foundry through Cloudflare Access) ---------- */
    var STAFF = false;
    function checkStaff() {
        return fetch('/foundry/api/board/whoami', { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { STAFF = !!(j && j.ok); }).catch(function () { STAFF = false; });
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

    /* ---------- one form (the main one, or a small one under a conversation) ---------- */
    function Form(target, words, parent, onDone) {
        var form = el('form', 'vb-form' + (parent ? ' vb-form--reply' : '') + (STAFF ? ' is-staff' : '')); form.setAttribute('autocomplete', 'off');
        var mention = '', replyTo = 0;
        var row = el('div', 'vb-row');
        var nick = el('input', 'vb-nick'); nick.type = 'text'; nick.maxLength = 24; nick.placeholder = 'Nickname'; nick.setAttribute('aria-label', 'Nickname'); nick.value = load('vb_nick', '');
        if (STAFF) { nick.hidden = true; row.appendChild(el('span', 'tag', 'POSTING AS VA COMICS')); }
        row.appendChild(nick);
        var to = el('span', 'vb-to'); to.hidden = true; row.appendChild(to);
        form.appendChild(row);
        form._mention = function (who, id) {
            mention = who || ''; replyTo = id || 0; to.hidden = !mention; to.innerHTML = '';
            if (mention) {
                to.appendChild(document.createTextNode('Replying to ' + (mention === 'VA Comics' ? 'VA COMICS' : mention) + ' '));
                var x = el('button', 'vb-to-x', '×'); x.type = 'button'; x.title = 'Reply to the conversation instead';
                x.addEventListener('click', function () { form._mention(''); }); to.appendChild(x);
            }
        };
        var area = el('textarea', 'vb-body'); area.maxLength = MAX; area.placeholder = (parent ? 'Your reply' : words.field) + ' (English only)'; area.setAttribute('aria-label', parent ? 'Your reply' : words.field); area.rows = parent ? 2 : 3;
        form.appendChild(area);
        var foot = el('div', 'vb-foot');
        var rules = el('span', 'vb-rules', 'English only · no swearing, sexual, religious or hateful content · see the board rules in our ');
        var a = el('a', '', 'Terms'); a.href = '/legal.html#terms'; rules.appendChild(a); rules.appendChild(document.createTextNode('.'));
        var left = el('span', 'meta vb-left', MAX + '');
        var label = parent ? 'REPLY' : words.btn;
        var btn = el('button', 'btn btn--primary btn--sm', label); btn.type = 'submit';
        foot.appendChild(rules); foot.appendChild(left);
        if (parent) { var cancel = el('button', 'btn btn--sm', 'CANCEL'); cancel.type = 'button'; cancel.addEventListener('click', function () { form.remove(); }); foot.appendChild(cancel); }
        foot.appendChild(btn); form.appendChild(foot);
        var ts = el('div', 'vb-ts'); form.appendChild(ts);
        var msg = el('p', 'vb-msg'); msg.hidden = true; form.appendChild(msg);

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
        function say(text, kind) { msg.hidden = !text; msg.textContent = text || ''; msg.className = 'vb-msg' + (kind ? ' is-' + kind : ''); }
        area.addEventListener('focus', function () { if (!STAFF) { ensureWidget().catch(function (e) { say(e.message, 'err'); }); } }, { once: true });
        nick.addEventListener('focus', function () { ensureWidget().catch(function () { /* shown on submit */ }); }, { once: true });
        function waitToken(ms) {
            return new Promise(function (res) {
                var t0 = Date.now();
                (function check() { if (token || Date.now() - t0 > ms) { res(token); } else { setTimeout(check, 200); } })();
            });
        }
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var n = nick.value.trim(), b = area.value.trim();
            if (STAFF) {
                if (!b) { say('Write the message first.', 'err'); area.focus(); return; }
                btn.disabled = true; say('Sending...', 'info');
                fetch('/foundry/api/board/post', { method: 'POST', credentials: 'same-origin', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: target, body: b, parent: parent || 0, reply_to: replyTo }) })
                    .then(function (r) { if (!r.ok) { throw new Error(r.type === 'opaqueredirect' || r.status === 403 ? 'Your Foundry login expired. Open va-comics.com/foundry, log in, then reload this page.' : 'Could not post. Try again.'); } return r.json(); })
                    .then(function (j) { area.value = ''; left.textContent = String(MAX); say('Posted as VA COMICS.', 'ok'); form._mention(''); onDone(j.message); })
                    .catch(function (err) { say(err.message, 'err'); })
                    .then(function () { btn.disabled = false; });
                return;
            }
            if (!/^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,22}[A-Za-z0-9_]$/.test(n)) { say('Nickname: 3 to 24 English letters or digits.', 'err'); nick.focus(); return; }
            if (b.length < 3) { say('Write a bit more.', 'err'); area.focus(); return; }
            btn.disabled = true; say('Sending...', 'info');
            var needHuman = false;
            ensureWidget().then(function () { return waitToken(token ? 0 : 6000); }).then(function (t) {
                if (!t) { needHuman = true; return null; }     /* Turnstile wants a click: do not send, ask for it */
                return api('post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: target, nick: n, body: b, token: t, parent: parent || 0, reply_to: replyTo }) });
            }).then(function (j) {
                if (needHuman) { say('Almost there: tick the "Verify you are human" box below, then press ' + label + ' again.', 'info'); return; }
                save('vb_nick', n);
                if (j.status === 'published') { area.value = ''; left.textContent = String(MAX); say('Posted. Thanks!', 'ok'); form._mention(''); onDone(j.message); }
                else if (j.status === 'pending') { area.value = ''; left.textContent = String(MAX); say(j.message, 'info'); form._mention(''); }
                else { say(j.message, 'err'); }
            }).catch(function (err) { say(err.message, 'err'); })
              .then(function () {
                  btn.disabled = false;
                  if (needHuman) { return; }                      /* keep the widget as it is, the reader ticks it */
                  token = '';
                  try { if (window.turnstile && widgetId !== null) { window.turnstile.reset(widgetId); } } catch (x) { /* ignore */ }
              });
        });
        form._focus = function () { (nick.value || STAFF ? area : nick).focus(); };
        return form;
    }

    /* ---------- one board ---------- */
    function Board(root) {
        var target = root.getAttribute('data-target'), qa = root.getAttribute('data-kind') === 'qa';
        var words = qa ? { title: 'Questions & answers', empty: 'No questions yet. Ask the first one.', field: 'Your question', btn: 'ASK', count: 'questions' }
                       : { title: 'Comments', empty: 'No comments yet. Be the first.', field: 'Your comment', btn: 'POST_COMMENT', count: 'comments' };
        root.innerHTML = '';
        var head = el('h2', 'section-label'); head.appendChild(el('span', '', words.title)); var cnt = el('span', 'meta vb-count', ''); head.appendChild(cnt); root.appendChild(head);
        var items = [];
        root.appendChild(Form(target, words, 0, function (m) { render([m].concat(items)); }));
        var listBox = el('div', 'vb-list'); root.appendChild(listBox);

        function reportBtn(m, node) {
            var rep = el('button', 'vb-report', 'REPORT'); rep.type = 'button'; rep.title = 'Report this message';
            rep.addEventListener('click', function () {
                if (!confirm('Report this message? It will be hidden until we check it.')) { return; }
                api('report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
                    .then(function () { node.remove(); }).catch(function (e) { alert(e.message); });
            });
            return rep;
        }
        function line(m, node, onReply) {
            var top = el('div', 'vb-top');
            if (m.staff) { top.appendChild(el('span', 'tag', 'VA COMICS')); } else { top.appendChild(el('b', 'vb-who', m.nick)); }
            top.appendChild(el('span', 'meta', when(m.created)));
            var tools = el('span', 'vb-tools');
            var rb = el('button', 'vb-replybtn', 'REPLY'); rb.type = 'button'; rb.addEventListener('click', onReply); tools.appendChild(rb);
            if (!m.staff && !STAFF) { tools.appendChild(reportBtn(m, node)); }
            top.appendChild(tools);
            return top;
        }
        function body(text, names) {      /* "@Name rest" -> the @Name in accent (only names that are in the conversation) */
            var p = el('p', 'vb-text'), hit = '';
            (names || []).slice().sort(function (a, b) { return b.length - a.length; }).some(function (n) { if (text.indexOf('@' + n + ' ') === 0) { hit = n; return true; } return false; });
            if (hit) { p.appendChild(el('span', 'vb-at', '@' + hit)); p.appendChild(document.createTextNode(' ' + text.slice(hit.length + 2))); }
            else { p.textContent = text; }
            return p;
        }
        function thread(m) {
            var it = el('article', 'vb-item'), form = null, nodes = {};
            var count = el('span', 'meta vb-n');
            function setCount() { var n = (m.replies || []).length; count.textContent = n ? n + (n === 1 ? ' reply' : ' replies') : ''; }
            function names() { return ['VA Comics', m.nick].concat((m.replies || []).map(function (x) { return x.nick; })); }
            function openReply(x) {
                if (!form || !form.isConnected) {
                    form = Form(target, words, m.id, function (y) { m.replies = (m.replies || []).concat([y]); addSub(y); setCount(); });
                    it.appendChild(form);
                }
                form._mention(x.staff ? 'VA Comics' : x.nick, x.id); form._focus();
            }
            function find(id) { if (id === m.id) { return m; } var f = null; (m.replies || []).some(function (x) { if (x.id === id) { f = x; return true; } return false; }); return f; }
            function quote(x) {      /* "↳ Boby: Congrats! Kudos!…" - who and what this reply answers; click = jump there */
                var q = el('button', 'vb-quote'); q.type = 'button';
                var o = find(x.reply_to);
                if (!o) { q.textContent = '\u21b3 a removed message'; q.disabled = true; return q; }
                var txt = o.body; names().some(function (n) { if (txt.indexOf('@' + n + ' ') === 0) { txt = txt.slice(n.length + 2); return true; } return false; });
                q.appendChild(document.createTextNode('\u21b3 '));
                q.appendChild(el('b', '', o.staff ? 'VA COMICS' : o.nick));
                q.appendChild(document.createTextNode(': ' + (txt.length > 70 ? txt.slice(0, 70).replace(/\s+\S*$/, '') + '\u2026' : txt)));
                q.title = 'Show the message this answers';
                q.addEventListener('click', function () {
                    var n = nodes[o.id]; if (!n) { return; }
                    n.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    n.classList.remove('is-flash'); void n.offsetWidth; n.classList.add('is-flash');
                });
                return q;
            }
            nodes[m.id] = it;
            it.appendChild(line(m, it, function () { openReply(m); }));
            it.appendChild(body(m.body, []));
            if (m.reply) {      /* the studio's first answer (before conversations existed) */
                var r = el('div', 'vb-reply'); r.appendChild(el('span', 'tag', 'VA COMICS')); r.appendChild(el('p', 'vb-text', m.reply)); it.appendChild(r);
            }
            var subs = el('div', 'vb-replies'); it.appendChild(subs);
            function addSub(x) {
                var sub = el('div', 'vb-sub' + (x.staff ? ' is-staff' : '')); nodes[x.id] = sub;
                sub.appendChild(line(x, sub, function () { openReply(x); }));
                var txt = x.body;
                if (x.reply_to) {     /* the quote line already says who it answers: drop the leading @name */
                    sub.appendChild(quote(x));
                    names().some(function (n) { if (txt.indexOf('@' + n + ' ') === 0) { txt = txt.slice(n.length + 2); return true; } return false; });
                    sub.appendChild(el('p', 'vb-text', txt));
                } else { sub.appendChild(body(txt, names())); }
                subs.appendChild(sub);
            }
            (m.replies || []).forEach(addSub);
            setCount(); it.appendChild(count);
            return it;
        }
        function render(list) {
            items = list; listBox.innerHTML = '';
            cnt.textContent = list.length ? ' ' + list.length + ' ' + (list.length === 1 ? words.count.replace(/s$/, '') : words.count) : '';
            if (!list.length) { listBox.appendChild(el('p', 'hint vb-empty', words.empty)); return; }
            list.forEach(function (m) { listBox.appendChild(thread(m)); });
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
        var r = document.getElementById('vbTalkRead'); if (r) { r.href = '/media/viewer.html?issue=' + key; r.textContent = 'READ_ISSUE_#' + (p[0].length < 2 ? '0' + p[0] : p[0]) + (p[1] ? '_PART_' + p[1] : ''); }
        var v = document.getElementById('vbTalkVol'), n = parseInt(p[0], 10);
        if (v) { var vol = n <= 8 ? 1 : 2; v.href = '/deaddrop/vol' + vol + '.html'; v.innerHTML = '&larr; ALL_ISSUES // VOL_' + vol; }   /* Vol 1 = #1-8, Vol 2 = #9 and up (add Vol 3 here when it exists) */
        root.setAttribute('data-target', 'issue:' + key);
    }

    function start() { talkPage(); readerHook(); checkStaff().then(mountAll); }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
