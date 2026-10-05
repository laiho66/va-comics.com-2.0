/* VA COMICS // video.js
   Video page: the YouTube player is loaded ONLY after a click (a preview image shows until then).
   The clip list (VIDEO_DATABASE) is the block in media/video.html. */
(function () {
    'use strict';
    if (typeof VIDEO_DATABASE === 'undefined' || !VIDEO_DATABASE.length) { return; }

    var screen = document.getElementById('videoScreen');
    var facade = document.getElementById('videoFacade');
    var facadeTitle = document.getElementById('facadeTitle');
    var monitor = document.getElementById('videoMonitor');
    var list = document.getElementById('videoList');
    if (!screen || !facade || !monitor || !list) { return; }

    var current = null;

    function embedUrl(clip, autoplay) {
        var ap = autoplay ? '&autoplay=1' : '';
        if (clip.type === 'playlist') {
            return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + clip.id + '&rel=0' + ap;
        }
        return 'https://www.youtube-nocookie.com/embed/' + clip.id + '?rel=0' + ap;
    }

    function mark(index) {
        Array.prototype.forEach.call(list.children, function (li, i) {
            var on = i === index;
            li.firstChild.classList.toggle('is-current', on);
            if (on) { li.firstChild.setAttribute('aria-current', 'true'); } else { li.firstChild.removeAttribute('aria-current'); }
        });
    }

    function showFacade(index) {
        var clip = VIDEO_DATABASE[index]; current = index;
        monitor.removeAttribute('src'); monitor.hidden = true;
        facade.hidden = false;
        facade.style.backgroundImage = clip.type === 'playlist' ? 'none' : 'url(https://i.ytimg.com/vi/' + clip.id + '/hqdefault.jpg)';
        facadeTitle.textContent = clip.title;
        mark(index);
    }

    function play(index) {
        var clip = VIDEO_DATABASE[index]; current = index;
        facade.hidden = true; monitor.hidden = false;
        monitor.setAttribute('src', embedUrl(clip, true));
        mark(index);
    }

    VIDEO_DATABASE.forEach(function (clip, i) {
        var li = document.createElement('li');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'video-item';
        var t = document.createElement('span'); t.className = 'h3'; t.textContent = clip.title;
        var m = document.createElement('span'); m.className = 'meta'; m.textContent = clip.meta || '';
        b.appendChild(t); b.appendChild(m);
        b.addEventListener('click', function () {
            play(i);
            if (screen.scrollIntoView && window.innerWidth < 1024) { screen.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
        li.appendChild(b); list.appendChild(li);
    });

    facade.addEventListener('click', function () { if (current !== null) { play(current); } });
    showFacade(0);
})();
