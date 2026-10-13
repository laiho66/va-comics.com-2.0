/* VA COMICS // Comments + Q&A // the "board" Worker (va-board)
   A separate Worker from the site. It only answers:
     /api/board/*            public: list approved messages, post (with filters), report
     /foundry/api/board/*    admin: queue, approve, delete, reply (behind Cloudflare Access + checked here again)
   Bindings (set in Cloudflare):
     DB                D1 database va-board (table messages)
     AI                Workers AI (moderation)
     TURNSTILE_SECRET  secret (Cloudflare Turnstile, anti-bot)   -- set in the dashboard, NEVER in the repo
     ACCESS_TEAM, ACCESS_AUD  same Access app as Foundry
     MAILER            send_email binding (Cloudflare Email Routing) for the notifications to Aris
     NOTIFY_TO         secret: Aris's verified address  -- set in the dashboard, NEVER in the repo (public)
     NOTIFY_FROM       var: sender on the domain (board@va-comics.com)

   Rules (Aris): English only · no vulgar, sexual, religious, hateful content · anything doubtful is NOT published
   (it waits in the Foundry BOARD queue) · no email, no account, no IP stored. */

const MAX_BODY = 1000, MIN_BODY = 3;
const MAX_PER_HOUR = 5;                 /* posts per anonymous visitor per hour */
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const TARGET = /^(issue:\d{1,3}(?:_\d{1,2})?|book:[a-z0-9][a-z0-9-]{1,39}|qa)$/;
const NICK = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,22}[A-Za-z0-9_]$/;

/* strong words: rejected without asking the AI (the AI still catches the rest, also misspelled ones) */
const BAD_WORDS = ['fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'cunt', 'dick', 'cock', 'pussy',
    'bitch', 'bastard', 'asshole', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'porn', 'porno',
    'nude', 'nudes', 'blowjob', 'dildo', 'rape'];
const BAD_RE = new RegExp('\\b(' + BAD_WORDS.join('|') + ')s?\\b', 'i');
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|info|biz|link|top|shop|site|online|ro|hu|co)\b|@[a-z0-9_]{3,}\b)/i;

const REJECT_TEXT = {
    english_only: 'Messages in English only, please.',
    language: 'Your message was not published: please keep it clean (no swearing, sexual, religious or hateful content).',
    rules: 'Your message was not published because it does not follow the board rules.',
    too_fast: 'You are posting too fast. Try again in an hour.'
};
const MAX_MAILS_PER_HOUR = 10;          /* instant notifications; the rest waits for the daily summary */
const FOUNDRY_URL = 'https://va-comics.com/foundry/#board';
const PENDING_TEXT = 'Thanks! Your message will appear after a quick review.';

