/* VA COMICS // Reading Room // the "guard" Worker (va-reader)  v2: library of books
   A separate Worker from the site. It only answers these paths:
     /api/reader/*            public: book list, unlock with a code, then read chapter by chapter
     /foundry/api/reader/*    admin: books list + codes (behind Cloudflare Access + checked here again)
   Bindings (set in Cloudflare):
     CODES        KV namespace  (library list, codes, sessions, rate limits)
     BOOKS        R2 bucket     (PRIVATE: <bookId>/book.json, chN.json, img/NN.webp)
     ACCESS_TEAM  text          e.g. vacomics.cloudflareaccess.com
     ACCESS_AUD   text          the "Application Audience (AUD) tag" of the Access app that protects /foundry*

   A NEW BOOK needs no code change: upload its folder to the bucket, then add it in Foundry > READER CODES > BOOKS.
   A code opens either a list of books, or "*" = every book that is visible in the Reading Room (also future ones).
   A hidden book (not public yet) opens only with a code that names it (e.g. for a beta reader). */

const DAY = 86400;
const MAX_DEVICES = 2;
const MAX_FAILS = 10;            /* wrong codes per IP ... */
const FAIL_WINDOW = 15 * 60;     /* ... per 15 minutes */
const DEFAULT_DAYS = 14;
const CODE_PREFIX = 'VNG';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; /* no 0/O, 1/I/L */
const SESSION_COOKIE = 'rr_s';
const BOOK_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
/* used only until the list is saved once from Foundry */
const DEFAULT_LIBRARY = [{
    id: 'sunken-pharaoh', title: 'The Sunken Pharaoh', series: 'Vanguard Chronicles · Book 1',
    authors: 'Aris Menethil & Alexi Void', cover: '/vanguard/assets/covers/book1.webp', visible: true
}];

