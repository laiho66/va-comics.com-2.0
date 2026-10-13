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
/* other-language swearing typed with plain letters (the AI also rejects non-English text; this is a fast extra net) */
const FOREIGN_BAD = ['pula', 'pizda', 'muie', 'futu', 'futui', 'fut', 'cacat', 'curva', 'coaie', 'sugi', 'labagiu', 'bulangiu', 'handicapat',
    'kurva', 'geci', 'baszd', 'cazzo', 'puta', 'mierda', 'scheisse', 'blyat', 'suka'];
const FOREIGN_RE = new RegExp('\\b(' + FOREIGN_BAD.join('|') + ')\\b', 'i');
/* roots searched INSIDE letters someone spaced out on purpose ("f u c k", "s.u.g.i p.u.l.a") */
const SPACED_ROOTS = ['fuck', 'fuk', 'shit', 'cunt', 'dick', 'cock', 'pusy', 'bitch', 'whore', 'slut', 'niger', 'niga', 'fag', 'porn', 'rape',
    'pula', 'pizda', 'muie', 'futu', 'sugi', 'cacat', 'curva', 'kurva', 'puta'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '|': 'i' };
/* turn tricks back into plain words: f.u.c.k / f u c k / fuuuuck / sh1t / $hit */
function normalizeTricks(s) {
    let t = String(s).toLowerCase().replace(/[013457@$|]/g, c => LEET[c]);
    t = t.replace(/([a-z])\1{2,}/g, '$1$1');                              /* fuuuuck -> fuuck */
    return t;
}
function trickyBad(s) {
    const t = normalizeTricks(s);
    if (BAD_RE.test(t) || FOREIGN_RE.test(t) || BAD_RE.test(t.replace(/([a-z])\1+/g, '$1'))) { return true; }
    /* runs of single letters split by spaces / dots / dashes / stars: join them and look for the roots inside */
    const runs = t.match(/(?:\b[a-z][\s.\-_*+~,]+){2,}[a-z]\b/g) || [];
    return runs.some(r => { const j = r.replace(/[^a-z]/g, '').replace(/([a-z])\1+/g, '$1'); return SPACED_ROOTS.some(w => j.includes(w)); });
}
/* nobody but the studio signs as the studio */
const RESERVED_NICK = /(va[\W_]*comics|\badmin|moderator|\bmod\b|aris\s*menethil|alexi\s*void|official)/i;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|info|biz|link|top|shop|site|online|ro|hu|co)\b|@[a-z0-9_]{3,}\b)/i;

const REJECT_TEXT = {
    english_only: 'Messages in English only, please.',
    language: 'Your message was not published: please keep it clean (no swearing, sexual, religious or hateful content).',
    rules: 'Your message was not published because it does not follow the board rules.',
    too_fast: 'You are posting too fast. Try again in an hour.'
};
const MAX_REPLIES = 100;                /* per thread */
const STAFF_NICK = 'VA Comics';
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
    'personal data (phone numbers, addresses, emails). Watch for tricks: words split with spaces or dots, letters swapped for digits or symbols, ' +
    'and swearing in other languages written without accents (for example Romanian) - treat those as breaking the rules or as not English. Talking about the story, characters, violence in the story, art, questions to the author, praise or polite criticism is fine. ' +
    'Answer with JSON: english (true if the message is written in English), verdict ("ok" if it clearly follows every rule, "block" if it clearly breaks a rule, ' +
    '"review" if you are not sure), why (a few words).';
