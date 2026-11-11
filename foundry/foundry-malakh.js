/* VA COMICS // Foundry v2 // foundry-malakh.js  (MALAKH tab, M4)
   Talks to the va-malakh Worker's admin API (/foundry/api/malakh/*), which only answers when you are logged in
   through Cloudflare Access. The knowledge base and the spoiler list live in D1 (va-malakh), never on GitHub. */
(function () {
    'use strict';
    var API = '/foundry/api/malakh/';
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    var onSite = /(^|\.)va-comics\.com$/.test(location.hostname);
    var loaded = false, current = null, kbDirty = false;
    var FREE = 10000;   /* Cloudflare Workers AI free neurons per day, for the WHOLE account (the board uses it too) */

    function say(msg, kind) {
        var s = $('status'); if (!s) { return; }
        s.hidden = !msg; s.textContent = msg || ''; s.className = 'fstatus' + (kind ? ' is-' + kind : '');
    }
    function api(path, opts) {
        opts = opts || {}; opts.credentials = 'same-origin'; opts.cache = 'no-store';
        if (opts.body && typeof opts.body !== 'string') { opts.headers = { 'content-type': 'application/json' }; opts.body = JSON.stringify(opts.body); }
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
    var today = function () { return new Date().toISOString().slice(0, 10); };
    var LABELS = {
        jailbreak: 'Tried to change his rules', harmful: 'Dangerous how-to (blocked before AI)', english: 'Not English', encoded: 'Encoded text',
        length: 'Too long', empty: 'Empty', spoiler: 'Spoiler stopped', clearance: 'Dead Drop without 18+', 'clearance-out': 'Dead Drop without 18+ (answer)',
        crisis: 'Crisis message (calm answer)', 'crisis-out': 'Crisis (from the answer)', leak: 'Tried to read his instructions', 'harmful-out': 'Dangerous answer stopped',
        'english-out': 'Answer not in English', 'model-error': 'AI error', 'model-empty': 'AI gave no answer'
    };
    function catLabel(k) {
        var c = k.replace(/^blocked:/, '');
        if (/^guard-(in|out):/.test(c)) {
            var codes = { S1: 'violence', S2: 'crime', S3: 'sex crime', S4: 'child safety', S5: 'defamation', S6: 'specialised advice', S7: 'privacy', S8: 'IP', S9: 'weapons', S10: 'hate', S11: 'self-harm', S12: 'sexual', S13: 'elections', S14: 'code abuse' };
            var code = c.split(':')[1];
            return 'Safety filter ' + (c.indexOf('guard-in') === 0 ? '(question)' : '(answer)') + ': ' + (codes[code] || code);
        }
        return LABELS[c] || c;
    }

    /* ---------- STATUS + REFUSALS ---------- */
    function render(j) {
        current = j;
        var s = j.settings, on = s.enabled === '1';
        var t = {}; (j.stats || []).forEach(function (r) { if (r.day === today()) { t[r.k] = Number(r.n); } });
        var ai = t.ai_messages || 0, cap = Number(s.daily_cap), neu = Math.round(t.neurons || 0), ncap = Number(s.neuron_cap);
        var blocked = 0; Object.keys(t).forEach(function (k) { if (k.indexOf('blocked:') === 0) { blocked += t[k]; } });

        var sw = $('mkSwitch');
        sw.textContent = on ? 'ONLINE // TURN OFF' : 'OFFLINE // TURN ON';
        sw.className = 'btn ' + (on ? '' : 'btn--primary');
        $('mkState').textContent = on ? 'MALAKH is ONLINE for everyone on the site.' : 'MALAKH is OFF. Readers see "offline for maintenance".';
        $('mkState').className = 'mk-state ' + (on ? 'is-on' : 'is-off');

        var stop = '';
        if (on && (ai >= cap || neu >= ncap)) { stop = 'Today\'s limit is reached: readers get "quota exhausted" until 01:00 Budapest time (midnight UTC). Raise a limit below to let him continue today.'; }
        $('mkStop').hidden = !stop; $('mkStop').textContent = stop;

        var sum = $('mkSum'); sum.innerHTML = '';
        [['AI ANSWERS', ai + ' / ' + cap], ['NEURONS (MALAKH)', neu + ' / ' + ncap], ['BLOCKED (FREE)', String(blocked)], ['CHANNELS OPENED', String(t.sessions || 0)], ['SLOWED DOWN', String((t.limited || 0) + (t.capped || 0))], ['ADMIN TESTS', String(t.tests || 0)]]
            .forEach(function (p) { var b = el('div', 'mk-stat'); b.appendChild(el('span', 'mk-stat-k', p[0])); b.appendChild(el('b', 'mk-stat-v', p[1])); sum.appendChild(b); });
        var pct = Math.min(100, Math.round(neu / FREE * 100));
        $('mkBar').style.width = pct + '%';
        $('mkBarText').textContent = 'Cloudflare free AI portion today: ' + neu + ' of ' + FREE + ' neurons used by MALAKH (' + pct + '%). The board uses the same portion for moderation, so keep MALAKH\'s neuron limit well under ' + FREE + '.';

        ['per_hour', 'per_day_visitor', 'daily_cap', 'neuron_cap'].forEach(function (k) { $('mk_' + k).value = s[k]; });

        /* refusals, last 7 days */
        var cats = {}; (j.stats || []).forEach(function (r) { if (r.k.indexOf('blocked:') === 0) { cats[r.k] = (cats[r.k] || 0) + Number(r.n); } });
        var keys = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
        var list = $('mkCats'); list.innerHTML = '';
        if (!keys.length) { list.appendChild(el('p', 'hint', 'Nothing blocked in the last 7 days.')); }
        keys.forEach(function (k) { var row = el('div', 'mk-cat'); row.appendChild(el('span', '', catLabel(k))); row.appendChild(el('b', '', String(cats[k]))); list.appendChild(row); });

        $('mkKbInfo').textContent = 'Sizes: CORE ' + j.kb.core + ' · VANGUARD ' + j.kb.vanguard + ' · DEAD DROP ' + j.kb.deaddrop + ' characters · ' + j.kb.spoilers + ' spoiler words.';
    }
    function refresh() {
        if (!onSite) { $('mkLocal').hidden = false; return; }
        $('mkSum').innerHTML = '<span class="hint">Loading…</span>';
        return api('status').then(render).catch(function (e) { say(e.message, 'err'); });
    }

    function saveSettings(patch, doneMsg) {
        return api('settings', { method: 'POST', body: patch }).then(function () { say(doneMsg, 'ok'); return refresh(); }).catch(function (e) { say(e.message, 'err'); });
    }

    /* ---------- ARCHIVE (knowledge base + spoilers) ---------- */
    function loadKb() {
        var id = $('mkKbPart').value;
        if (kbDirty && !confirm('You have unsaved changes in the archive. Throw them away?')) { return; }
        $('mkKb').value = 'Loading…'; $('mkKb').disabled = true;
        api('kb/' + id).then(function (j) {
            $('mkKb').value = j.body; $('mkKb').disabled = false; kbDirty = false;
            $('mkKbWhen').textContent = j.updated ? 'Last saved: ' + new Date(j.updated * 1000).toLocaleString('en-GB') : 'Never saved.';
        }).catch(function (e) { $('mkKb').value = ''; $('mkKb').disabled = false; say(e.message, 'err'); });
    }
    function saveKb() {
        var id = $('mkKbPart').value, body = $('mkKb').value;
        if (!body.trim()) { say('The archive part is empty. Nothing saved.', 'err'); return; }
        if (body.length > 20000) { say('Too long (max 20,000 characters).', 'err'); return; }
        if (id !== 'spoilers' && body.length > 8000 && !confirm('This part is long (' + body.length + ' characters). Every answer that uses it costs more neurons. Save anyway?')) { return; }
        api('kb/' + id, { method: 'PUT', body: { body: body } }).then(function (j) {
            kbDirty = false; say('Saved (' + j.length + ' characters). MALAKH uses it from the next question.', 'ok'); refresh();
            $('mkKbWhen').textContent = 'Last saved: just now';
        }).catch(function (e) { say(e.message, 'err'); });
    }

    /* ---------- TEST ---------- */
    function test() {
        var q = $('mkTestQ').value.trim();
        if (!q) { return; }
        var out = $('mkTestOut'); out.hidden = false; out.textContent = 'MALAKH is processing…';
        api('test', { method: 'POST', body: { message: q, adult: $('mkTestAdult').checked } }).then(function (j) {
            out.textContent = '[' + j.kind + (j.cat && j.cat !== 'answer' ? ' / ' + catLabel(j.cat) : '') + ' · ' + j.neurons + ' neurons]\n\n' + j.reply;
            refresh();
        }).catch(function (e) { out.textContent = e.message; });
    }

    function init() {
        if (!$('tab-malakh')) { return; }
        $('mkSwitch').addEventListener('click', function () {
            if (!current) { return; }
            var on = current.settings.enabled === '1';
            if (!on && !confirm('Turn MALAKH on for everyone on the site?')) { return; }
            saveSettings({ enabled: on ? '0' : '1' }, on ? 'MALAKH is off.' : 'MALAKH is online.');
        });
        $('mkRefresh').addEventListener('click', function (e) { e.preventDefault(); refresh(); });
        $('mkSaveLimits').addEventListener('click', function () {
            var p = {}, bad = '';
            ['per_hour', 'per_day_visitor', 'daily_cap', 'neuron_cap'].forEach(function (k) { var v = String($('mk_' + k).value).trim(); if (!/^\d{1,6}$/.test(v)) { bad = k; } p[k] = v; });
            if (bad) { say('Limits must be whole numbers.', 'err'); return; }
            if (Number(p.neuron_cap) > 9000 && !confirm('A neuron limit over 9,000 leaves almost nothing for the board\'s moderation and can hit Cloudflare\'s free daily portion. Save anyway?')) { return; }
            saveSettings(p, 'Limits saved. They apply from the next question.');
        });
        $('mkKbPart').addEventListener('change', loadKb);
        $('mkKb').addEventListener('input', function () { kbDirty = true; });
        $('mkKbLoad').addEventListener('click', function () { kbDirty = false; loadKb(); });
        $('mkKbSave').addEventListener('click', saveKb);
        $('mkTestGo').addEventListener('click', test);
        $('mkTestQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); test(); } });

        /* load when the tab is opened (same pattern as BOARD) */
        $('tabs').addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('button') : null;
            if (t && t.getAttribute('data-tab') === 'malakh' && !loaded) { loaded = true; refresh(); if (onSite) { loadKb(); } }
        });
        if (location.hash === '#malakh') { var tb = $('tabs').querySelector('[data-tab="malakh"]'); if (tb) { tb.click(); } }
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
