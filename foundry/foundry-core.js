/* VA COMICS // Foundry v2 // foundry-core.js
   Pure functions: read, build and edit the News page (chronicles.html) and the issue list (viewer.html).
   No network, no page code here, so it can be tested on its own. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryCore = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ---------------------------- text helpers ---------------------------- */
    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function unesc(s) {
        return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    }
    function today() {
        var d = new Date(), m = String(d.getMonth() + 1), day = String(d.getDate());
        return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
    }
    function newId() { return 'post-' + Date.now(); }
    function safeComment(s) { return String(s).replace(/-->/g, '').replace(/--/g, '-').replace(/[\r\n]+/g, ' '); }

    /* a blank line = a new paragraph; a single line break = <br> */
    function bodyToHtml(text) {
        var paras = String(text).replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
        return paras.map(function (p) {
            return '          <p class="chronicle-p">' + esc(p).replace(/\n/g, '<br>') + '</p>';
        }).join('\n');
    }
    function bodyFromHtml(inner) {
        var out = [], re = /<p\b[^>]*>([\s\S]*?)<\/p>/g, m;
        while ((m = re.exec(inner))) {
            out.push(unesc(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim());
        }
        return out.join('\n\n');
    }

    /* ---------------------------- NEWS (chronicles.html) ---------------------------- */
    var MARKER = /<!--\s*Postările noi de la Foundry vor apărea aici\s*-->/;
    var ARTICLE = /(?:[ \t]*<!--\s*CHRONICLE ENTRY:[\s\S]*?-->[ \t]*\r?\n)?[ \t]*<article class="chronicle-post" id="([^"]+)">[\s\S]*?<\/article>[ \t]*\r?\n?/g;

    function buildPost(p) {
        var id = p.id || newId();
        return '        <!-- CHRONICLE ENTRY: ' + safeComment(p.date) + ' - ' + safeComment(String(p.title).toUpperCase()) + ' -->\n' +
            '      <article class="chronicle-post" id="' + esc(id) + '">\n' +
            '        <header class="post-header">\n' +
            '          <div class="post-badge font-mono-hud">' + esc(p.badge) + '</div>\n' +
            '          <h2 class="post-title">' + esc(p.title) + '</h2>\n' +
            '          <div class="post-meta font-mono-hud">\n' +
            '            <span class="meta-item">AUTHOR: <strong class="meta-author">' + esc(p.author) + '</strong></span>\n' +
            '            <span class="meta-divider">//</span>\n' +
            '            <span class="meta-item">DATE: <time>' + esc(p.date) + '</time></span>\n' +
            '          </div>\n' +
            '        </header>\n' +
            '        <div class="post-body">\n' + bodyToHtml(p.body) + '\n        </div>\n' +
            '      </article>\n';
    }

    function parsePost(block, id) {
        function pick(re) { var m = re.exec(block); return m ? unesc(m[1]).trim() : ''; }
        var bodyM = /<div class="post-body">([\s\S]*?)<\/div>\s*<\/article>/.exec(block);
        return {
            id: id,
            badge: pick(/<div class="post-badge[^"]*">([\s\S]*?)<\/div>/),
            title: pick(/<h2 class="post-title">([\s\S]*?)<\/h2>/),
            author: pick(/<strong class="meta-author">([\s\S]*?)<\/strong>/),
            date: pick(/<time>([\s\S]*?)<\/time>/),
            body: bodyM ? bodyFromHtml(bodyM[1]) : ''
        };
    }

    function listPosts(html) {
        var out = [], m;
        ARTICLE.lastIndex = 0;
        while ((m = ARTICLE.exec(html))) { out.push(parsePost(m[0], m[1])); }
        return out;
    }

    function insertPost(html, p) {
        var m = MARKER.exec(html);
        if (!m) { throw new Error('Marker comment not found in chronicles.html ("Postările noi de la Foundry vor apărea aici").'); }
        var at = m.index + m[0].length;
        return html.slice(0, at) + '\n' + buildPost(p) + html.slice(at).replace(/^\r?\n/, '');
    }

    function findPost(html, id) {
        var m; ARTICLE.lastIndex = 0;
        while ((m = ARTICLE.exec(html))) { if (m[1] === id) { return { start: m.index, end: m.index + m[0].length }; } }
        return null;
    }
    function replacePost(html, id, p) {
        var f = findPost(html, id);
        if (!f) { throw new Error('Post not found: ' + id); }
        p.id = id;
        return html.slice(0, f.start) + buildPost(p) + html.slice(f.end);
    }
    function deletePost(html, id) {
        var f = findPost(html, id);
        if (!f) { throw new Error('Post not found: ' + id); }
        return html.slice(0, f.start) + html.slice(f.end);
    }

    /* ---------------------------- ISSUES (viewer.html) ---------------------------- */
    var DB_ROW = /^[ \t]*"([\w]+)"\s*:\s*\{\s*title:\s*("(?:[^"\\]|\\.)*")\s*,\s*badge:\s*("(?:[^"\\]|\\.)*")\s*,\s*pages:\s*buildPages\(\s*"([^"]+)"\s*,\s*(\d+)\s*\)\s*\}\s*,?\s*$/gm;

    function parseIssues(html) {
        var a = html.indexOf('const COMICS_DATABASE'); if (a < 0) { throw new Error('COMICS_DATABASE not found in viewer.html'); }
        var b = html.indexOf('\n        };', a); if (b < 0) { b = html.indexOf('};', a); }
        var block = html.slice(a, b), out = [], m; DB_ROW.lastIndex = 0;
        while ((m = DB_ROW.exec(block))) {
            out.push({ key: m[1], title: JSON.parse(m[2]), badge: JSON.parse(m[3]), folder: m[4], pages: parseInt(m[5], 10) });
        }
        return out;
    }

    function suggestBadge(key) {
        var p = String(key).split('_'), n = parseInt(p[0], 10);
        if (isNaN(n)) { return ''; }
        return 'ISSUE #' + (n < 10 ? '0' + n : n) + (p[1] ? ' [PT ' + p[1] + ']' : '');
    }
    function suggestFolder(key) {
        var p = String(key).split('_');
        return 'issue' + p[0] + (p[1] ? '_p' + p[1] : '');
    }
    function coverFile(key) { return key === '11_1' ? 'cover11p1' : key === '11_2' ? 'cover11p2' : 'cover' + key; }

    function addIssue(html, it) {
        if (!/^[\w]+$/.test(it.key)) { throw new Error('The key can only have letters, digits and _ (example: 14 or 14_1).'); }
        if (!/^[\w\-]+$/.test(it.folder)) { throw new Error('The folder name can only have letters, digits, - and _.'); }
        if (!(it.pages > 0)) { throw new Error('The page count must be a number above 0.'); }
        if (parseIssues(html).some(function (x) { return x.key === it.key; })) { throw new Error('Issue ' + it.key + ' already exists.'); }
        var a = html.indexOf('const COMICS_DATABASE'); if (a < 0) { throw new Error('COMICS_DATABASE not found in viewer.html'); }
        var close = html.indexOf('\n        };', a);
        if (close < 0) { throw new Error('Could not find the end of COMICS_DATABASE.'); }
        var before = html.slice(0, close).replace(/\s+$/, '');
        if (!/,$/.test(before)) { before += ','; }
        var row = '\n            ' + JSON.stringify(it.key) + ': { title: ' + JSON.stringify(it.title) + ', badge: ' + JSON.stringify(it.badge) +
            ', pages: buildPages(' + JSON.stringify(it.folder) + ', ' + it.pages + ') }';
        return before + row + html.slice(close);
    }

    return {
        today: today, newId: newId,
        buildPost: buildPost, listPosts: listPosts, insertPost: insertPost, replacePost: replacePost, deletePost: deletePost,
        parseIssues: parseIssues, addIssue: addIssue, suggestBadge: suggestBadge, suggestFolder: suggestFolder, coverFile: coverFile
    };
});
