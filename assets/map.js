/* VA COMICS // map.js  (v2, nov 2026)
   The Terminus City map on /deaddrop/map.html: an image (map-bg.webp) with an SVG layer on top.
   Hover = quick card, click / tap / Enter = sector file in the panel. Foundry = "classified" modal only.
   Zoom: mouse wheel, pinch, + / - buttons. Drag to move. Layers: SECTOR_GRID, TRANSIT.
   EDIT ZONE = SECTORS (texts). status + security come from THE SECTOR MASTER PROFILES (Drive).
   "seen" = [issue key, label] -> /deaddrop/issue-N.html
   Links: /deaddrop/map#sector-07 (old links like #stone still work), /deaddrop/map#foundry
   No spoilers: atmosphere only. */
(function () {
    'use strict';
    var info = document.getElementById('tcInfo'), map = document.getElementById('tcMap'), list = document.getElementById('tcList');
    var view = document.getElementById('tcView'), pan = document.getElementById('tcPan'), card = document.getElementById('tcCard');
    var col = document.getElementById('tcCol'), modal = document.getElementById('tcModal');
    if (!info || !map || !view || !pan) { return; }

    /* ---------- EDIT ZONE ---------- */
    var SECTORS = {
        "dredge":  { "code": "S-00", "name": "The Dredge", "tier": "The Deep South", "glow": "150, 180, 200",
            "status": "Non-habitable. Workable, off-grid.", "security": "Zero. The Grid ends before the piers.",
            "text": "Sinking piers and fog thick enough to swallow the lamps. This is where the grid ends.", "seen": [] },
        "slums":   { "code": "S-01", "name": "The Slums", "tier": "The Bottom", "glow": "255, 106, 26",
            "status": "Habitable, maximum density.", "security": "Negligent control. The streets keep their own order.",
            "text": "High-density decay under permanent rain. The Vance family lives here, and the Iron Kings keep what passes for order.",
            "seen": [["5", "#05 Ghost in the Machine"], ["6", "#06 Terminal Protocol Part I"]] },
        "throat":  { "code": "S-02", "name": "The Throat", "tier": "The Bottom", "glow": "255, 140, 58",
            "status": "Non-habitable. Maximum logistics.", "security": "Automated. Sentinel drones watch the haulers.",
            "text": "One claustrophobic artery, jammed with industrial supply trucks. Everything the city eats passes through here.", "seen": [] },
        "smolder": { "code": "S-03", "name": "The Smolder", "tier": "The Bottom", "glow": "232, 210, 58",
            "status": "Toxic. Workable, extreme hazard.", "security": "Environmental monitors only.",
            "text": "Chemical refineries under a permanent sulfur haze. You can taste the air.", "seen": [["10", "#10 The Devil's Pact"]] },
        "rust":    { "code": "S-04", "name": "The Rust Zone", "tier": "The Bottom", "glow": "210, 80, 50",
            "status": "Non-habitable. Non-workable.", "security": "Zero. Even the police stay away.",
            "text": "An industrial graveyard: dead machines, rusted hulls and nobody watching.", "seen": [["5", "#05 Ghost in the Machine"]] },
        "pulse":   { "code": "S-05", "name": "The Pulse", "tier": "Mid-Range", "glow": "255, 60, 200",
            "status": "Habitable, medium density.", "security": "Maximum. Facial recognition on every corner.",
            "text": "Neon, noise and rain-slicked streets. The nightlife of Terminus, and most of its bad decisions.", "seen": [] },
        "vortex":  { "code": "S-06", "name": "The Vortex", "tier": "Mid-Range", "glow": "57, 213, 255",
            "status": "Non-habitable. High-pressure transit.", "security": "High. Anti-riot squads on permanent watch.",
            "text": "The central mag-lev hub. Every transit line in the city crosses here.", "seen": [] },
        "stone":   { "code": "S-07", "name": "The Stone", "tier": "The Center", "glow": "235, 170, 90",
            "status": "Habitable, corporate elite.", "security": "Heavy corporate and TPD presence.",
            "text": "The Stone District: bank towers and cold corporate money, with the Sovereign Bank Tower standing over all of it.",
            "seen": [["7", "#07 Terminal Protocol Part II"], ["8", "#08 Terminal Protocol Part III"]] },
        "neural":  { "code": "S-08", "name": "The Neural", "tier": "Mid-Range", "glow": "61, 139, 255",
            "status": "Non-habitable. Specialized work.", "security": "Digital lockdown. Biometric doors.",
            "text": "Monolithic data towers and server farms. Red status lights blinking in the dark.", "seen": [] },
        "iron":    { "code": "S-09", "name": "The Iron District", "tier": "Mid-Range", "glow": "255, 90, 26",
            "status": "Non-habitable. Industrial max.", "security": "Corporate paramilitary.",
            "text": "Automated foundries and corporate logistics. Sparks fall like orange rain.",
            "seen": [["3", "#03 The Gossamer Shadow"], ["4", "#04 The Chimera Project"]] },
        "glass":   { "code": "S-10", "name": "The Glass", "tier": "The Apex", "glow": "168, 228, 255",
            "status": "Habitable, high density, elite.", "security": "Total surveillance.",
            "text": "Sterile residential blocks for upper-tier citizens. The drones are always watching.", "seen": [] },
        "oasis":   { "code": "S-11", "name": "The Oasis", "tier": "The Apex", "glow": "68, 255, 153",
            "status": "Habitable, ultra-elite.", "security": "Private military contractors.",
            "text": "Bio-domes and climate-controlled luxury. The nature is artificial. So is the calm.", "seen": [] },
        "canopy":  { "code": "S-12", "name": "The Canopy", "tier": "The Apex", "glow": "255, 255, 255",
            "status": "Habitable, ultra-low density.", "security": "The Iron Curtain.",
            "text": "The highest point of the city: corporate glass spires above the smog.",
            "seen": [["11_1", "#11.1 The New Order Part 1"], ["11_2", "#11.2 The New Order Part 2"]] },
        "kiln":    { "code": "S-13", "name": "The Kiln", "tier": "Eastern Rim", "glow": "255, 174, 42",
            "status": "Non-habitable. Extreme hazard.", "security": "Automated. The heat is the wall.",
            "text": "The thermal power core. Blinding heat and fusion-glow.", "seen": [] },
        "marrow":  { "code": "S-14", "name": "The Marrow", "tier": "North-West Rim", "glow": "74, 163, 255",
            "status": "Institutional only. Medical.", "security": "Medical lockdown.",
            "text": "Clinical bio-research behind ozone mist. Access restricted.", "seen": [] },
        "silence": { "code": "S-15", "name": "The Silence", "tier": "Western Rim", "glow": "160, 160, 160",
            "status": "Non-habitable. Non-workable.", "security": "Zero. Off the grid.",
            "text": "Skeleton towers, no power grid, dead data-zones. Total shadow.", "seen": [] }
    };
    /* ------------------------------- */

    var ORDER = ['dredge', 'slums', 'throat', 'smolder', 'rust', 'pulse', 'vortex', 'stone', 'neural', 'iron', 'glass', 'oasis', 'canopy', 'kiln', 'marrow', 'silence'];
    function idFromHash(h) {
        h = (h || '').replace('#', '').toLowerCase();
        if (h === 'foundry' || SECTORS[h]) { return h; }
        var m = /^sector-(\d{1,2})$/.exec(h);
        return m && ORDER[+m[1]] ? ORDER[+m[1]] : '';
    }
    function hashFor(id) { return id === 'foundry' ? 'foundry' : 'sector-' + SECTORS[id].code.slice(2); }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    var zones = map.querySelectorAll('.tc-zone');
    Array.prototype.forEach.call(zones, function (z) { var s = SECTORS[z.getAttribute('data-id')]; if (s) { z.style.setProperty('--glow', s.glow); } });

    /* ---------- selection + panel ---------- */
    function mark(id) {
        Array.prototype.forEach.call(zones, function (z) { z.classList.toggle('is-on', z.getAttribute('data-id') === id); });
        if (list) { Array.prototype.forEach.call(list.querySelectorAll('.chip'), function (c) { var on = c.getAttribute('data-id') === id; c.classList.toggle('chip--active', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
    }
    function setHash(id) { try { history.replaceState(null, '', '#' + hashFor(id)); } catch (e) { /* ignore */ } }

    function openFoundry(fromUser) {
        mark('foundry');
        if (fromUser) { setHash('foundry'); }
        if (modal && typeof modal.showModal === 'function') { if (!modal.open) { modal.showModal(); } }
        else if (modal) { modal.setAttribute('open', ''); }
    }
    if (modal) { modal.addEventListener('click', function (e) { if (e.target === modal) { modal.close(); } }); }

    function select(id, fromUser) {
        if (id === 'foundry') { openFoundry(fromUser); return; }
        var s = SECTORS[id]; if (!s) { return; }
        mark(id);
        info.setAttribute('data-label', 'SECTOR_FILE // ' + s.code);
        info.innerHTML = '';
        var st = el('div', 'stack');
        st.appendChild(el('span', 'tag', s.code + ' // ' + s.tier.toUpperCase()));
        st.appendChild(el('h2', 'h2', s.name));
        st.appendChild(el('p', 'copy', s.text));
        var dl = el('dl', 'tc-facts');
        dl.appendChild(el('dt', '', 'STATUS')); dl.appendChild(el('dd', 'small', s.status));
        dl.appendChild(el('dt', '', 'SECURITY')); dl.appendChild(el('dd', 'small', s.security));
        st.appendChild(dl);
        if (s.seen && s.seen.length) {
            st.appendChild(el('span', 'meta', '> APPEARS IN'));
            var chips = el('div', 'chips');
            s.seen.forEach(function (x) { var a = el('a', 'chip', x[1]); a.href = '/deaddrop/issue-' + String(x[0]).replace('_', '-') + '.html'; chips.appendChild(a); });
            st.appendChild(chips);
        }
        info.appendChild(st);
        if (fromUser) {
            setHash(id);
            if (window.innerWidth < 1024) { info.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        }
    }

    /* ---------- hover card ---------- */
    function showCard(id, cx, cy) {
        if (!card) { return; }
        var s = SECTORS[id];
        card.innerHTML = '';
        if (s) {
            card.appendChild(el('b', '', s.code + ' ' + s.name.toUpperCase()));
            card.appendChild(el('div', '', 'STATUS: ' + s.status));
            card.appendChild(el('div', '', 'SECURITY: ' + s.security));
        } else {
            card.appendChild(el('b', '', 'THE FOUNDRY'));
            card.appendChild(el('div', '', 'STATUS: UNMAPPED // SUBTERRANEAN'));
        }
        card.hidden = false;
        var r = view.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
        var x = cx - r.left + 16, y = cy - r.top + 16;
        if (x + w > r.width - 4) { x = cx - r.left - w - 16; }
        if (y + h > r.height - 4) { y = cy - r.top - h - 16; }
        card.style.left = Math.max(4, x) + 'px'; card.style.top = Math.max(4, y) + 'px';
    }
    function hideCard() { if (card) { card.hidden = true; } }
    map.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || dragging) { return; }
        var z = e.target.closest ? e.target.closest('.tc-zone') : null;
        if (z) { showCard(z.getAttribute('data-id'), e.clientX, e.clientY); } else { hideCard(); }
    });
    map.addEventListener('pointerleave', hideCard);
    map.addEventListener('focusin', function (e) {
        var z = e.target.closest ? e.target.closest('.tc-zone') : null; if (!z) { return; }
        var b = (z.querySelector('.tc-hit') || z).getBoundingClientRect();
        showCard(z.getAttribute('data-id'), b.right, b.top);
    });
    map.addEventListener('focusout', hideCard);

    /* ---------- clicks + keys ---------- */
    map.addEventListener('click', function (e) {
        if (moved) { return; }
        var z = e.target.closest ? e.target.closest('.tc-zone') : null; if (z) { hideCard(); select(z.getAttribute('data-id'), true); }
    });
    map.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        var z = e.target.closest ? e.target.closest('.tc-zone') : null; if (z) { e.preventDefault(); select(z.getAttribute('data-id'), true); }
    });
    if (list) { list.addEventListener('click', function (e) { var c = e.target.closest ? e.target.closest('.chip') : null; if (c) { select(c.getAttribute('data-id'), true); } }); }

    /* ---------- layers ---------- */
    Array.prototype.forEach.call(document.querySelectorAll('[data-layer]'), function (b) {
        b.addEventListener('click', function () {
            var t = b.getAttribute('data-layer') === 'transit';
            view.classList.toggle('show-transit', t); if (col) { col.classList.toggle('show-transit', t); }
            Array.prototype.forEach.call(document.querySelectorAll('[data-layer]'), function (o) { var on = o === b; o.classList.toggle('chip--active', on); o.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        });
    });

    /* ---------- zoom + pan ---------- */
    var MAX = 4, st = { s: 1, x: 0, y: 0 }, pts = {}, dragging = false, moved = false, start = null;
    function clamp() {
        var w = view.clientWidth, h = view.clientHeight;
        st.s = Math.min(MAX, Math.max(1, st.s));
        st.x = Math.min(0, Math.max(w - w * st.s, st.x));
        st.y = Math.min(0, Math.max(h - h * st.s, st.y));
    }
    function apply() {
        clamp();
        pan.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.s + ')';
        view.classList.toggle('is-zoomed', st.s > 1.001);
    }
    function zoomAt(px, py, ns) {
        ns = Math.min(MAX, Math.max(1, ns));
        st.x = px - (px - st.x) * ns / st.s; st.y = py - (py - st.y) * ns / st.s; st.s = ns; apply();
    }
    function local(e) { var r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    view.addEventListener('wheel', function (e) {
        if (e.deltaY > 0 && st.s <= 1.001) { return; }   // let the page scroll when the map is not zoomed
        e.preventDefault(); hideCard();
        var p = local(e); zoomAt(p.x, p.y, st.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
    }, { passive: false });
    Array.prototype.forEach.call(document.querySelectorAll('[data-zoom]'), function (b) {
        b.addEventListener('click', function () {
            var k = b.getAttribute('data-zoom'), w = view.clientWidth / 2, h = view.clientHeight / 2;
            if (k === 'reset') { st = { s: 1, x: 0, y: 0 }; apply(); } else { zoomAt(w, h, st.s * (k === 'in' ? 1.5 : 1 / 1.5)); }
        });
    });
    function count() { return Object.keys(pts).length; }
    function dist() { var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    function mid() { var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    view.addEventListener('pointerdown', function (e) {
        if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target.closest && e.target.closest('.tc-zoom'))) { return; }
        pts[e.pointerId] = local(e); moved = false;
        start = { s: st.s, x: st.x, y: st.y, p: local(e), d: count() === 2 ? dist() : 0, m: count() === 2 ? mid() : null };
    });
    view.addEventListener('pointermove', function (e) {
        if (!pts[e.pointerId]) { return; }
        pts[e.pointerId] = local(e);
        if (count() === 2 && start && start.d) {
            moved = true; dragging = true; hideCard();
            var m = mid(), ns = Math.min(MAX, Math.max(1, start.s * dist() / start.d));
            st.x = m.x - (start.m.x - start.x) * ns / start.s; st.y = m.y - (start.m.y - start.y) * ns / start.s; st.s = ns; apply();
            e.preventDefault(); return;
        }
        if (count() !== 1 || !start || st.s <= 1.001) { return; }
        var dx = pts[e.pointerId].x - start.p.x, dy = pts[e.pointerId].y - start.p.y;
        if (!moved && Math.hypot(dx, dy) < 6) { return; }
        if (!moved) { moved = true; dragging = true; view.classList.add('is-dragging'); hideCard(); try { view.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
        st.x = start.x + dx; st.y = start.y + dy; apply(); e.preventDefault();
    });
    function up(e) {
        delete pts[e.pointerId];
        if (count() === 1) { var k = Object.keys(pts)[0]; start = { s: st.s, x: st.x, y: st.y, p: pts[k], d: 0, m: null }; }
        if (count() === 0) { dragging = false; view.classList.remove('is-dragging'); setTimeout(function () { moved = false; }, 0); }
    }
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    window.addEventListener('resize', apply);

    /* ---------- deep link ---------- */
    var first = idFromHash(location.hash);
    if (first) { select(first, false); }
})();
