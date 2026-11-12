/* VA COMICS // quiz.js  (nov 2026)
   Dead Drop quiz "Which Terminus City character are you?" on /deaddrop/quiz.html.
   Everything runs in the browser: no server, nothing is stored or sent anywhere.
   EDIT ZONE = CHARS (results) and QUESTIONS. Each answer gives points to characters: { id: points }.
   The character with most points wins; on a tie, the one listed first in CHARS.
   Result link: /deaddrop/quiz.html#r=jaxen-vance opens that result directly.
   No spoilers: results use only what is on the public Characters page. */
(function () {
    'use strict';
    var root = document.getElementById('quiz');
    if (!root) { return; }

    /* ---------- EDIT ZONE ---------- */
    var CHARS = [
        { id: 'jaxen-vance', name: 'Jaxen Vance', code: 'Dead Drop', label: 'PROTAGONIST',
          text: 'You did not ask for any of this. You took a job to keep your family breathing, and the city turned you into its problem. You absorb the hit, then return it with interest. Try not to level the block.' },
        { id: 'mia-vance', name: 'Mia Vance', code: 'Cipher', label: 'TACTICAL OVERWATCH',
          text: 'Sharpest tongue in the room, and the only one who read the manual. While everyone else is punching things, you are inside the network keeping them alive. They would be dead without you. You remind them often.' },
        { id: 'silas-redfern', name: 'Silas Redfern', code: '', label: 'TERMINUS POLICE DEPARTMENT',
          text: 'You have read enough crime scenes to stop believing in heroes. The badge is not perfect. It is just the last thing holding the ceiling up. Masks make you nervous. They should.' },
        { id: 'leo-cruz', name: 'Leo Cruz', code: 'The Man', label: 'THE FIRM / IRON KINGS',
          text: 'White suit, clean hands, full calendar. Generous in public, expensive in private. You never raise your voice, because you never need to. Loyalty has an invoice, and you always collect.' },
        { id: 'the-architect', name: 'The Architect', code: '', label: 'OMNI CORP / OMEGA GROUP',
          text: 'Everyone else is playing the game. You built the board. The city is a laboratory, people are data points, and you have the patience to let the experiment run. Nobody gets close enough to ask why.' },
        { id: 'the-surgeon', name: 'The Surgeon', code: 'The Surgeon', label: 'INDEPENDENT',
          text: 'No sides, no questions, no feelings about it. You are a professional: name the price and the job is done with clinical precision. People find the mask unsettling. That is what it is for.' },
        { id: 'volkov', name: 'Volkov', code: '', label: 'KREST',
          text: 'You can wait. That is the whole trick. While louder people burn themselves out, you choose the ground, fill it with smoke and take the fight apart one piece at a time.' },
        { id: 'mace', name: 'Mace', code: '', label: 'IRON KINGS',
          text: 'Subtlety is something that happens to other people. You are the wall, and also the thing that comes through the wall. Your crew follows you because you go in first, and because the alternative is worse.' },
        { id: 'niko-chen', name: 'Nikolai Chen', code: 'Niko', label: 'KREST',
          text: 'You were bored halfway through this quiz. You run on adrenaline and bad ideas, and you are usually gone before the smoke settles. Somebody has to start the chaos. You volunteer.' },
        { id: 'arlo-marstersen', name: 'Arlo Marstersen', code: 'The Chemist', label: 'THE FIRM',
          text: 'Brilliant, nervous and in far too deep. Your hands shake right up until the work begins; then they are the steadiest in the city. You make dangerous things beautifully. That is the problem.' },
        { id: 'elias-vance', name: 'Elias Vance', code: '', label: 'FAMILY',
          text: 'The quiet center. You do not swing and you do not shout, and somehow everyone still orbits you. You carry more than you say, and your first question is always about someone else.' }
    ];
    var QUESTIONS = [
        { q: 'It is 3 a.m. and the job just went wrong. Your first move?', a: [
            ['Get between the danger and my people.', { 'jaxen-vance': 2, 'elias-vance': 2 }],
            ['Pull the camera feeds and find out who lied.', { 'mia-vance': 2, 'silas-redfern': 1 }],
            ['Send someone else. That is what payroll is for.', { 'leo-cruz': 2, 'the-architect': 1 }],
            ['Hit first, hit hardest, ask nobody anything.', { 'mace': 2, 'niko-chen': 1 }] ] },
        { q: 'Pick your weapon.', a: [
            ['A keyboard and somebody else\'s network.', { 'mia-vance': 2, 'the-architect': 1 }],
            ['Patience.', { 'volkov': 2, 'elias-vance': 1, 'silas-redfern': 1 }],
            ['Whatever is in my hands. Possibly just my hands.', { 'mace': 2, 'jaxen-vance': 1 }],
            ['Chemistry.', { 'arlo-marstersen': 3, 'the-surgeon': 1 }] ] },
        { q: 'What do people say when you leave the room?', a: [
            ['"Never raises his voice. Terrifying."', { 'leo-cruz': 2, 'volkov': 1 }],
            ['"Brilliant. Somebody should check on them."', { 'arlo-marstersen': 2, 'mia-vance': 1 }],
            ['"Wait. Were they even here?"', { 'the-surgeon': 2, 'jaxen-vance': 1 }],
            ['"Still believes in the rules. God help him."', { 'silas-redfern': 2, 'elias-vance': 1 }] ] },
        { q: 'Your idea of a good night:', a: [
            ['Nobody I care about got hurt.', { 'elias-vance': 2, 'jaxen-vance': 1 }],
            ['Loud, fast, and somebody else\'s problem by morning.', { 'niko-chen': 3, 'mace': 1 }],
            ['The numbers closed and everybody paid.', { 'leo-cruz': 2, 'the-surgeon': 1 }],
            ['The experiment produced data.', { 'the-architect': 2, 'arlo-marstersen': 1 }] ] },
        { q: 'Someone offers you a deal that smells wrong.', a: [
            ['I need the cash. I take it and regret it later.', { 'jaxen-vance': 2, 'niko-chen': 1 }],
            ['I wrote that deal.', { 'the-architect': 2, 'leo-cruz': 1 }],
            ['Name the price. The smell is not my department.', { 'the-surgeon': 3 }],
            ['I walk away and open a file on them.', { 'silas-redfern': 2, 'volkov': 1, 'mia-vance': 1 }] ] },
        { q: 'You and rules:', a: [
            ['They are all that is holding this city up.', { 'silas-redfern': 2, 'elias-vance': 1 }],
            ['Rules are for people who cannot afford better lawyers.', { 'leo-cruz': 2, 'the-architect': 1 }],
            ['One rule: my crew comes first.', { 'volkov': 2, 'mace': 2 }],
            ['Sorry, what rules?', { 'niko-chen': 2, 'arlo-marstersen': 1 }] ] },
        { q: 'A fight breaks out. Where are you?', a: [
            ['In the middle of it, taking the hits.', { 'jaxen-vance': 2, 'mace': 1 }],
            ['On comms, three blocks away, saving everyone.', { 'mia-vance': 3 }],
            ['Already gone. I started it as a distraction.', { 'niko-chen': 2, 'volkov': 2 }],
            ['Watching from above. Taking notes.', { 'the-architect': 2, 'the-surgeon': 1 }] ] },
        { q: 'What keeps you going?', a: [
            ['Family.', { 'elias-vance': 2, 'jaxen-vance': 1, 'mia-vance': 1 }],
            ['Duty.', { 'silas-redfern': 2, 'mace': 1 }],
            ['Control.', { 'volkov': 2, 'leo-cruz': 1, 'the-architect': 1 }],
            ['The work. Done perfectly.', { 'the-surgeon': 2, 'arlo-marstersen': 2 }] ] }
    ];
    /* ------------------------------- */

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
    function byId(id) { for (var i = 0; i < CHARS.length; i++) { if (CHARS[i].id === id) { return CHARS[i]; } } return null; }
    function winner(score) {
        var best = CHARS[0], top = -1;
        CHARS.forEach(function (c) { var s = score[c.id] || 0; if (s > top) { top = s; best = c; } });
        return best;
    }
    if (typeof module === 'object' && module.exports) { module.exports = { CHARS: CHARS, QUESTIONS: QUESTIONS, winner: winner }; return; }

    var step = 0, score = {};

    function clear() { root.innerHTML = ''; }
    function focusTop() { root.setAttribute('tabindex', '-1'); root.focus({ preventScroll: true }); root.scrollIntoView({ block: 'nearest' }); }

    function intro() {
        clear();
        var box = el('div', 'panel'); box.setAttribute('data-label', 'PERSONNEL_SCAN // STANDBY');
        var st = el('div', 'stack');
        st.appendChild(el('h2', 'h2', QUESTIONS.length + ' questions. One file with your name on it.'));
        st.appendChild(el('p', 'small', 'Answer fast and answer honestly. Terminus City can tell when you are lying. Nothing you pick is saved or sent anywhere.'));
        var row = el('div', 'row'), b = el('button', 'btn btn--primary btn--lg', 'START THE SCAN'); b.type = 'button';
        b.addEventListener('click', function () { step = 0; score = {}; question(); });
        row.appendChild(b); st.appendChild(row); box.appendChild(st); root.appendChild(box);
    }

    function question() {
        clear();
        var Q = QUESTIONS[step];
        var box = el('div', 'panel'); box.setAttribute('data-label', 'QUESTION ' + (step + 1) + ' / ' + QUESTIONS.length);
        var st = el('div', 'stack');
        var bar = el('div', 'progress'), fill = el('i'); fill.style.width = Math.round(step / QUESTIONS.length * 100) + '%'; bar.appendChild(fill);
        st.appendChild(bar);
        st.appendChild(el('h2', 'h2', Q.q));
        var list = el('div', 'quiz-opts');
        Q.a.forEach(function (ans) {
            var b = el('button', 'quiz-opt', ans[0]); b.type = 'button';
            b.addEventListener('click', function () {
                Object.keys(ans[1]).forEach(function (id) { score[id] = (score[id] || 0) + ans[1][id]; });
                step++;
                if (step < QUESTIONS.length) { question(); } else { var w = winner(score); try { history.replaceState(null, '', '#r=' + w.id); } catch (e) { /* ignore */ } result(w, true); }
            });
            list.appendChild(b);
        });
        st.appendChild(list); box.appendChild(st); root.appendChild(box);
        if (step > 0) { focusTop(); }
    }

    function result(c, fresh) {
        clear();
        var card = el('article', 'card card--row card--static'); card.style.borderTop = '2px solid var(--accent)';
        var media = el('div', 'media ratio-2x3'); media.style.cssText = 'flex: 0 1 300px; min-height: 0; margin: 0 auto;';
        var ph = el('div', 'ph', '[ PORTRAIT ]'); media.appendChild(ph);
        var im = el('img', 'fade is-loaded'); im.alt = 'Portrait of ' + c.name; im.onerror = function () { im.remove(); };
        im.src = '/deaddrop/assets/characters/' + c.id + '.webp'; media.appendChild(im);
        var body = el('div', 'card-body'), st = el('div', 'stack');
        st.appendChild(el('span', 'tag', (fresh ? 'SCAN_COMPLETE' : 'SCAN_RESULT') + ' // ' + c.label));
        st.appendChild(el('h2', 'h1', c.name));
        if (c.code) { st.appendChild(el('span', 'meta', '[ ' + c.code + ' ]')); }
        st.appendChild(el('p', 'copy', c.text));
        var row = el('div', 'row');
        var file = el('a', 'btn btn--primary', 'OPEN THE FILE'); file.href = '/deaddrop/characters.html#' + c.id; row.appendChild(file);
        var share = el('button', 'btn', 'COPY RESULT LINK'); share.type = 'button';
        share.addEventListener('click', function () {
            var url = location.origin + location.pathname + '#r=' + c.id;
            var done = function () { share.textContent = 'LINK COPIED'; setTimeout(function () { share.textContent = 'COPY RESULT LINK'; }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); }); }
            else { window.prompt('Copy this link:', url); }
        });
        row.appendChild(share);
        var again = el('button', 'btn', fresh ? 'RUN IT AGAIN' : 'TAKE THE QUIZ'); again.type = 'button';
        again.addEventListener('click', function () { try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } step = 0; score = {}; question(); });
        row.appendChild(again);
        body.appendChild(st); body.appendChild(row);
        card.appendChild(media); card.appendChild(body); root.appendChild(card);
        var more = el('p', 'small'); more.appendChild(document.createTextNode('Want to see them in action? '));
        var a = el('a', '', 'Read Dead Drop from Issue #1'); a.href = '/media/viewer.html?issue=1'; more.appendChild(a); more.appendChild(document.createTextNode('.'));
        root.appendChild(more);
        if (fresh) { focusTop(); }
    }

    var m = /^#r=([a-z-]+)$/.exec(location.hash), pre = m && byId(m[1]);
    if (pre) { result(pre, false); } else { intro(); }
})();
