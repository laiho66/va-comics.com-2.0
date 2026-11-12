/* VA COMICS // map.js  (nov 2026)
   The Terminus City map on /deaddrop/map.html: click, tap or Enter on a sector opens its file in the panel.
   The drawing itself is the SVG inside the page. EDIT ZONE = SECTORS (the texts).
   "seen" = issues whose public description mentions the place: [issue key, label]; it links to /deaddrop/issue-N.html.
   Link to one sector: /deaddrop/map.html#stone
   No spoilers: atmosphere only, nothing that happens in the story. */
(function () {
    'use strict';
    var info = document.getElementById('tcInfo'), map = document.getElementById('tcMap'), list = document.getElementById('tcList');
    if (!info || !map) { return; }

    /* ---------- EDIT ZONE ---------- */
    var SECTORS = {
        "dredge": {
            "code": "S-00",
            "name": "The Dredge",
            "tier": "The Deep South",
            "text": "Sinking piers and fog thick enough to swallow the lamps. This is where the grid ends.",
            "seen": []
        },
        "slums": {
            "code": "S-01",
            "name": "The Slums",
            "tier": "The Bottom",
            "text": "High-density decay under permanent rain. The Vance family lives here, and the Iron Kings keep what passes for order.",
            "seen": [
                [
                    "5",
                    "#05 Ghost in the Machine"
                ],
                [
                    "6",
                    "#06 Terminal Protocol Part I"
                ]
            ]
        },
        "throat": {
            "code": "S-02",
            "name": "The Throat",
            "tier": "The Bottom",
            "text": "One claustrophobic artery, jammed with industrial supply trucks. Everything the city eats passes through here.",
            "seen": []
        },
        "smolder": {
            "code": "S-03",
            "name": "The Smolder",
            "tier": "The Bottom",
            "text": "Chemical refineries under a permanent sulfur haze. You can taste the air.",
            "seen": [
                [
                    "10",
                    "#10 The Devil's Pact"
                ]
            ]
        },
        "rust": {
            "code": "S-04",
            "name": "The Rust Zone",
            "tier": "The Bottom",
            "text": "An industrial graveyard: dead machines, rusted hulls and nobody watching.",
            "seen": [
                [
                    "5",
                    "#05 Ghost in the Machine"
                ]
            ]
        },
        "pulse": {
            "code": "S-05",
            "name": "The Pulse",
            "tier": "Mid-Range",
            "text": "Neon, noise and rain-slicked streets. The nightlife of Terminus, and most of its bad decisions.",
            "seen": []
        },
        "vortex": {
            "code": "S-06",
            "name": "The Vortex",
            "tier": "Mid-Range",
            "text": "The central mag-lev hub. Every transit line in the city crosses here.",
            "seen": []
        },
        "stone": {
            "code": "S-07",
            "name": "The Stone",
            "tier": "The Center",
            "text": "The Stone District: bank towers and cold corporate money, with the Sovereign Bank Tower standing over all of it.",
            "seen": [
                [
                    "7",
                    "#07 Terminal Protocol Part II"
                ],
                [
                    "8",
                    "#08 Terminal Protocol Part III"
                ]
            ]
        },
        "neural": {
            "code": "S-08",
            "name": "The Neural",
            "tier": "Mid-Range",
            "text": "Monolithic data towers and server farms. Red status lights blinking in the dark.",
            "seen": []
        },
        "iron": {
            "code": "S-09",
            "name": "The Iron District",
            "tier": "Mid-Range",
            "text": "Automated foundries and corporate logistics. Sparks fall like orange rain.",
            "seen": [
                [
                    "3",
                    "#03 The Gossamer Shadow"
                ],
                [
                    "4",
                    "#04 The Chimera Project"
                ]
            ]
        },
        "glass": {
            "code": "S-10",
            "name": "The Glass",
            "tier": "The Apex",
            "text": "Sterile residential blocks for upper-tier citizens. The drones are always watching.",
            "seen": []
        },
        "oasis": {
            "code": "S-11",
            "name": "The Oasis",
            "tier": "The Apex",
            "text": "Bio-domes and climate-controlled luxury. The nature is artificial. So is the calm.",
            "seen": []
        },
        "canopy": {
            "code": "S-12",
            "name": "The Canopy",
            "tier": "The Apex",
            "text": "The highest point of the city: corporate glass spires above the smog.",
            "seen": [
                [
                    "11_1",
                    "#11.1 The New Order Part 1"
                ],
                [
                    "11_2",
                    "#11.2 The New Order Part 2"
                ]
            ]
        },
        "kiln": {
            "code": "S-13",
            "name": "The Kiln",
            "tier": "Eastern Rim",
            "text": "The thermal power core. Blinding heat and fusion-glow.",
            "seen": []
        },
        "marrow": {
            "code": "S-14",
            "name": "The Marrow",
            "tier": "North-West Rim",
            "text": "Clinical bio-research behind ozone mist. Access restricted.",
            "seen": []
        },
        "silence": {
            "code": "S-15",
            "name": "The Silence",
            "tier": "Western Rim",
            "text": "Skeleton towers, no power grid, dead data-zones. Total shadow.",
            "seen": []
        },
        "foundry": {
            "code": "F",
            "name": "The Foundry",
            "tier": "Interstice",
            "text": "Off the grid, down in the sewer network. Dead Drop's base, and Mia's overwatch station.",
            "seen": [
                [
                    "3",
                    "#03 The Gossamer Shadow"
                ]
            ]
        }
    };
    /* ------------------------------- */

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }

    function select(id, fromUser) {
        var s = SECTORS[id]; if (!s) { return; }
        Array.prototype.forEach.call(map.querySelectorAll('.tc-zone'), function (z) { z.classList.toggle('is-on', z.getAttribute('data-id') === id); });
        if (list) { Array.prototype.forEach.call(list.querySelectorAll('.chip'), function (c) { var on = c.getAttribute('data-id') === id; c.classList.toggle('chip--active', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
        info.setAttribute('data-label', 'SECTOR_FILE // ' + (s.code === 'F' ? 'FOUNDRY' : s.code));
        info.innerHTML = '';
        var st = el('div', 'stack');
        st.appendChild(el('span', 'tag', s.tier.toUpperCase()));
        st.appendChild(el('h2', 'h2', s.name));
        st.appendChild(el('p', 'copy', s.text));
        if (s.seen && s.seen.length) {
            st.appendChild(el('span', 'meta', '> SEEN IN'));
            var chips = el('div', 'chips');
            s.seen.forEach(function (x) { var a = el('a', 'chip', x[1]); a.href = '/deaddrop/issue-' + String(x[0]).replace('_', '-') + '.html'; chips.appendChild(a); });
            st.appendChild(chips);
        }
        info.appendChild(st);
        if (fromUser) {
            try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
            if (window.innerWidth < 1024) { info.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        }
    }

    map.addEventListener('click', function (e) { var z = e.target.closest ? e.target.closest('.tc-zone') : null; if (z) { select(z.getAttribute('data-id'), true); } });
    map.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        var z = e.target.closest ? e.target.closest('.tc-zone') : null; if (z) { e.preventDefault(); select(z.getAttribute('data-id'), true); }
    });
    if (list) { list.addEventListener('click', function (e) { var c = e.target.closest ? e.target.closest('.chip') : null; if (c) { select(c.getAttribute('data-id'), true); } }); }

    var start = location.hash.replace('#', '');
    if (SECTORS[start]) { select(start, false); }
})();
