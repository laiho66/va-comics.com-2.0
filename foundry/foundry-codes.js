/* VA COMICS // Foundry v2 // foundry-codes.js  (READER CODES tab, Reading Room R3)
   Talks to the guard Worker's admin API (/foundry/api/reader/*), which only answers when you are logged in
   through Cloudflare Access. Codes never touch GitHub. */
(function () {
    'use strict';
    var API = '/foundry/api/reader/';
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    var onSite = /(^|\.)va-comics\.com$/.test(location.hostname);
    var loaded = false;

    function say(msg, kind) {
        var s = $('status'); if (!s) { return; }
        s.hidden = !msg; s.textContent = msg || ''; s.className = 'fstatus' + (kind ? ' is-' + kind : '');
    }
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
    function fmt(sec) { try { return new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
    function copy(text, what) {
        var done = function () { say(what + ' copied.', 'ok'); };
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { say('Copy failed: select it and press Ctrl+C.', 'err'); }); }
        else { say('Select it and press Ctrl+C.', 'info'); }
    }
    function message(c) {
        return 'Hi ' + c.label + '! Here is your code for the VA Comics Reading Room: ' + c.code + '\n\n' +
            'Open https://va-comics.com/media/reader and enter the code. It works until ' + fmt(c.expires) +
            ' on up to 2 of your devices.\n\nEnjoy The Sunken Pharaoh! Please keep the code for yourself.';
    }

    /* ---------- list ---------- */
    function load() {
        if (!onSite) { return; }
        var box = $('rcList'); box.innerHTML = ''; box.appendChild(el('p', 'hint', 'Loading...'));
        api('codes').then(function (j) {
            loaded = true; box.innerHTML = '';
            if (!j.codes.length) { box.appendChild(el('p', 'hint', 'No codes yet.')); return; }
            j.codes.forEach(function (c) {
                var state = c.revoked ? 'revoked' : (c.expires <= j.now ? 'expired' : 'active');
                var row = el('div', 'fitem'), main = el('div', 'fitem-main'), act = el('div', 'fitem-actions');
                var top = el('b'); top.appendChild(el('span', 'rc-codeline', c.code)); top.appendChild(document.createTextNode('  //  ' + c.label));
                main.appendChild(top);
                var left = Math.ceil((c.expires - j.now) / 86400);
                var meta = el('span', 'meta', (state === 'active' ? 'until ' + fmt(c.expires) + ' (' + left + ' day' + (left === 1 ? '' : 's') + ' left)' : 'ended ' + fmt(c.expires)) +
                    '  //  devices ' + (c.devices || 0) + '/2' + (c.lastUsed ? '  //  last opened ' + fmt(c.lastUsed) : '  //  not used yet'));
                main.appendChild(meta);
                var st = el('span', 'rc-state is-' + state, state.toUpperCase()); main.appendChild(st);
                if (state === 'active') {
                    var bm = el('button', 'btn btn--sm', 'COPY_MESSAGE'); bm.type = 'button';
                    bm.addEventListener('click', function () { copy(message(c), 'Message'); });
                    var br = el('button', 'btn btn--sm btn--danger', 'REVOKE'); br.type = 'button';
                    br.addEventListener('click', function () { revoke(c, br); });
                    act.appendChild(bm); act.appendChild(br);
                }
                var bd = el('button', 'btn btn--sm btn--danger', 'DELETE'); bd.type = 'button';
                bd.addEventListener('click', function () { del(c, bd); });
                act.appendChild(bd);
                row.appendChild(main); row.appendChild(act); box.appendChild(row);
            });
        }).catch(function (e) { box.innerHTML = ''; box.appendChild(el('p', 'hint', e.message)); });
    }
    function revoke(c, btn) {
        if (!confirm('Revoke ' + c.code + ' (' + c.label + ')? The book closes for this code right away.')) { return; }
        btn.disabled = true;
        api('codes/' + c.code + '/revoke', { method: 'POST' }).then(function () { say(c.code + ' revoked.', 'ok'); load(); })
            .catch(function (e) { say(e.message, 'err'); btn.disabled = false; });
    }
    function del(c, btn) {
        if (!confirm('Delete ' + c.code + ' (' + c.label + ') from the list? It stops working too.')) { return; }
        btn.disabled = true;
        api('codes/' + c.code, { method: 'DELETE' }).then(function () { say(c.code + ' deleted.', 'ok'); load(); })
            .catch(function (e) { say(e.message, 'err'); btn.disabled = false; });
    }

    /* ---------- new code ---------- */
    $('rcGo').addEventListener('click', function () {
        if (!onSite) { say('Reader codes work only on va-comics.com/foundry.', 'err'); return; }
        var label = $('rcLabel').value.trim(), days = parseInt($('rcDays').value, 10);
        if (!label) { say('Write who the code is for (name or @handle). It appears in the watermark.', 'err'); $('rcLabel').focus(); return; }
        if (!(days >= 1 && days <= 365)) { say('Days must be between 1 and 365.', 'err'); return; }
        var b = $('rcGo'); b.disabled = true; say('Working...', 'info');
        api('codes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: label, days: days, book: $('rcBook').value }) })
            .then(function (c) {
                $('rcResult').hidden = false; $('rcCode').textContent = c.code; $('rcMsg').value = message(c);
                $('rcCopyCode').onclick = function () { copy(c.code, 'Code'); };
                $('rcCopyMsg').onclick = function () { copy($('rcMsg').value, 'Message'); };
                $('rcLabel').value = '';
                say('Code ' + c.code + ' for ' + c.label + ' is ready (until ' + fmt(c.expires) + ').', 'ok');
                load();
            }).catch(function (e) { say(e.message, 'err'); })
            .then(function () { b.disabled = false; });
    });
    $('rcReload').addEventListener('click', function (e) { e.preventDefault(); load(); });

    /* load the list the first time the tab is opened */
    $('tabs').addEventListener('click', function (e) {
        var t = e.target.closest('button');
        if (t && t.getAttribute('data-tab') === 'codes' && !loaded) { load(); }
    });
    if (!onSite) { $('rcLocal').hidden = false; $('rcGo').disabled = true; $('rcList').innerHTML = '<p class="hint">Only on va-comics.com/foundry.</p>'; }
})();