/* ------------------------------------------------------------------ helpers */
function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra }
    });
}
const err = (status, code, message) => json({ error: code, message }, status);
const now = () => Math.floor(Date.now() / 1000);
const clean = (s, max) => String(s || '').replace(/[<>"]/g, '').trim().slice(0, max);

function randomCode() {
    const b = crypto.getRandomValues(new Uint8Array(8));
    let s = '';
    for (const x of b) { s += ALPHABET[x % ALPHABET.length]; }
    return CODE_PREFIX + '-' + s.slice(0, 4) + '-' + s.slice(4, 8);
}
function randomToken() {
    const b = crypto.getRandomValues(new Uint8Array(32));
    return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function normCode(raw) {
    const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z]{3}[A-Z0-9]{8}$/.test(s)) { return null; }
    return s.slice(0, 3) + '-' + s.slice(3, 7) + '-' + s.slice(7, 11);
}
function cookie(req, name) {
    const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([a-f0-9]{64})'));
    return m ? m[1] : null;
}
function setCookie(token, maxAge) {
    return SESSION_COOKIE + '=' + token + '; Path=/api/reader; HttpOnly; Secure; SameSite=Strict; Max-Age=' + Math.max(0, maxAge);
}

/* ------------------------------------------------------------------ library + codes */
async function getLibrary(env) {
    const l = await env.CODES.get('library', 'json');
    return Array.isArray(l) && l.length ? l : DEFAULT_LIBRARY;
}
const publicBook = b => ({ id: b.id, title: b.title, series: b.series || '', authors: b.authors || '', cover: b.cover || '' });
const recBooks = rec => Array.isArray(rec.books) ? rec.books : (rec.book ? [rec.book] : []);
/* the books a code may open: "*" = all visible books; named ids open even hidden books */
function allowedBooks(rec, lib) {
    const ids = recBooks(rec);
    return lib.filter(b => (ids.includes('*') && b.visible !== false) || ids.includes(b.id));
}
const meta = rec => ({ label: rec.label, books: recBooks(rec), expires: rec.expires, revoked: !!rec.revoked, devices: rec.devices.length, created: rec.created, lastUsed: rec.lastUsed || 0 });

async function getCode(env, code) { return code ? env.CODES.get('code:' + code, 'json') : null; }
async function putCode(env, code, rec) {
    const ttl = Math.max(60, rec.expires - now() + DAY); /* keep 1 day after expiry, then KV deletes it */
    await env.CODES.put('code:' + code, JSON.stringify(rec), { expirationTtl: ttl, metadata: meta(rec) });
}
function codeProblem(rec) {
    if (!rec) { return [403, 'bad_code', 'This code is not valid. Check it, or ask for a new one on Facebook or X.']; }
    if (rec.revoked) { return [403, 'revoked', 'This code was switched off. Ask for a new one on Facebook or X.']; }
    if (rec.expires <= now()) { return [403, 'expired', 'This code has expired. Ask for a new one on Facebook or X.']; }
    return null;
}

/* session -> { token, ses, rec, books } or { fail: Response } */
async function readSession(req, env) {
    const token = cookie(req, SESSION_COOKIE);
    if (!token) { return { fail: err(401, 'no_session', 'Enter your code to open the Reading Room.') }; }
    const ses = await env.CODES.get('ses:' + token, 'json');
    if (!ses) { return { fail: err(401, 'no_session', 'Your session ended. Enter your code again.') }; }
    const rec = await getCode(env, ses.code);
    const p = codeProblem(rec);
    if (p) { return { fail: err(...p) }; }
    const books = allowedBooks(rec, await getLibrary(env));
    return { token, ses, rec, books };
}
function pickBook(s, id) {
    const b = id ? s.books.find(x => x.id === id) : s.books[0];
    return b || null;
}

/* ------------------------------------------------------------------ Access (admin) */
let certsCache = null;
function b64urlBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) { s += '='; }
    const bin = atob(s); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) { out[i] = bin.charCodeAt(i); }
    return out;
}
async function verifyAccess(req, env) {
    if (env.DEV_NO_ACCESS === '1') { return { email: 'dev@local' }; }      /* only for the local test harness */
    const jwt = req.headers.get('cf-access-jwt-assertion');
    if (!jwt || !env.ACCESS_TEAM || !env.ACCESS_AUD) { return null; }
    const [h, p, s] = jwt.split('.');
    if (!h || !p || !s) { return null; }
    let header, payload;
    try { header = JSON.parse(new TextDecoder().decode(b64urlBytes(h))); payload = JSON.parse(new TextDecoder().decode(b64urlBytes(p))); } catch (e) { return null; }
    if (header.alg !== 'RS256') { return null; }
    if (!certsCache || certsCache.at < Date.now() - 3600e3) {
        const r = await fetch('https://' + env.ACCESS_TEAM + '/cdn-cgi/access/certs');
        if (!r.ok) { return null; }
        certsCache = { at: Date.now(), keys: (await r.json()).keys || [] };
    }
    const jwk = certsCache.keys.find(k => k.kid === header.kid);
    if (!jwk) { return null; }
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(h + '.' + p));
    if (!ok) { return null; }
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) { return null; }
    if (!payload.exp || payload.exp < now()) { return null; }
    if (payload.iss && payload.iss !== 'https://' + env.ACCESS_TEAM) { return null; }
    return { email: payload.email || '' };
}

/* ------------------------------------------------------------------ public API */
async function unlock(req, env) {
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const rlKey = 'rl:' + ip;
    const fails = parseInt(await env.CODES.get(rlKey) || '0', 10);
    if (fails >= MAX_FAILS) { return err(429, 'slow_down', 'Too many wrong codes. Wait 15 minutes and try again.'); }
    let body = {};
    try { body = await req.json(); } catch (e) { /* empty */ }
    const code = normCode(body.code);
    const device = /^[a-f0-9-]{16,64}$/.test(String(body.device || '')) ? String(body.device) : null;
    if (!device) { return err(400, 'bad_request', 'Your browser did not send a device id. Reload the page.'); }
    const rec = await getCode(env, code);
    const p = codeProblem(rec);
    if (p) {
        if (p[1] === 'bad_code') { await env.CODES.put(rlKey, String(fails + 1), { expirationTtl: FAIL_WINDOW }); }
        return err(...p);
    }
    if (!allowedBooks(rec, await getLibrary(env)).length) { return err(403, 'no_books', 'This code does not open any book right now. Ask on Facebook or X.'); }
    if (!rec.devices.includes(device)) {
        if (rec.devices.length >= MAX_DEVICES) {
            return err(403, 'too_many_devices', 'This code is already used on ' + MAX_DEVICES + ' devices. Ask for a new one on Facebook or X.');
        }
        rec.devices.push(device);
    }
    rec.lastUsed = now();
    await putCode(env, code, rec);
    const token = randomToken(), life = rec.expires - now();
    await env.CODES.put('ses:' + token, JSON.stringify({ code, device }), { expirationTtl: Math.max(60, life) });
    return json({ ok: true }, 200, { 'set-cookie': setCookie(token, life) });
}