async function aiCheck(env, nick, body) {
    if (typeof env.DEV_FAKE_AI === 'function') { return env.DEV_FAKE_AI(nick, body); }   /* local tests only */
    if (!env.AI) { return { verdict: 'review', english: true, why: 'no ai' }; }
    try {
        const r = await env.AI.run(AI_MODEL, {
            messages: [{ role: 'system', content: MOD_PROMPT }, { role: 'user', content: 'Nickname: ' + nick + '\nComment:\n' + body + '\n\n(Same comment with tricks undone, for checking only: ' + normalizeTricks(body).replace(/(\b[a-z])[\s.\-_*]+(?=[a-z]\b)/g, '$1') + ')' }],
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
const PUBLIC_COLS = 'id, nick, body, created, reply, reply_at, staff, parent, reply_to';

async function list(env, url) {
    const target = url.searchParams.get('target') || '';
    if (!TARGET.test(target)) { return err(400, 'bad_target', 'Unknown page.'); }
    const rows = await env.DB.prepare('SELECT ' + PUBLIC_COLS + " FROM messages WHERE target = ? AND status = 'approved' AND parent = 0 ORDER BY created DESC, id DESC LIMIT 200").bind(target).all();
    const tops = rows.results || [];
    const reps = tops.length ? ((await env.DB.prepare('SELECT ' + PUBLIC_COLS + " FROM messages WHERE target = ? AND status = 'approved' AND parent > 0 ORDER BY created ASC, id ASC LIMIT 2000").bind(target).all()).results || []) : [];
    const byId = {}; tops.forEach(m => { m.replies = []; byId[m.id] = m; });
    reps.forEach(r => { if (byId[r.parent]) { byId[r.parent].replies.push(r); } });
    return new Response(JSON.stringify({ target, messages: tops }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', 'x-robots-tag': 'noindex' }
    });
}

async function post(req, env, ctx) {
    let b = {};
    try { b = await req.json(); } catch (e) { /* empty */ }
    const target = String(b.target || ''), nick = clean(b.nick).replace(/\s+/g, ' '), body = clean(b.body), mention = clean(b.mention).replace(/\s+/g, ' ').slice(0, 24);
    if (!TARGET.test(target)) { return err(400, 'bad_target', 'Unknown page.'); }
    if (!NICK.test(nick)) { return err(400, 'bad_nick', 'Nickname: 3 to 24 English letters or digits (spaces, _ . - allowed inside).'); }
    if (RESERVED_NICK.test(nick)) { return err(400, 'bad_nick', 'That nickname is reserved. Please pick another one.'); }
    let parent = parseInt(b.parent, 10) || 0, top = null;
    if (parent) {
        top = await env.DB.prepare("SELECT id, target, parent, nick, body, reply, staff FROM messages WHERE id = ? AND status = 'approved'").bind(parent).first();
        if (top && top.parent) { parent = top.parent; top = await env.DB.prepare("SELECT id, target, parent, nick, body, reply, staff FROM messages WHERE id = ? AND status = 'approved'").bind(parent).first(); }
        if (!top || top.target !== target) { return err(400, 'bad_parent', 'That conversation is not available any more. Reload the page.'); }
        const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE parent = ?').bind(parent).first();
        if (n && n.n >= MAX_REPLIES) { return err(400, 'thread_full', 'This conversation is full. Start a new one above.'); }
    }
    let replyTo = parseInt(b.reply_to, 10) || 0, at = mention;
    if (replyTo) {                                                       /* the exact message this answers (the starter or a reply in the same conversation) */
        const rt = parent ? await env.DB.prepare("SELECT id, nick, staff, parent FROM messages WHERE id = ? AND status = 'approved' AND (id = ? OR parent = ?)").bind(replyTo, parent, parent).first() : null;
        if (!rt) { return err(400, 'bad_parent', 'That message is not available any more. Reload the page.'); }
        at = rt.id === parent ? '' : (rt.staff ? STAFF_NICK : rt.nick);   /* answering the starter needs no @name */
    } else if (mention && !(await inThread(env, parent, mention))) { return err(400, 'bad_mention', 'That person is not in this conversation.'); }
    if (body.length < MIN_BODY || body.length > MAX_BODY) { return err(400, 'bad_length', 'Message: ' + MIN_BODY + ' to ' + MAX_BODY + ' characters.'); }
    if (!(await turnstileOk(env, b.token, req.headers.get('cf-connecting-ip')))) { return err(403, 'bot_check', 'The anti-bot check failed. Reload the page and try again.'); }

    const fp = await fingerprint(req);
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE fp = ? AND created > ?').bind(fp, now() - 3600).first();
    if (recent && recent.n >= MAX_PER_HOUR) { return err(429, 'too_fast', REJECT_TEXT.too_fast); }

    let status = 'approved', reason = 'ok';
    const whole = nick + '\n' + body;
    if (nonEnglishLetters(whole)) { status = 'rejected'; reason = 'english_only'; }
    else if (BAD_RE.test(whole) || trickyBad(whole)) { status = 'rejected'; reason = 'language'; }
    else {
        const ai = await aiCheck(env, nick, body);
        if (!ai.english) { status = 'rejected'; reason = 'english_only'; }
        else if (ai.verdict === 'block') { status = 'rejected'; reason = 'rules: ' + ai.why; }
        else if (ai.verdict === 'review') { status = 'pending'; reason = 'ai unsure: ' + ai.why; }
        if (status === 'approved' && LINK_RE.test(whole)) { status = 'pending'; reason = 'contains a link or handle'; }
    }
    const stored = at ? '@' + at + ' ' + body : body;             /* the @name is added by the server, so it never trips the link filter */
    const r = await env.DB.prepare('INSERT INTO messages (target, nick, body, status, reason, created, fp, parent, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(target, nick, stored, status, reason, now(), fp, parent, replyTo).run();
    const id = r.meta && r.meta.last_row_id;
    if (status === 'approved') {
        if (top) {                                                         /* a reader answered back in a conversation where the studio already spoke: tell Aris */
            const spoke = top.reply || top.staff || (await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE parent = ? AND staff = 1 AND status = 'approved'").bind(parent).first() || {}).n;
            if (spoke) {
                const mail = notifyNow(env, 'VA Board: new reply on ' + placeName(target), ['A reader replied in a conversation you are part of (' + placeName(target) + ').', '',
                    'Started by ' + top.nick + ': ' + (top.body.length > 160 ? top.body.slice(0, 160) + '...' : top.body), '',
                    'New reply from ' + nick + ':', '----------', body, '----------', '', 'Answer it: ' + FOUNDRY_URL].join('\n'));
                if (ctx && ctx.waitUntil) { ctx.waitUntil(mail); } else { await mail; }
            }
        }
        return json({ status: 'published', message: { id, nick, body: stored, created: now(), reply: '', reply_at: 0, staff: 0, parent, reply_to: replyTo, replies: [] } }, 201);
    }
    if (status === 'pending') {
        const mail = notifyNow(env, 'VA Board: message waiting (' + placeName(target) + ')', waitingMail({ target, nick, body: stored, reason, parent, top }));
        if (ctx && ctx.waitUntil) { ctx.waitUntil(mail); } else { await mail; }
        return json({ status: 'pending', message: PENDING_TEXT }, 202);
    }
    const key = reason === 'english_only' ? 'english_only' : (reason === 'language' ? 'language' : 'rules');
    return json({ status: 'rejected', reason: key, message: REJECT_TEXT[key] }, 200);
}

/* is this nickname part of conversation #top (the starter, a reply, or the studio)? */
async function inThread(env, top, who) {
    if (!top) { return false; }
    if (who.toLowerCase() === STAFF_NICK.toLowerCase()) { return true; }
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE (id = ? OR parent = ?) AND status = 'approved' AND lower(nick) = lower(?)").bind(top, top, who).first();
    return !!(r && r.n);
}

async function report(req, env, ctx) {
    let b = {};
    try { b = await req.json(); } catch (e) { /* empty */ }
    const id = parseInt(b.id, 10);
    if (!(id > 0)) { return err(400, 'bad_id', 'Unknown message.'); }
    const r = await env.DB.prepare("UPDATE messages SET reports = reports + 1, status = 'pending', reason = 'reported by a reader' WHERE id = ? AND status = 'approved' AND staff = 0").bind(id).run();
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
        ...(m.top ? ['It is a reply to ' + m.top.nick + ': ' + (m.top.body.length > 120 ? m.top.body.slice(0, 120) + '...' : m.top.body), ''] : []),
        'Nickname: ' + m.nick, 'Why it waits: ' + m.reason, '', '----------', m.body, '----------', '',
        'Approve, reply or delete: ' + FOUNDRY_URL].join('\n');
}
async function dailySummary(env) {
    const day = now() - 86400;
    const c = async (sql, ...a) => ((await env.DB.prepare(sql).bind(...a).first()) || {}).n || 0;
    const published = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'approved' AND staff = 0 AND created > ?", day);
    const rejected = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'rejected' AND created > ?", day);
    const waiting = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'pending'");
    const reported = await c("SELECT COUNT(*) AS n FROM messages WHERE status = 'pending' AND reports > 0");
    if (!published && !rejected && !waiting) { return; }                 /* quiet day: no mail */
    const rows = await env.DB.prepare("SELECT target, nick, body FROM messages WHERE status = 'approved' AND staff = 0 AND created > ? ORDER BY created DESC LIMIT 15").bind(day).all();
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
    if (path === 'whoami' && req.method === 'GET') { return json({ ok: true, staff: STAFF_NICK }); }
    if (path === 'post' && req.method === 'POST') {                  /* the studio writes straight from the site (logged in through Access) */
        let b = {}; try { b = await req.json(); } catch (e) { /* empty */ }
        const target = String(b.target || ''), text = clean(b.body).slice(0, 2000), mention = clean(b.mention).replace(/\s+/g, ' ').slice(0, 24);
        if (!TARGET.test(target)) { return err(400, 'bad_target', 'Unknown page.'); }
        if (text.length < 1) { return err(400, 'empty', 'Write the message first.'); }
        let parent = parseInt(b.parent, 10) || 0, replyTo = parseInt(b.reply_to, 10) || 0, at = parent ? mention : '';
        if (parent) {
            const t = await env.DB.prepare('SELECT id, target, parent FROM messages WHERE id = ?').bind(parent).first();
            if (!t || t.target !== target) { return err(400, 'bad_parent', 'That conversation is not available any more.'); }
            parent = t.parent || t.id;
        }
        if (replyTo && parent) {
            const rt = await env.DB.prepare('SELECT id, nick, staff FROM messages WHERE id = ? AND (id = ? OR parent = ?)').bind(replyTo, parent, parent).first();
            if (!rt) { return err(400, 'bad_parent', 'That message is not available any more.'); }
            at = rt.id === parent ? '' : (rt.staff ? STAFF_NICK : rt.nick);
        } else { replyTo = 0; }
        const body = at ? '@' + at + ' ' + text : text;
        const r = await env.DB.prepare("INSERT INTO messages (target, nick, body, status, reason, created, staff, parent, reply_to) VALUES (?, ?, ?, 'approved', 'VA Comics', ?, 1, ?, ?)")
            .bind(target, STAFF_NICK, body, now(), parent, replyTo).run();
        const id = r.meta && r.meta.last_row_id;
        return json({ status: 'published', message: { id, nick: STAFF_NICK, body, created: now(), reply: '', reply_at: 0, staff: 1, parent, reply_to: replyTo, replies: [] } }, 201);
    }
    if (path === 'summary' && req.method === 'GET') {
        const rows = await env.DB.prepare('SELECT target, status, COUNT(*) AS n FROM messages GROUP BY target, status').all();
        return json({ rows: rows.results || [] });
    }
    if (path === 'messages' && req.method === 'GET') {
        const st = url.searchParams.get('status') || 'pending', target = url.searchParams.get('target') || '';
        if (!['pending', 'approved', 'rejected', 'all'].includes(st)) { return err(400, 'bad_status', 'Bad status.'); }
        let sql = 'SELECT m.id, m.target, m.nick, m.body, m.status, m.reason, m.created, m.reply, m.reply_at, m.reports, m.staff, m.parent, m.reply_to, ' +
            "(SELECT p.nick || ': ' || substr(p.body, 1, 140) FROM messages p WHERE p.id = CASE WHEN m.reply_to > 0 THEN m.reply_to ELSE m.parent END) AS parent_text, " +
            "(SELECT COUNT(*) FROM messages c WHERE c.parent = m.id) AS n_replies FROM messages m WHERE 1=1", args = [];
        if (st !== 'all') { sql += ' AND m.status = ?'; args.push(st); }
        if (target) { if (!TARGET.test(target)) { return err(400, 'bad_target', 'Bad target.'); } sql += ' AND m.target = ?'; args.push(target); }
        sql += ' ORDER BY m.created DESC, m.id DESC LIMIT 300';
        const rows = await env.DB.prepare(sql).bind(...args).all();
        return json({ messages: rows.results || [] });
    }
    const m = path.match(/^messages\/(\d+)(?:\/(approve|reply|answer))?$/);
    if (m) {
        const id = parseInt(m[1], 10);
        if (m[2] === 'approve' && req.method === 'POST') {
            await env.DB.prepare("UPDATE messages SET status = 'approved', reason = 'approved by VA Comics', reports = 0 WHERE id = ?").bind(id).run();
            return json({ ok: true });
        }
        if (m[2] === 'answer' && req.method === 'POST') {          /* the studio writes in the conversation (as VA Comics) */
            let b = {}; try { b = await req.json(); } catch (e) { /* empty */ }
            const text = clean(b.text).slice(0, 2000);
            if (text.length < 1) { return err(400, 'empty', 'Write the answer first.'); }
            const t = await env.DB.prepare('SELECT id, target, parent FROM messages WHERE id = ?').bind(id).first();
            if (!t) { return err(404, 'not_found', 'Message not found.'); }
            const top = t.parent || t.id;
            const who = t.parent ? await env.DB.prepare('SELECT nick, staff FROM messages WHERE id = ?').bind(t.id).first() : null;
            const body = who ? '@' + (who.staff ? STAFF_NICK : who.nick) + ' ' + text : text;
            await env.DB.prepare("INSERT INTO messages (target, nick, body, status, reason, created, staff, parent, reply_to) VALUES (?, ?, ?, 'approved', 'VA Comics answer', ?, 1, ?, ?)")
                .bind(t.target, STAFF_NICK, body, now(), top, t.id).run();
            return json({ ok: true });
        }
        if (m[2] === 'reply' && req.method === 'POST') {
            let b = {}; try { b = await req.json(); } catch (e) { /* empty */ }
            const text = clean(b.text).slice(0, 2000);
            await env.DB.prepare('UPDATE messages SET reply = ?, reply_at = ? WHERE id = ?').bind(text, text ? now() : 0, id).run();
            return json({ ok: true });
        }
        if (!m[2] && req.method === 'DELETE') {
            await env.DB.prepare('DELETE FROM messages WHERE id = ? OR parent = ?').bind(id, id).run();   /* a conversation goes with its replies */
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
            if (p.startsWith('/foundry/api/board/')) {
                const o = req.headers.get('origin');
                if (req.method !== 'GET' && o && o !== url.origin) { return err(403, 'bad_origin', 'Wrong origin.'); }
                return await admin(req, env, p.slice('/foundry/api/board/'.length), url);
            }
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
