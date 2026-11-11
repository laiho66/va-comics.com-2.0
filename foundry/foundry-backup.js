/* Foundry BACKUP (bk1, 2026-11-12)
   Un singur fisier JSON cu tot ce traieste DOAR in Cloudflare (nu in repo):
   mesajele de pe board (D1 va-board), codurile + biblioteca Reading Room (KV), arhiva si limitele MALAKH (D1 va-malakh).
   Doar citeste, prin API-urile de admin care exista deja. Nu scrie nimic nicaieri.
   Cartile (R2 privat) si paginile de comic (R2 public) NU intra aici. */
(function () {
    'use strict';

    function get(path) {
        return fetch(path, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) { throw new Error(path + ' -> ' + r.status); }
            return r.json();
        });
    }

    function collect() {
        var out = { kind: 'va-comics-backup', version: 1, made: new Date().toISOString(), board: null, reader: null, malakh: null, problems: [] };
        function part(name, p) {
            return p.then(function (v) { out[name] = v; }).catch(function (e) { out.problems.push(name + ': ' + e.message); });
        }
        var board = get('/foundry/api/board/messages?status=all').then(function (j) {
            var m = j.messages || [];
            if (m.length >= 300) { out.problems.push('board: the list stops at 300 messages, older ones are not in this file'); }
            return { messages: m };
        });
        var reader = Promise.all([get('/foundry/api/reader/codes'), get('/foundry/api/reader/library')]).then(function (a) {
            return { codes: a[0].codes || [], library: a[1].books || [] };
        });
        var parts = ['core', 'vanguard', 'deaddrop', 'spoilers'];
        var malakh = Promise.all([get('/foundry/api/malakh/status')].concat(parts.map(function (k) { return get('/foundry/api/malakh/kb/' + k); }))).then(function (a) {
            var kb = {};
            a.slice(1).forEach(function (x, i) { kb[parts[i]] = { body: x.body || '', updated: x.updated || null }; });
            return { settings: a[0].settings || {}, kb: kb };
        });
        return Promise.all([part('board', board), part('reader', reader), part('malakh', malakh)]).then(function () { return out; });
    }

    function summary(o) {
        var bits = [];
        bits.push(o.board ? o.board.messages.length + ' board messages' : 'board MISSING');
        bits.push(o.reader ? o.reader.codes.length + ' reader codes, ' + o.reader.library.length + ' books in the library' : 'reader MISSING');
        bits.push(o.malakh ? Object.keys(o.malakh.kb).length + ' MALAKH archive parts' : 'MALAKH MISSING');
        return bits.join(' / ') + (o.problems.length ? ' // PROBLEMS: ' + o.problems.join('; ') : '');
    }

    function download(o) {
        var blob = new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'va-comics-backup-' + o.made.slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }

    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text) { e.textContent = text; } return e; }

    function mount() {
        var tab = document.getElementById('tab-settings');
        if (!tab || document.getElementById('btnBackup')) { return; }
        var panel = el('div', 'panel'); panel.setAttribute('data-label', 'BACKUP // EXPORT');
        var stack = el('div', 'stack');
        stack.appendChild(el('p', 'hint', 'One JSON file with what lives only in Cloudflare: board messages, reader codes and library, MALAKH archive and limits. It contains reader codes, so keep it private. Books and comic pages are not included.'));
        var btn = el('button', 'btn btn--primary', 'DOWNLOAD_BACKUP'); btn.type = 'button'; btn.id = 'btnBackup';
        var note = el('p', 'hint', ''); note.id = 'backupNote';
        btn.addEventListener('click', function () {
            btn.disabled = true; note.textContent = 'Collecting...';
            collect().then(function (o) { download(o); note.textContent = 'Saved: ' + summary(o); })
                .catch(function (e) { note.textContent = 'Backup failed: ' + e.message; })
                .then(function () { btn.disabled = false; });
        });
        stack.appendChild(btn); stack.appendChild(note); panel.appendChild(stack); tab.appendChild(panel);
    }

    window.FoundryBackup = { collect: collect, summary: summary };
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mount); } else { mount(); }
})();