async function library(env) {
    return json({ books: (await getLibrary(env)).filter(b => b.visible !== false).map(publicBook) });
}

async function session(req, env) {
    const s = await readSession(req, env);
    if (s.fail) { return s.fail; }
    return json({ books: s.books.map(publicBook), label: s.rec.label, code: s.ses.code, expires: s.rec.expires });
}

async function bookToc(req, env, id) {
    const s = await readSession(req, env);
    if (s.fail) { return s.fail; }
    const b = pickBook(s, id);
    if (!b) { return err(403, 'not_your_book', 'Your code does not open this book.'); }
    const obj = await env.BOOKS.get(b.id + '/book.json');
    if (!obj) { return err(500, 'missing_book', 'The book is not available right now.'); }
    const toc = await obj.json();
    return json({ ...toc, ...publicBook(b) });
}

async function chapter(req, env, id, n) {
    const s = await readSession(req, env);
    if (s.fail) { return s.fail; }
    const b = pickBook(s, id);
    if (!b) { return err(403, 'not_your_book', 'Your code does not open this book.'); }
    const obj = await env.BOOKS.get(b.id + '/ch' + n + '.json');
    if (!obj) { return err(404, 'no_chapter', 'This chapter does not exist.'); }
    return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
}

async function image(req, env, id, n) {
    const s = await readSession(req, env);
    if (s.fail) { return s.fail; }
    const b = pickBook(s, id);
    if (!b) { return err(403, 'not_your_book', 'Your code does not open this book.'); }
    const obj = await env.BOOKS.get(b.id + '/img/' + String(n).padStart(2, '0') + '.webp');
    if (!obj) { return err(404, 'no_image', 'Image not found.'); }
    return new Response(obj.body, { headers: { 'content-type': 'image/webp', 'cache-control': 'private, no-store', 'content-disposition': 'inline', 'x-robots-tag': 'noindex' } });
}

async function logout(req, env) {
    const token = cookie(req, SESSION_COOKIE);
    if (token) { await env.CODES.delete('ses:' + token); }
    return json({ ok: true }, 200, { 'set-cookie': setCookie('0'.repeat(64), 0) });
}

/* ------------------------------------------------------------------ admin API */
async function readJson(req) { try { return await req.json(); } catch (e) { return {}; } }

