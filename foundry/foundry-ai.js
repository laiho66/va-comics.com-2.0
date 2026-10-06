/* VA COMICS // Foundry v2 // foundry-ai.js
   The AI draft helper (Claude). It only PREPARES text: nothing is ever published from here.
   The API key is passed in by the page and is never stored in this file. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryAI = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var API = 'https://api.anthropic.com/v1';
    var DEFAULT_MODEL = 'claude-sonnet-5-5';

    /* Facts the AI may use. The page shows them in a box you can edit before each draft. */
    var STUDIO_FACTS = [
        'VA Comics is an independent studio with two projects: Dead Drop and Vanguard Chronicles.',
        'Dead Drop is a dark tech-noir comic series set in Terminus City. 13 issues so far: Volume 1 is issues 1-8, Volume 2 is issues 9-13. It is for readers 18+. Every issue can be read online at va-comics.com/media/viewer and is sold on Amazon (eBook for all issues, paperback for issues 1-9).',
        'Vanguard Chronicles is a series of illustrated historical tech-adventure novels, PG-13. Book 1, The Sunken Pharaoh, came out on September 20, 2026 on Amazon (eBook, paperback and hardcover).',
        'The books are sold only on Amazon. The studio is reachable only through its official Facebook page and its X account (@VAComics).'
    ].join('\n');

    var KINDS = {
        update: 'a general news update',
        release: 'a release announcement',
        behind: 'a behind-the-scenes post',
        thanks: 'a thank-you note to readers'
    };
    var LENGTHS = { short: 90, medium: 170, long: 280 };

    var SYSTEM =
        'You write short news posts for VA Comics, an independent comics and illustrated-novel studio, for the News page of its website.\n' +
        'Voice: direct, human, a little gritty, confident, never corporate. Write as the studio, using "we". English only.\n' +
        'Rules: no hype words (thrilled, excited, delighted, proud to announce), no emojis, no hashtags, no markdown, no bullet lists, no em dashes.\n' +
        'Never invent facts: no dates, numbers, prices, titles, features, quotes or links that are not in the notes or in the studio facts. If something is unknown, stay general or leave it out.\n' +
        'Output format, exactly: the first line is "TITLE: " followed by the title (80 characters at most), then one blank line, then the body as plain-text paragraphs separated by blank lines. Nothing else: no preface, no closing remarks.';

    function buildPrompt(o) {
        var facts = (o.facts || '').trim();
        if (o.mode === 'improve') {
            return 'Improve the draft below. Fix grammar, make it tighter and more natural, keep the meaning and every fact exactly as they are, keep the author\'s voice. Do not add any new facts. ' +
                'Keep the same title unless it clearly needs work.' + (o.title ? ' Current title: ' + o.title + '.' : '') +
                '\n\nDRAFT:\n' + String(o.text || '').trim();
        }
        var words = LENGTHS[o.length] || LENGTHS.medium;
        return 'Write ' + (KINDS[o.kind] || KINDS.update) + ' of about ' + words + ' words, based on these notes:\n\n' + String(o.idea || '').trim() +
            (facts ? '\n\nStudio facts you may use (only if they fit):\n' + facts : '');
    }

    /* "TITLE: ..." + blank line + body  ->  { title, body } */
    function parseDraft(text) {
        var t = String(text || '').replace(/\r/g, '').replace(/```[a-z]*\n?/gi, '').trim();
        var title = '', m = /^\s*#*\s*(?:\*\*)?TITLE:?(?:\*\*)?\s*(.+)$/im.exec(t);
        if (m) { title = m[1].trim(); t = t.slice(0, m.index) + t.slice(m.index + m[0].length); }
        title = title.replace(/^["'“”]+|["'“”]+$/g, '').replace(/[*`]/g, '').replace(/^#+\s*/, '').trim().slice(0, 120);
        var body = t.replace(/^\s*(?:\*\*)?(?:BODY|TEXT):?(?:\*\*)?\s*/i, '').replace(/[*`]/g, '').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-•]\s+/gm, '').trim();
        /* single line breaks between long lines were meant as paragraphs */
        if (!/\n\s*\n/.test(body) && body.split('\n').length > 1) { body = body.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n\n'); }
        body = body.replace(/\n{3,}/g, '\n\n');
        return { title: title, body: body };
    }

    function make(cfg, fetchImpl) {
        var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        function headers() {
            return {
                'content-type': 'application/json',
                'x-api-key': cfg.key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'   /* required for calls straight from a browser */
            };
        }
        function call(url, opts) {
            opts = opts || {}; opts.headers = headers();
            return f(url, opts).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    if (!r.ok) {
                        var raw = (j && j.error && j.error.message) || ('Claude API error ' + r.status), msg = raw;
                        if (r.status === 401) { msg = 'The Claude API key is not valid. Check it in Settings.'; }
                        else if (/credit balance/i.test(raw)) { msg = 'The Claude API account has no credit. Add a few dollars at console.anthropic.com → Billing, then try again.'; }
                        else if (r.status === 404) { msg = 'The model "' + cfg.model + '" was not found. Press LIST_MODELS and choose one from the list.'; }
                        else if (r.status === 429) { msg = 'Too many requests, or the rate limit was reached. Wait a minute and try again.'; }
                        else if (r.status === 529 || r.status === 503) { msg = 'Claude is overloaded right now. Try again in a minute.'; }
                        var e = new Error(msg); e.status = r.status; throw e;
                    }
                    return j;
                });
            });
        }
        return {
            listModels: function () {
                return call(API + '/models?limit=100').then(function (j) {
                    return (j.data || []).map(function (m) { return m.id; }).filter(function (id) { return /^claude/.test(id); });
                });
            },
            /* o: { mode, kind, length, idea, text, title, facts }  ->  { title, body } */
            draft: function (o) {
                var body = { model: cfg.model || DEFAULT_MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content: buildPrompt(o) }] };
                return call(API + '/messages', { method: 'POST', body: JSON.stringify(body) }).then(function (j) {
                    var text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
                    if (!text.trim()) { throw new Error('Claude returned an empty answer. Try again.'); }
                    var d = parseDraft(text);
                    if (!d.body) { throw new Error('Could not read the draft from the answer. Try again.'); }
                    return d;
                });
            }
        };
    }
    return { make: make, buildPrompt: buildPrompt, parseDraft: parseDraft, STUDIO_FACTS: STUDIO_FACTS, DEFAULT_MODEL: DEFAULT_MODEL, SYSTEM: SYSTEM };
});
