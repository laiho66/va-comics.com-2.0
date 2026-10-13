/* VA COMICS // Foundry v2 // foundry-board.js  (BOARD tab: comments + Q&A moderation)
   Talks to the va-board Worker's admin API (/foundry/api/board/*), which only answers behind Cloudflare Access. */
(function () {
    'use strict';
    var API = '/foundry/api/board/';
    var BOOK_PAGES = { 'sunken-pharaoh': '/vanguard/book1.html' };   /* book id -> public page (add Book 2 here later) */
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    var onSite = /(^|\.)va-comics\.com$/.test(location.hostname);
    var loaded = false;

    function say(msg, kind) { var s = $('status'); if (!s) { return; } s.hidden = !msg; s.textContent = msg || ''; s.className = 'fstatus' + (kind ? ' is-' + kind : ''); }
    function api(path, opts) {
        opts = opts || {}; opts.credentials = 'same-origin'; opts.cache = 'no-store';
        return fetch(API + path, opts).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) {
                    var msg = j.message || ('Error ' + r.status);
                    if (r.status === 403 || r.status === 401) { msg = 'Not logged in for the admin part. Reload the page (Cloudflare Access may ask you to log in again).'; }
                    throw new Error(msg);
                }
                return j;
            });
        });
    }
    function when(sec) { try { return new Date(sec * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
    function label(t) {
        if (t === 'qa') { return 'Q&A'; }
        var m = /^issue:(\d+)(?:_(\d+))?$/.exec(t);
        if (m) { return 'Dead Drop #' + (m[1].length < 2 ? '0' + m[1] : m[1]) + (m[2] ? ' Part ' + m[2] : ''); }
        m = /^book:(.+)$/.exec(t);
        if (m) { return 'Vanguard: ' + m[1].replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
        return t;
    }
    function pageOf(t) {
        if (t === 'qa') { return '/qa.html'; }
        var m = /^issue:(.+)$/.exec(t); if (m) { return '/media/talk.html?issue=' + m[1]; }
        m = /^book:(.+)$/.exec(t); if (m && BOOK_PAGES[m[1]]) { return BOOK_PAGES[m[1]]; }
        return '';
    }

    /* ---------- summary (counts per place) ---------- */
    function loadSummary() {
        return api('summary').then(function (j) {
            var per = {}, wait = 0;
            (j.rows || []).forEach(function (r) {
                per[r.target] = per[r.target] || { pending: 0, approved: 0, rejected: 0 };
                per[r.target][r.status] = r.n;
                if (r.status === 'pending') { wait += r.n; }
            });
            var badge = $('bdBadge'); badge.hidden = !wait; badge.textContent = String(wait);
            /* target filter */
            var sel = $('bdTarget'), cur = sel.value;
            sel.innerHTML = '<option value="">Everywhere</option>';
            Object.keys(per).sort().forEach(function (t) { var o = el('option', '', label(t)); o.value = t; sel.appendChild(o); });
            sel.value = per[cur] ? cur : '';
            /* chips */
            var box = $('bdSum'); box.innerHTML = '';
            var keys = Object.keys(per).sort();
            if (!keys.length) { box.appendChild(el('span', 'hint', 'No messages yet anywhere.')); return; }
            var all = el('button', wait ? 'is-wait' : '', 'WAITING: ' + wait); all.type = 'button';
            all.addEventListener('click', function () { $('bdStatus').value = 'pending'; $('bdTarget').value = ''; loadList(); });
            box.appendChild(all);
            keys.forEach(function (t) {
                var p = per[t], b = el('button', p.pending ? 'is-wait' : '', label(t) + ' · ' + p.approved + ' live' + (p.pending ? ' · ' + p.pending + ' waiting' : ''));
                b.type = 'button';
                b.addEventListener('click', function () { $('bdTarget').value = t; $('bdStatus').value = p.pending ? 'pending' : 'all'; loadList(); });
                box.appendChild(b);
            });
        });
    }

    /* ---------- list ---------- */
    function loadList() {
        var st = $('bdStatus').value, t = $('bdTarget').value, box = $('bdList');
        box.innerHTML = '<p class="hint">Loading...</p>';
        return api('messages?status=' + encodeURIComponent(st) + (t ? '&target=' + encodeURIComponent(t) : '')).then(function (j) {
            render(j.messages || []);
        }).catch(function (e) { box.innerHTML = ''; box.appendChild(el('p', 'hint', e.message)); });
    }
    function render(list) {
        var box = $('bdList'); box.innerHTML = '';
        if (!list.length) { box.appendChild(el('p', 'hint', $('bdStatus').value === 'pending' ? 'Nothing waiting. All clear.' : 'No messages here.')); return; }
        list.forEach(function (m) {
            var row = el('div', 'fitem'), main = el('div', 'fitem-main'), act = el('div', 'fitem-actions');
            var top = el('div', 'bd-meta');
            var where = pageOf(m.target);
            if (where) { var a = el('a', '', label(m.target)); a.href = where; a.target = '_blank'; a.rel = 'noopener'; top.appendChild(a); }
            else { top.appendChild(document.createTextNode(label(m.target))); }
            top.appendChild(document.createTextNode(' · ' + when(m.created)));
            top.appendChild(el('span', 'bd-st is-' + m.status, m.status.toUpperCase()));
            main.appendChild(top);
            main.appendChild(el('b', '', m.nick));
            main.appendChild(el('p', 'bd-body', m.body));
            if (m.status !== 'approved' && m.reason) { main.appendChild(el('span', 'bd-why', 'Why: ' + m.reason + (m.reports ? ' (' + m.reports + ' report' + (m.reports > 1 ? 's' : '') + ')' : ''))); }
            if (m.reply) { main.appendChild(el('div', 'bd-reply', 'VA COMICS: ' + m.reply)); }

            if (m.status !== 'approved') {
                var ok = el('button', 'btn btn--sm btn--primary', 'APPROVE'); ok.type = 'button';
                ok.addEventListener('click', function () { act_(ok, 'messages/' + m.id + '/approve', { method: 'POST' }, 'Approved: it is on the site now.'); });
                act.appendChild(ok);
            }
            var rp = el('button', 'btn btn--sm', m.reply ? 'EDIT_REPLY' : 'REPLY'); rp.type = 'button';
            rp.addEventListener('click', function () {
                if (main.querySelector('.bd-reply-box')) { return; }
                var wrap = el('div', 'bd-reply-box'), ta = document.createElement('textarea'); ta.maxLength = 2000; ta.value = m.reply || ''; ta.placeholder = 'Your answer (shown under the message as VA COMICS). Empty = remove the reply.';
                var r2 = el('div', 'row'), send = el('button', 'btn btn--sm btn--primary', 'SAVE_REPLY'), cancel = el('button', 'btn btn--sm', 'CANCEL');
                send.type = cancel.type = 'button';
                cancel.addEventListener('click', function () { wrap.remove(); });
                send.addEventListener('click', function () {
                    act_(send, 'messages/' + m.id + '/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: ta.value.trim() }) },
                        ta.value.trim() ? (m.status === 'approved' ? 'Reply saved: it is on the site now.' : 'Reply saved. It shows once the message is approved.') : 'Reply removed.');
                });
                r2.appendChild(send); r2.appendChild(cancel); wrap.appendChild(ta); wrap.appendChild(r2); main.appendChild(wrap); ta.focus();
            });
            act.appendChild(rp);
            var del = el('button', 'btn btn--sm btn--danger', 'DELETE'); del.type = 'button';
            del.addEventListener('click', function () {
                if (!confirm('Delete this message from ' + m.nick + ' for good?')) { return; }
                act_(del, 'messages/' + m.id, { method: 'DELETE' }, 'Deleted.');
            });
            act.appendChild(del);
            row.appendChild(main); row.appendChild(act); box.appendChild(row);
        });
    }
    function act_(btn, path, opts, done) {
        btn.disabled = true;
        api(path, opts).then(function () { say(done, 'ok'); return refresh(); })
            .catch(function (e) { say(e.message, 'err'); btn.disabled = false; });
    }
    function refresh() { return loadSummary().catch(function () { /* list shows the error */ }).then(loadList); }

    /* ---------- wiring ---------- */
    if (!onSite) {
        $('bdLocal').hidden = false;
        $('bdList').innerHTML = '<p class="hint">Only on va-comics.com/foundry.</p>';
        $('bdSum').innerHTML = '<span class="hint">Only on va-comics.com/foundry.</span>';
        return;
    }
    $('tabs').addEventListener('click', function (e) {
        var t = e.target.closest('button');
        if (t && t.getAttribute('data-tab') === 'board' && !loaded) { loaded = true; refresh(); }
    });
    $('bdStatus').addEventListener('change', loadList);
    $('bdTarget').addEventListener('change', loadList);
    $('bdReload').addEventListener('click', function (e) { e.preventDefault(); refresh(); });
    /* link from the notification mails: va-comics.com/foundry/#board opens this tab */
    if (location.hash === '#board') { var tb = $('tabs').querySelector('[data-tab="board"]'); if (tb) { tb.click(); } }
    /* show the waiting count on the tab right away */
    loadSummary().catch(function () { /* quiet: not logged in yet or Worker not live */ });
})();
