/* VA COMICS // Foundry v2 // foundry-gh.js
   Talks to the GitHub API: read a file, write a file (always a fresh read first), upload an image.
   The token is passed in by the page and is never stored here. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FoundryGH = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function toB64(str) {
        var bytes = new TextEncoder().encode(str), bin = '';
        for (var i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
        return btoa(bin);
    }
    function fromB64(b64) {
        var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        return new TextDecoder().decode(bytes);
    }

    function make(cfg, fetchImpl) {
        var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        var base = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo;

        function call(path, opts) {
            opts = opts || {};
            opts.headers = Object.assign({
                'Authorization': 'Bearer ' + cfg.token,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }, opts.headers || {});
            return f(path, opts).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    if (!r.ok) {
                        var msg = (j && j.message) || ('GitHub error ' + r.status);
                        if (r.status === 401) { msg = 'The token is not valid (or it expired). Make a new one in Settings.'; }
                        else if (r.status === 403 || r.status === 404) { msg += ' (check that the token has "Contents: Read and write" on this repository)'; }
                        else if (r.status === 409 || r.status === 422) { msg = 'The file changed on GitHub in the meantime. Reload and try again. (' + msg + ')'; }
                        var err = new Error(msg); err.status = r.status; throw err;
                    }
                    return j;
                });
            });
        }
        function contentsUrl(path) { return base + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }

        return {
            whoami: function () { return call('https://api.github.com/user'); },
            repoInfo: function () { return call(base); },
            /* fresh copy of a text file: { text, sha } */
            getFile: function (path) {
                return call(contentsUrl(path) + '?ref=' + encodeURIComponent(cfg.branch) + '&t=' + Date.now()).then(function (j) {
                    if (j.encoding !== 'base64' || typeof j.content !== 'string') { throw new Error('Could not read ' + path); }
                    return { text: fromB64(j.content), sha: j.sha };
                });
            },
            putFile: function (path, text, sha, message) {
                return call(contentsUrl(path), { method: 'PUT', body: JSON.stringify({ message: message, content: toB64(text), sha: sha, branch: cfg.branch }) });
            },
            /* image / binary: b64 is already base64; replaces the file if it exists */
            putBinary: function (path, b64, message) {
                return call(contentsUrl(path) + '?ref=' + encodeURIComponent(cfg.branch) + '&t=' + Date.now())
                    .then(function (j) { return j.sha; }, function (e) { if (e.status === 404) { return null; } throw e; })
                    .then(function (sha) {
                        var body = { message: message, content: b64, branch: cfg.branch };
                        if (sha) { body.sha = sha; }
                        return call(contentsUrl(path), { method: 'PUT', body: JSON.stringify(body) });
                    });
            },
            /* read the freshest copy, change it with fn(text), write it back */
            update: function (path, fn, message, guard) {
                var self = this;
                return self.getFile(path).then(function (cur) {
                    var next = fn(cur.text);
                    if (guard) { guard(cur.text, next); }   /* throws = nothing is saved */
                    return self.putFile(path, next, cur.sha, message);
                });
            }
        };
    }
    return { make: make, toB64: toB64, fromB64: fromB64 };
});