async function admin(req, env, path) {
    const who = await verifyAccess(req, env);
    if (!who) { return err(403, 'forbidden', 'Admin only (log in to Foundry through Cloudflare Access).'); }

    /* ---- books ---- */
    if (path === 'library' && req.method === 'GET') {
        const lib = await getLibrary(env);
        const out = [];
        for (const b of lib) { out.push({ ...b, visible: b.visible !== false, ready: !!(await env.BOOKS.head(b.id + '/book.json')) }); }
        return json({ books: out });
    }
    if (path === 'library' && req.method === 'PUT') {
        const body = await readJson(req);
        if (!Array.isArray(body.books) || !body.books.length || body.books.length > 50) { return err(400, 'bad_request', 'Send between 1 and 50 books.'); }
        const seen = {}, list = [];
        for (const raw of body.books) {
            const id = String(raw.id || '').trim().toLowerCase();
            if (!BOOK_ID.test(id)) { return err(400, 'bad_id', '"' + id + '" is not a valid folder name (lowercase letters, digits and -).'); }
            if (seen[id]) { return err(400, 'duplicate', 'The book "' + id + '" is twice in the list.'); }
            seen[id] = 1;
            const title = clean(raw.title, 120);
            if (!title) { return err(400, 'no_title', 'The book "' + id + '" has no title.'); }
            if (!(await env.BOOKS.head(id + '/book.json'))) {
                return err(400, 'not_uploaded', 'The folder "' + id + '" is not in the private bucket yet (missing ' + id + '/book.json). Upload the book first.');
            }
            const cover = clean(raw.cover, 200);
            list.push({ id, title, series: clean(raw.series, 120), authors: clean(raw.authors, 120),
                cover: /^\/[\w\-./]+$/.test(cover) || /^https:\/\/[\w\-./]+$/.test(cover) ? cover : '', visible: raw.visible !== false });
        }
        await env.CODES.put('library', JSON.stringify(list));
        return json({ books: list });
    }

    /* ---- codes ---- */
    if (path === 'codes' && req.method === 'GET') {
        const out = []; let cursor;
        do {
            const page = await env.CODES.list({ prefix: 'code:', cursor });
            for (const k of page.keys) { out.push({ code: k.name.slice(5), ...(k.metadata || {}) }); }
            cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
        out.forEach(c => { if (!c.books && c.book) { c.books = [c.book]; } });
        out.sort((a, b) => (b.created || 0) - (a.created || 0));
        return json({ codes: out, now: now() });
    }
    if (path === 'codes' && req.method === 'POST') {
        const body = await readJson(req);
        const lib = await getLibrary(env);
        let books = Array.isArray(body.books) ? body.books.map(String) : (body.book ? [String(body.book)] : []);
        if (books.includes('*')) { books = ['*']; }
        else {
            books = books.filter((id, i) => books.indexOf(id) === i && lib.some(b => b.id === id));
            if (!books.length) { return err(400, 'no_books', 'Choose at least one book (or all books).'); }
        }
        const days = Math.min(365, Math.max(1, parseInt(body.days, 10) || DEFAULT_DAYS));
        const label = clean(body.label, 60) || 'Reader';
        let code;
        for (let i = 0; i < 5; i++) { code = randomCode(); if (!(await getCode(env, code))) { break; } }
        const rec = { books, label, created: now(), expires: now() + days * DAY, devices: [], revoked: false, by: who.email };
        await putCode(env, code, rec);
        return json({ code, ...meta(rec) }, 201);
    }
    const m = path.match(/^codes\/([A-Z]{3}-[A-Z0-9]{4}-[A-Z0-9]{4})(\/revoke)?$/);
    if (m && req.method === 'POST' && m[2]) {
        const rec = await getCode(env, m[1]);
        if (!rec) { return err(404, 'not_found', 'Code not found.'); }
        rec.revoked = true; await putCode(env, m[1], rec);
        return json({ code: m[1], ...meta(rec) });
    }
    if (m && req.method === 'DELETE' && !m[2]) {
        await env.CODES.delete('code:' + m[1]);
        return json({ ok: true });
    }
    return err(404, 'not_found', 'Unknown admin action.');
}

/* ------------------------------------------------------------------ router */
export default {
    async fetch(req, env) {
        const url = new URL(req.url), p = url.pathname;
        try {
            if (p.startsWith('/foundry/api/reader/')) { return await admin(req, env, p.slice('/foundry/api/reader/'.length)); }
            if (!p.startsWith('/api/reader/')) { return err(404, 'not_found', 'Not here.'); }
            const r = p.slice('/api/reader/'.length);
            if (req.method === 'POST' && (r === 'unlock' || r === 'logout')) {
                /* same-site only: a page on another site cannot unlock or log out a reader */
                const origin = req.headers.get('origin');
                if (origin && origin !== url.origin) { return err(403, 'bad_origin', 'Wrong origin.'); }
                return r === 'unlock' ? await unlock(req, env) : await logout(req, env);
            }
            if (req.method !== 'GET') { return err(405, 'method', 'Method not allowed.'); }
            if (r === 'library') { return await library(env); }
            if (r === 'session') { return await session(req, env); }
            let m = r.match(/^book\/([a-z0-9-]{2,40})$/);
            if (m) { return await bookToc(req, env, m[1]); }
            m = r.match(/^book\/([a-z0-9-]{2,40})\/chapter\/(\d{1,3})$/);
            if (m) { return await chapter(req, env, m[1], parseInt(m[2], 10)); }
            m = r.match(/^book\/([a-z0-9-]{2,40})\/img\/(\d{1,3})$/);
            if (m) { return await image(req, env, m[1], parseInt(m[2], 10)); }
            /* v1 addresses (first book of the code), kept so an open tab from before the update keeps working */
            m = r.match(/^chapter\/(\d{1,3})$/);
            if (m) { return await chapter(req, env, null, parseInt(m[1], 10)); }
            m = r.match(/^img\/(\d{1,3})$/);
            if (m) { return await image(req, env, null, parseInt(m[1], 10)); }
            return err(404, 'not_found', 'Not here.');
        } catch (e) {
            return err(500, 'server', 'Something went wrong. Try again in a minute.');
        }
    }
};