/* ------------------------------------------------------------------ helpers */
function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra }
    });
}
const err = (status, code, message) => json({ error: code, message }, status);
const now = () => Math.floor(Date.now() / 1000);
const clean = s => String(s || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();

async function sha256(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
/* anonymous, changes every day: lets us count posts per visitor without storing an IP */
async function fingerprint(req) {
    const day = new Date().toISOString().slice(0, 10);
    return (await sha256((req.headers.get('cf-connecting-ip') || 'local') + '|' + (req.headers.get('user-agent') || '') + '|' + day + '|va-board')).slice(0, 32);
}

/* only English letters: any letter outside A-Z (Romanian, Hungarian, Cyrillic, ...) = not English */
function nonEnglishLetters(s) { return /[^\x00-\x7F]/.test(s) && /\p{L}/u.test(s.replace(/[A-Za-z]/g, '')); }

async function turnstileOk(env, token, ip) {
    if (env.DEV_SKIP_TURNSTILE === '1') { return true; }                 /* local test harness only */
    if (!env.TURNSTILE_SECRET || !token) { return false; }
    const form = new FormData(); form.append('secret', env.TURNSTILE_SECRET); form.append('response', token);
    if (ip) { form.append('remoteip', ip); }
    try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
        const j = await r.json(); return !!j.success;
    } catch (e) { return false; }
}

/* AI moderation. Returns { verdict: 'ok'|'review'|'block', english: bool, why: string } */
const MOD_PROMPT = 'You moderate public comments on the website of an independent comic book and novel studio (VA Comics). ' +
    'The stories are an adult tech-noir crime comic (violence, guns, gangs are normal story topics) and PG-13 underwater archaeology adventure novels. ' +
    'Rules: comments must be in English. Not allowed: swearing or vulgar words (also disguised or misspelled), sexual content or innuendo, ' +
    'religious topics or preaching (casual exclamations like "oh my god" are fine), hate, insults or harassment of people, spam or advertising, ' +
    'personal data (phone numbers, addresses, emails). Talking about the story, characters, violence in the story, art, questions to the author, praise or polite criticism is fine. ' +
    'Answer with JSON: english (true if the message is written in English), verdict ("ok" if it clearly follows every rule, "block" if it clearly breaks a rule, ' +
    '"review" if you are not sure), why (a few words).';
async function aiCheck(env, nick, body) {
    if (typeof env.DEV_FAKE_AI === 'function') { return env.DEV_FAKE_AI(nick, body); }   /* local tests only */
    if (!env.AI) { return { verdict: 'review', english: true, why: 'no ai' }; }
    try {
        const r = await env.AI.run(AI_MODEL, {
            messages: [{ role: 'system', content: MOD_PROMPT }, { role: 'user', content: 'Nickname: ' + nick + '\nComment:\n' + body }],
            response_format: { type: 'json_schema', json_schema: { type: 'object', properties: { english: { type: 'boolean' }, verdict: { type: 'string', enum: ['ok', 'review', 'block'] }, why: { type: 'string' } }, required: ['english', 'verdict', 'why'] } },
            max_tokens: 80, temperature: 0
        });
        let out = r && r.response;
        if (typeof out === 'string') { out = JSON.parse(out); }
        if (!out || !['ok', 'review', 'block'].includes(out.verdict)) { return { verdict: 'review', english: true, why: 'unclear ai answer' }; }
        return { verdict: out.verdict, english: out.english !== false, why: String(out.why || '').slice(0, 80) };
    } catch (e) {
        return { verdict: 'review', english: true, why: 'ai error' };           /* doubtful = not published */
    }
}

/* ------------------------------------------------------------------ Access (admin), same as va-reader */
let certsCache = null;
function b64urlBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) { s += '='; }
    const bin = atob(s); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) { out[i] = bin.charCodeAt(i); }
    return out;
}
async function verifyAccess(req, env) {
    if (env.DEV_NO_ACCESS === '1') { return { email: 'dev@local' }; }
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

/* ------------------------------------------------------------------ public */
const PUBLIC_COLS = 'id, nick, body, created, reply, reply_at';

async function list(env, url) {
    const target = url.searchParams.get('target') || '';
    if (!TARGET.test(target)) { return err(400, 'bad_target', 'Unknown page.'); }
    const rows = await env.DB.prepare('SELECT ' + PUBLIC_COLS + " FROM messages WHERE target = ? AND status = 'approved' ORDER BY created DESC LIMIT 200").bind(target).all();
    return new Response(JSON.stringify({ target, messages: rows.results || [] }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', 'x-robots-tag': 'noindex' }
    });
}

async function post(req, env, ctx) {
    let b = {};
    try { b = await req.json(); } catch (e) { /* empty */ }
    const target = String(b.target || ''), nick = clean(b.nick).replace(/\s+/g, ' '), body = clean(b.body);
    if (!TARGET.test(target)) { return err(400, 'bad_target', 'Unknown page.'); }
    if (!NICK.test(nick)) { return err(400, 'bad_nick', 'Nickname: 3 to 24 English letters or digits (spaces, _ . - allowed inside).'); }
    if (body.length < MIN_BODY || body.length > MAX_BODY) { return err(400, 'bad_length', 'Message: ' + MIN_BODY + ' to ' + MAX_BODY + ' characters.'); }
    if (!(await turnstileOk(env, b.token, req.headers.get('cf-connecting-ip')))) { return err(403, 'bot_check', 'The anti-bot check failed. Reload the page and try again.'); }

    const fp = await fingerprint(req);
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE fp = ? AND created > ?').bind(fp, now() - 3600).first();
    if (recent && recent.n >= MAX_PER_HOUR) { return err(429, 'too_fast', REJECT_TEXT.too_fast); }

    let status = 'approved', reason = 'ok';
    const whole = nick + '\n' + body;
    if (nonEnglishLetters(whole)) { status = 'rejected'; reason = 'english_only'; }
    else if (BAD_RE.test(whole)) { status = 'rejected'; reason = 'language'; }
    else {
        const ai = await aiCheck(env, nick, body);
        if (!ai.english) { status = 'rejected'; reason = 'english_only'; }
        else if (ai.verdict === 'block') { status = 'rejected'; reason = 'rules: ' + ai.why; }
        else if (ai.verdict === 'review') { status = 'pending'; reason = 'ai unsure: ' + ai.why; }
        if (status === 'approved' && LINK_RE.test(whole)) { status = 'pending'; reason = 'contains a link or handle'; }
    }
    const r = await env.DB.prepare('INSERT INTO messages (target, nick, body, status, reason, created, fp) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(target, nick, body, status, reason, now(), fp).run();
    const id = r.meta && r.meta.last_row_id;
    if (status === 'approved') { return json({ status: 'published', message: { id, nick, body, created: now(), reply: '', reply_at: 0 } }, 201); }
    if (status === 'pending') {
        const mail = notifyNow(env, 'VA Board: message waiting (' + placeName(target) + ')', waitingMail({ target, nick, body, reason }));
        if (ctx && ctx.waitUntil) { ctx.waitUntil(mail); } else { await mail; }
        return json({ status: 'pending', message: PENDING_TEXT }, 202);
    }
    const key = reason === 'english_only' ? 'english_only' : (reason === 'language' ? 'language' : 'rules');
    return json({ status: 'rejected', reason: key, message: REJECT_TEXT[key] }, 200);
}

async function report(req, env, ctx) {
    let b = {};
    try { b = await req.json(); } catch (e) { /* empty */ }
    const id = parseInt(b.id, 10);
    if (!(id > 0)) { return err(400, 'bad_id', 'Unknown message.'); }
    const r = await env.DB.prepare("UPDATE messages SET reports = reports + 1, status = 'pending', reason = 'reported by a reader' WHERE id = ? AND status = 'approved'").bind(id).run();
    if (r.meta && r.meta.changes) {                                        /* only the first report of a live message mails */
        const m = await env.DB.prepare('SELECT target, nick, body, reason FROM messages WHERE id = ?').bind(id).first();
        if (m) {
            const mail = notifyNow(env, 'VA Board: a reader reported a message (' + placeName(m.target) + ')',
                waitingMail(m).replace('A message is waiting', 'A reader reported a message. It is hidden now and waits').replace(' It is NOT public until you approve it.', ' APPROVE puts it back, DELETE removes it.'));
            if (ctx && ctx.waitUntil) { ctx.waitUntil(mail); } else { await mail; }
        }
    }
    return json({ ok: true, message: 'Thanks. The message is hidden until we check it.' });
}

/* ------------------------------------------------------------------ notifications (email to Aris) */
function placeName(t) {
    if (t === 'qa') { return 'Q&A'; }
    let m = /^issue:(\d+)(?:_(\d+))?$/.exec(t);
    if (m) { return 'Dead Drop #' + (m[1].length < 2 ? '0' + m[1] : m[1]) + (m[2] ? ' Part ' + m[2] : ''); }
    m = /^book:(.+)$/.exec(t);
    return m ? 'Vanguard: ' + m[1] : t;
}
async function sendMail(env, subject, text) {
    if (!env.MAILER || !env.NOTIFY_TO) { return false; }               /* not set up yet: stay quiet */
    try {
        await env.MAILER.send({ to: env.NOTIFY_TO, from: { email: env.NOTIFY_FROM || 'board@va-comics.com', name: 'VA Comics Board' }, subject, text });
        return true;
    } catch (e) { console.log('mail failed', e && e.message); return false; }
}
/* instant mail, at most MAX_MAILS_PER_HOUR (a flood of spam must not flood the inbox) */
async function notifyNow(env, subject, text) {
    try {
        const hour = Math.floor(now() / 3600);
        await env.DB.prepare('INSERT INTO notify (hour, n) VALUES (?, 1) ON CONFLICT(hour) DO UPDATE SET n = n + 1').bind(hour).run();
        const row = await env.DB.prepare('SELECT n FROM notify WHERE hour = ?').bind(hour).first();
        const n = row ? row.n : 1;
        if (n > MAX_MAILS_PER_HOUR) { return; }
        if (n === MAX_MAILS_PER_HOUR) { text += '\n\nThis is the last instant mail this hour. More messages may be waiting: check Foundry or the daily summary.'; }
        await sendMail(env, subject, text);
    } catch (e) { console.log('notify failed', e && e.message); }
}
function waitingMail(m) {
    return ['A message is waiting for you on ' + placeName(m.target) + '. It is NOT public until you approve it.', '',
        'Nickname: ' + m.nick, 'Why it waits: ' + m.reason, '', '----------', m.body, '----------', '',
        'Approve, reply or delete: ' + FOUNDRY_URL].join('\n');
}
async function dailySummary(env) {
    const day = now() - 86400;
    const c = async (sql, ...a) => ((await env.DB.prepare(sql).bind(...a).first()) || {}).n || 0;
    const published = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'approved' AND created > ?", day);
    const rejected = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'rejected' AND created > ?", day);
    const waiting = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'pending'");
    const reported = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'pending' AND reports > 0");
    if (!published && !rejected && !waiting) { return; }                 /* quiet day: no mail */
    const rows = await env.DB.prepare("SELECT target, nick, body FROM messages WHERE status = 'approved' AND created > ? ORDER BY created DESC LIMIT 15").bind(day).all();
    const lines = ['VA Comics board, last 24 hours:', '',
        'Published automatically: ' + published, 'Blocked by the filters: ' + rejected,
        'Waiting for you now: ' + waiting + (reported ? ' (' + reported + ' reported by readers)' : ''), ''];
    (rows.results || []).forEach(m => { lines.push('[' + placeName(m.target) + '] ' + m.nick + ': ' + (m.body.length > 160 ? m.body.slice(0, 160) + '...' : m.body)); });
    lines.push('', 'Foundry > BOARD: ' + FOUNDRY_URL);
    await sendMail(env, 'VA Board daily: ' + published + ' new, ' + waiting + ' waiting', lines.join('\n'));
}

/* ------------------------------------------------------------------ admin */
async function admin(req, env, path, url) {
    if (!(await verifyAccess(req, env))) { return err(403, 'forbidden', 'Admin only (log in to Foundry through Cloudflare Access).'); }
    if (path === 'summary' && req.method === 'GET') {
        const rows = await env.DB.prepare('SELECT target, status, COUNT(*) AS n FROM messages GROUP BY target, status').all();
        return json({ rows: rows.results || [] });
    }
    if (path === 'messages' && req.method === 'GET') {
        const st = url.searchParams.get('status') || 'pending', target = url.searchParams.get('target') || '';
        if (!['pending', 'approved', 'rejected', 'all'].includes(st)) { return err(400, 'bad_status', 'Bad status.'); }
        let sql = 'SELECT id, target, nick, body, status, reason, created, reply, reply_at, reports FROM messages WHERE 1=1', args = [];
        if (st !== 'all') { sql += ' AND status = ?'; args.push(st); }
        if (target) { if (!TARGET.test(target)) { return err(400, 'bad_target', 'Bad target.'); } sql += ' AND target = ?'; args.push(target); }
        sql += ' ORDER BY created DESC LIMIT 300';
        const rows = await env.DB.prepare(sql).bind(...args).all();
        return json({ messages: rows.results || [] });
    }
    const m = path.match(/^messages\/(\d+)(?:\/(approve|reply))?$/);
    if (m) {
        const id = parseInt(m[1], 10);
        if (m[2] === 'approve' && req.method === 'POST') {
            await env.DB.prepare("UPDATE messages SET status = 'approved', reason = 'approved by VA Comics', reports = 0 WHERE id = ?").bind(id).run();
            return json({ ok: true });
        }
        if (m[2] === 'reply' && req.method === 'POST') {
            let b = {}; try { b = await req.json(); } catch (e) { /* empty */ }
            const text = clean(b.text).slice(0, 2000);
            await env.DB.prepare('UPDATE messages SET reply = ?, reply_at = ? WHERE id = ?').bind(text, text ? now() : 0, id).run();
            return json({ ok: true });
        }
        if (!m[2] && req.method === 'DELETE') {
            await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
            return json({ ok: true });
        }
    }
    return err(404, 'not_found', 'Unknown admin action.');
}

/* ------------------------------------------------------------------ router + daily cleanup */
export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url), p = url.pathname;
        try {
            if (p.startsWith('/foundry/api/board/')) { return await admin(req, env, p.slice('/foundry/api/board/'.length), url); }
            if (!p.startsWith('/api/board/')) { return err(404, 'not_found', 'Not here.'); }
            const r = p.slice('/api/board/'.length);
            if (r === 'list' && req.method === 'GET') { return await list(env, url); }
            if ((r === 'post' || r === 'report') && req.method === 'POST') {
                const origin = req.headers.get('origin');
                if (origin && origin !== url.origin) { return err(403, 'bad_origin', 'Wrong origin.'); }
                return r === 'post' ? await post(req, env, ctx) : await report(req, env, ctx);
            }
            return err(404, 'not_found', 'Not here.');
        } catch (e) {
            return err(500, 'server', 'Something went wrong. Try again in a minute.');
        }
    },
    /* every night: forget the anonymous fingerprints after 2 days, delete rejected messages after 30 days, mail the summary */
    async scheduled(event, env) {
        try { await dailySummary(env); } catch (e) { console.log('summary failed', e && e.message); }
        await env.DB.prepare('DELETE FROM notify WHERE hour < ?').bind(Math.floor(now() / 3600) - 48).run();
        await env.DB.prepare("UPDATE messages SET fp = '' WHERE fp != '' AND created < ?").bind(now() - 2 * 86400).run();
        await env.DB.prepare("DELETE FROM messages WHERE status = 'rejected' AND created < ?").bind(now() - 30 * 86400).run();
    }
};
