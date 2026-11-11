/* VA COMICS // malakh.js  (M3, nov 2026)
   The MALAKH channel: the site-wide chat with the AI from Vanguard Chronicles.
   Loaded by site.js ONLY when someone presses the cyan launcher (or when a channel was open on the previous page).
   Talks only to the va-malakh Worker (/api/malakh/*). Nothing is stored on the server except daily counters.
   In this browser tab (sessionStorage): the channel token, the 18+ flag and the last messages, so the
   conversation follows the reader from page to page. Closing the tab or END_CHANNEL forgets everything. */
(function () {
    'use strict';
    if (window.VAMalakh) { return; }

    var API = '/api/malakh/';
    var SITEKEY = '0x4AAAAAAFVu_xnbGtwUMwWX';        /* public Turnstile site key (same widget as the board) */
    var STORE = 'malakh_v1';
    var AGE_KEY = 'vacomics_18plus';
    var MAX = 300, SEND_TURNS = 6, KEEP = 40;

    /* ---------- greetings by page (written in advance: no cost) ---------- */
    var GREETINGS = [
        ['/deaddrop/characters', 'You are in the Dead Drop personnel files. Pick a name. I have opinions on most of them.'],
        ['/deaddrop', 'Terminus City archives loaded. Ask about Jaxen, the gangs or the issues. Endings remain classified.'],
        ['/vanguard/characters', 'Vanguard personnel files. Yes, I am in there. No, the portrait does not do me justice.'],
        ['/vanguard/book2', 'The Jade Seal of Leyre. Cold mountain, colder politics. Ask away; I do not spoil endings.'],
        ['/vanguard/book1', 'The Sunken Pharaoh. Three tons of basalt and one very stubborn diver. Ask away.'],
        ['/vanguard', 'Vanguard archives. Marcus, Kira and the only competent member of the team: me.'],
        ['/media/viewer', 'Reading Dead Drop? Ask between pages. I will not tell you what is on the next one.'],
        ['/media/reader', 'Reading Room detected. Questions about the books are welcome. Questions about free codes are not.'],
        ['/media/talk', 'The discussion boards are for humans. I answer faster, with 94.6 percent more sarcasm.'],
        ['/qa', 'The Q&A board is for humans. I answer faster, with 94.6 percent more sarcasm.'],
        ['/chronicles', 'News feed loaded. Ask about anything you read here.'],
        ['', 'Channel open. Ask about Dead Drop, Vanguard Chronicles or this site. Under 300 characters, please; my patience has a buffer limit.']
    ];
    var DD_PATHS = ['/deaddrop', '/media/viewer', '/media/video', '/media/talk'];

    function path() { return (location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1')) || '/'; }
    function greeting(adult) {
        var p = path(), g = GREETINGS[GREETINGS.length - 1][1];
        for (var i = 0; i < GREETINGS.length - 1; i++) { if (p === GREETINGS[i][0] || p.indexOf(GREETINGS[i][0] + '/') === 0) { g = GREETINGS[i][1]; break; } }
        var dd = DD_PATHS.some(function (d) { return p === d || p.indexOf(d + '/') === 0; });
        if (dd && !adult) { g += ' Note: Dead Drop files need 18+ clearance, and this channel does not have it.'; }
        return g;
    }

    /* ---------- storage ---------- */
    function load() { try { return JSON.parse(sessionStorage.getItem(STORE) || 'null') || {}; } catch (e) { return {}; } }
    function save() { try { sessionStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode: fine, it just will not follow you */ } }
    function ageConfirmed() { try { return localStorage.getItem(AGE_KEY) === '1'; } catch (e) { return false; } }
    var S = load();
    function sessionValid() { return S.token && S.expires && S.expires * 1000 > Date.now() + 30000; }

    /* ---------- helpers ---------- */
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function rich(text) {
        /* only our own site and Amazon become links; everything else stays plain text */
        return esc(text).replace(/https?:\/\/(?:www\.)?(?:va-comics\.com|amazon\.com)[^\s<)]*/gi, function (u) {
            var clean = u.replace(/[.,;:!?]+$/, ''), tail = u.slice(clean.length);
            return '<a href="' + clean + '" rel="noopener"' + (/amazon\.com/i.test(clean) ? ' target="_blank"' : '') + '>' + clean.replace(/^https?:\/\/(www\.)?/, '') + '</a>' + tail;
        }).replace(/\n/g, '<br>');
    }
    function api(p, body) {
        return fetch(API + p, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
    }

    /* ---------- Turnstile ---------- */
    var tsReady = null;
    function turnstile() {
        if (tsReady) { return tsReady; }
        tsReady = new Promise(function (res, rej) {
            if (window.turnstile) { res(window.turnstile); return; }
            var s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            s.async = true; s.onload = function () { res(window.turnstile); };
            s.onerror = function () { tsReady = null; rej(new Error('The anti-bot check could not load. Check your connection or ad blocker.')); };
            document.head.appendChild(s);
        });
        return tsReady;
    }

    /* ---------- UI ---------- */
    var ui = null, busy = false, lastFocus = null;

    function build() {
        var panel = el('section', 'malakh-panel');
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'MALAKH, the VA Comics AI');
        panel.innerHTML =
            '<header class="mk-head"><span class="mk-title"><span class="mk-wave" aria-hidden="true"></span>MALAKH <span class="mk-sub">// ARCHIVE_AI</span></span>' +
            '<span class="mk-actions"><button type="button" class="mk-min" aria-label="Minimise (the channel stays open)">_</button>' +
            '<button type="button" class="mk-end" aria-label="End the channel and forget this conversation">X</button></span></header>' +
            '<div class="mk-body" aria-live="polite"></div>' +
            '<form class="mk-form" autocomplete="off"><label class="mk-sr" for="mkInput">Your question for MALAKH</label>' +
            '<textarea id="mkInput" rows="2" maxlength="' + MAX + '" placeholder="Ask about the stories, the characters or the site…"></textarea>' +
            '<div class="mk-row"><span class="mk-count">0/' + MAX + '</span><button type="submit" class="mk-send">[ TRANSMIT ]</button></div></form>';
        document.body.appendChild(panel);
        var body = panel.querySelector('.mk-body'), form = panel.querySelector('.mk-form'), input = panel.querySelector('textarea'),
            count = panel.querySelector('.mk-count'), send = panel.querySelector('.mk-send');

        panel.querySelector('.mk-min').addEventListener('click', minimise);
        panel.querySelector('.mk-end').addEventListener('click', endChannel);
        panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); minimise(); } });
        input.addEventListener('input', function () { count.textContent = input.value.length + '/' + MAX; });
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
        form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
        return { panel: panel, body: body, form: form, input: input, count: count, send: send };
    }

    function scrollDown() { ui.body.scrollTop = ui.body.scrollHeight; }
    function bubble(role, text, kind) {
        var b = el('div', 'mk-msg mk-' + role + (kind ? ' mk-k-' + kind : ''));
        if (role === 'ai') { b.appendChild(el('span', 'mk-who', kind === 'crisis' ? 'MALAKH // OFF-RECORD' : 'MALAKH')); }
        var t = el('div', 'mk-text'); t.innerHTML = rich(text); b.appendChild(t);
        ui.body.appendChild(b); scrollDown(); return b;
    }
    function system(text) { var n = el('p', 'mk-sys', text); ui.body.appendChild(n); scrollDown(); return n; }
    function setForm(on) { ui.form.hidden = !on; }

    function renderChannel() {
        ui.body.innerHTML = '';
        system('CHANNEL OPEN // ' + (S.adult ? '18+ CLEARANCE' : 'PUBLIC CLEARANCE'));
        bubble('ai', greeting(S.adult));
        (S.log || []).forEach(function (m) { bubble(m.r === 'user' ? 'user' : 'ai', m.c, m.k); });
        setForm(true);
        setTimeout(function () { ui.input.focus(); }, 50);
    }

    /* ---------- opening screen: the warning, 18+, Turnstile ---------- */
    function renderOpener(note) {
        ui.body.innerHTML = '';
        setForm(false);
        var box = el('div', 'mk-opener');
        var already = ageConfirmed();
        box.innerHTML =
            '<p class="mk-kicker">CHANNEL_REQUEST // ARCHIVE_AI</p>' +
            '<p>I am <b>MALAKH</b>, the resident intelligence of these archives. A disclosure before you connect: <b>I am sarcastic by design.</b> I will question your theories, your reading habits and, statistically, a few of your life choices. If your ego is fragile, closing this window is the logical move. No refunds on hurt feelings.</p>' +
            '<ul class="mk-rules"><li>I know the VA Comics archives, not the internet.</li><li>I do not spoil endings, invent canon or help with anything illegal.</li><li>I am an AI. I can be wrong. The books are always right.</li><li>Conversations are not stored. Questions in English, up to 300 characters.</li></ul>' +
            (already ? '<p class="mk-clear">18+ CLEARANCE: CONFIRMED <span>(Dead Drop files unlocked)</span></p>'
                : '<label class="mk-check"><input type="checkbox" id="mkAdult"><span class="mk-check-text">I am 18 or older<small>Unlocks the Dead Drop files</small></span></label>') +
            '<div class="mk-ts"></div><p class="mk-note" role="alert"></p>' +
            '<button type="button" class="btn btn--primary mk-open" disabled>I CAN TAKE IT // OPEN</button>';
        ui.body.appendChild(box);
        var btn = box.querySelector('.mk-open'), noteEl = box.querySelector('.mk-note'), tsBox = box.querySelector('.mk-ts');
        var token = null, wid = null;
        if (note) { noteEl.textContent = note; }
        noteEl.textContent = noteEl.textContent || 'Verifying you are not a bot…';
        turnstile().then(function (T) {
            wid = T.render(tsBox, { sitekey: SITEKEY, appearance: 'interaction-only', theme: 'dark', size: 'flexible',
                callback: function (t) { token = t; btn.disabled = false; if (/Verifying/.test(noteEl.textContent)) { noteEl.textContent = ''; } },
                'expired-callback': function () { token = null; btn.disabled = true; },
                'error-callback': function () { token = null; btn.disabled = true; noteEl.textContent = 'The anti-bot check failed. Reload the page and try again.'; } });
        }).catch(function (e) { noteEl.textContent = e.message; });
        btn.addEventListener('click', function () {
            if (!token || busy) { return; }
            var adultBox = box.querySelector('#mkAdult');
            var adult = already || !!(adultBox && adultBox.checked);
            if (adultBox && adultBox.checked) { try { localStorage.setItem(AGE_KEY, '1'); } catch (e) { /* ignore */ } }
            busy = true; btn.disabled = true; noteEl.textContent = 'Opening channel…';
            api('open', { turnstile: token, adult: adult }).then(function (j) {
                busy = false;
                if (j.ok && j.token) {
                    S = { token: j.token, expires: j.expires, adult: adult, log: [], open: true }; save();
                    renderChannel();
                } else if (j.kind === 'offline') {
                    renderOffline(j.reply);
                } else {
                    noteEl.textContent = j.message || 'The channel could not be opened. Try again.';
                    try { if (window.turnstile && wid !== null) { window.turnstile.reset(wid); } } catch (x) { /* ignore */ }
                }
            }).catch(function () { busy = false; btn.disabled = false; noteEl.textContent = 'Signal lost. Check your connection and try again.'; });
        });
    }

    function renderOffline(text) {
        ui.body.innerHTML = '';
        setForm(false);
        system('CHANNEL UNAVAILABLE');
        bubble('ai', text || 'MALAKH is offline for maintenance. Try again later.', 'offline');
    }

    /* ---------- asking ---------- */
    function ask(raw) {
        var msg = String(raw || '').trim();
        if (!msg || busy) { return; }
        if (!sessionValid()) { S = {}; save(); renderOpener('Your channel expired. Open a new one.'); return; }
        busy = true; ui.send.disabled = true; ui.input.value = ''; ui.count.textContent = '0/' + MAX;
        bubble('user', msg);
        var wait = el('div', 'mk-msg mk-ai mk-wait'); wait.innerHTML = '<span class="mk-who">MALAKH</span><div class="mk-text">processing<span class="mk-dots"><i>.</i><i>.</i><i>.</i></span></div>';
        ui.body.appendChild(wait); scrollDown();
        var history = (S.log || []).filter(function (m) { return !m.k || m.k === 'answer'; }).slice(-SEND_TURNS).map(function (m) { return { role: m.r === 'user' ? 'user' : 'assistant', content: m.c }; });
        api('ask', { token: S.token, message: msg, history: history }).then(function (j) {
            wait.remove(); busy = false; ui.send.disabled = false;
            if (j.kind === 'session') { S = {}; save(); renderOpener('Your channel expired. Open a new one.'); return; }
            if (j.kind === 'offline') { renderOffline(j.reply); S = {}; save(); return; }
            var kind = j.kind || 'error', reply = j.reply || 'Signal lost. Try again in a minute.';
            S.log = (S.log || []).concat([{ r: 'user', c: msg, k: kind === 'answer' ? 'answer' : 'x' }, { r: 'ai', c: reply, k: kind }]).slice(-KEEP); save();
            var b = bubble('ai', reply, kind);
            if (kind === 'clearance' && !S.adult) {
                var c = el('button', 'btn mk-clearbtn', 'I AM 18+ // REOPEN'); c.type = 'button';
                c.addEventListener('click', function () { try { localStorage.setItem(AGE_KEY, '1'); } catch (e) { /* ignore */ } S = {}; save(); renderOpener(); });
                b.appendChild(c);
            }
            ui.input.focus();
        }).catch(function () {
            wait.remove(); busy = false; ui.send.disabled = false;
            bubble('ai', 'Signal lost. My processors are fine; the network is not. Try again in a minute.', 'error');
        });
    }

    /* ---------- open / minimise / end ---------- */
    function launcher() { return document.querySelector('.malakh-launcher'); }
    function open() {
        if (!ui) { ui = build(); }
        lastFocus = document.activeElement;
        ui.panel.hidden = false;
        document.body.classList.add('malakh-open');
        var L = launcher(); if (L) { L.setAttribute('aria-expanded', 'true'); }
        S.open = true; save();
        if (sessionValid()) { if (!ui.body.childNodes.length) { renderChannel(); } else { ui.input.focus(); } return; }
        S = { open: true }; save();
        ui.body.innerHTML = ''; system('CONNECTING…');
        api('status').then(function (j) { if (j && j.online) { renderOpener(); } else { renderOffline(); } })
            .catch(function () { renderOffline('Signal lost. Try again in a minute.'); });
    }
    function minimise() {
        if (!ui) { return; }
        ui.panel.hidden = true;
        document.body.classList.remove('malakh-open');
        var L = launcher(); if (L) { L.setAttribute('aria-expanded', 'false'); L.classList.toggle('is-live', sessionValid()); }
        S.open = false; save();
        if (lastFocus && lastFocus.focus) { lastFocus.focus(); } else if (L) { L.focus(); }
    }
    function endChannel() {
        S = {}; try { sessionStorage.removeItem(STORE); } catch (e) { /* ignore */ }
        if (ui) { ui.body.innerHTML = ''; }
        minimise();
        var L = launcher(); if (L) { L.classList.remove('is-live'); }
    }
    function toggle() { if (ui && !ui.panel.hidden) { minimise(); } else { open(); } }

    window.VAMalakh = { open: open, toggle: toggle, minimise: minimise };
})();
