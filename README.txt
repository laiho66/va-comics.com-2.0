VA COMICS v3.2 // ETAPA 1-7: SITE COMPLET, GATA DE TESTAT ȘI PUBLICAT
====================================

CE ESTE ÎN FOLDER
-----------------
style.css          toate stilurile site-ului (culori, butoane, carduri, meniu, efecte)
site.js            meniul, bara de pe telefon, fundalul, firul de navigare, footerul și bannerul 18+
components.html    pagina de componente: vezi toate piesele, aici te joci (nu se publică)
_template.html     scheletul pentru orice pagină nouă (îl copiezi și îl completezi)
favicon.svg, apple-touch-icon.png, robots.txt
assets/            imagini generale (vezi LASĂ-AICI.txt)
deaddrop/assets/   portretele personajelor Dead Drop (gata puse)
vanguard/assets/   key-art, coperta Book 1, portretele Marcus, Kira, Malakh (gata puse)

CUM O DESCHIZI (LOCAL, FĂRĂ GITHUB)
-----------------------------------
1. Dezarhivezi zip-ul într-un folder, de exemplu  va-comics-v3.
2. Deschizi folderul în VS Code (File > Open Folder).
3. Instalezi extensia "Live Server" (o singură dată).
4. Click dreapta pe components.html > "Open with Live Server".
   Se deschide în browser, de obicei la http://127.0.0.1:5500/components.html
IMPORTANT: nu da dublu-click pe fișier. Linkurile de tip /style.css au nevoie de server.

CE SĂ TESTEZI
-------------
- Meniul din stânga: hover pe PROJECTS (pe ecran lat, cu mouse) deschide un panou în dreapta.
- Micșorează fereastra sub 1024 px: apare bara de sus și meniul de telefon, cu săgeți.
- Hover pe carduri (se ridică, trece o linie portocalie) și pe butoane (parantezele se depărtează).
- Butonul "Show the 18+ notice" arată bannerul. Pe paginile Dead Drop apare singur, o dată.
- Butoanele "CSS black" și "Wall image" schimbă fundalul.
- Tab cu tastatura: elementul selectat are contur portocaliu.

MENIUL ȘI LINKURILE
-------------------
Se schimbă într-un singur loc: partea de sus din site.js (zona EDIT ZONE).
Volum nou:  adaugi o linie în DEADDROP_VOLUMES.   Carte nouă: adaugi o linie în VANGUARD_BOOKS.
Pagini care arată banner 18+: lista ADULT_PATHS.

ETAPA 2: CE AM ADĂUGAT
-----------------------
index.html         Home: hero cu logo, două benzi de proiect, News automat, About și Follow
projects.html      Projects: câte un rând pe proiect, un singur buton
chronicles.html    News: versiune TEMPORARĂ, dar compatibilă cu Foundry (nu muta comentariile-marker)
assets/news.js     citește primele 2 postări din chronicles.html și le arată pe Home
assets/hero-desktop.webp, assets/hero-mobile.webp   TEMPORARE, făcute din poza cu logo: le înlocuiești cu cele finale (aceleași nume)
assets/og-home.png previzualizarea Home pentru Facebook (1200x630)

Pe Home, textele pe care le schimbi tu au un comentariu "EDIT" deasupra.
Imaginile lipsă nu strică pagina: apare o casetă cu dungi în locul lor
(ex. deaddrop/assets/key-art.webp încă nu există, deci Dead Drop are casetă cu dungi).

ETAPA 3: DEAD DROP
------------------
deaddrop/index.html        hub: premisa, READ ISSUE #1, volumele, panoul Characters
deaddrop/vol1.html, vol2.html   câte un card pe issue, cu 3 butoane de aceeași mărime (READ ONLINE, eBook, Paperback)
deaddrop/characters.html   grila cu 11 personaje, filtre pe facțiune și dosarul (panou pe dreapta pe desktop, panou de jos pe telefon)
assets/characters.js       filtrele și dosarul (săgeți < > și tastele stânga/dreapta/Esc)

DE FĂCUT DE TINE
- Copiezi din repo-ul tău coperțile în deaddrop/assets/: cover1.webp ... cover13.webp
  (cover11p1.webp și cover11p2.webp pentru cele două părți din #11). Până atunci apar casete cu dungi.
- Issue #13: butonul eBook e gri. Lipești linkul Amazon în vol2.html (caută "EDIT") și scoți is-disabled.
- Imaginea mare deaddrop/assets/key-art.webp (opțional, acum e casetă cu dungi).
- Poți deschide direct un personaj cu o adresă gen  characters.html#mace  sau un filtru cu  characters.html?f=krest

ETAPA 4: VANGUARD CHRONICLES
----------------------------
vanguard/index.html        hub: premisa seriei, cardul Book 1, panoul Characters
vanguard/book1.html        coperta, tagline, descriere, cele 3 formate (egale), detalii, capitolele; date structurate pentru Google (Book)
vanguard/characters.html   Marcus Reed, Kira Mercer, MALAKH, cu dosar (același mecanism ca la Dead Drop, fără filtre)
vanguard/assets/og-vanguard.png   previzualizarea Facebook pentru paginile Vanguard (generică, o poți înlocui)

Cartea 2: copiezi book1.html ca book2.html și schimbi ce e marcat în comentariul de sus;
adaugi cartea în site.js (VANGUARD_BOOKS) și un card în vanguard/index.html.

ETAPA 5: VIEWER
---------------
media/viewer.html   biblioteca (coperți, progres, CONTINUE) + cititorul în ecran complet
assets/reader.js    toată logica: biblioteca, cititorul, harta de pagini, sfârșit de issue, swipe, taste

IMPORTANT (Foundry): în viewer.html, blocul <script> cu R2_BASE_URL, buildPages și COMICS_DATABASE
este copiat EXACT din viewerul vechi. Nu-i schimba formatul. Un issue nou = o linie nouă acolo.
Coperta unui issue nou: deaddrop/assets/coverN.webp.

Cititorul: săgețile < > (sau tastele stânga/dreapta, Spațiu), bara de jos se trage ca să sari la o pagină,
M = harta paginilor, Z sau dublu-click = zoom, F = ecran complet, Esc = înapoi la bibliotecă.
Pe telefon: swipe stânga/dreapta, tap în centru ascunde/arată controalele (dispar singure după 3 secunde).
La ultima pagină, încă un "următor" deschide caseta de final (Next issue / Amazon / înapoi).
Adrese directe:  viewer.html?issue=13&page=5     Locul unde ai rămas se ține minte în browser.

ETAPA 6: RESTUL PAGINILOR
-------------------------
media.html          Media: două casete (Video și Viewer); Music a dispărut
media/video.html    clipurile (playerul YouTube se încarcă doar după click); lista VIDEO_DATABASE e jos în fișier
assets/video.js     logica paginii Video
about.html          textele tale, neschimbate, în panouri
contact.html        Facebook și X (fără email, fără formular)
legal.html          Terms + Privacy + Cookies într-o singură pagină, cu ancore (#terms, #privacy, #cookies)
terms.html, privacy.html, cookies.html, media/music.html   pagini mici care trimit la adresele noi (linkurile vechi nu se strică)
404.html            pagina "Signal lost" (o activăm la publicare)
sitemap.xml         lista paginilor pentru Google (cu adresele curate, fără music)

Textele legale au fost actualizate: acum pomenesc și X, progresul din cititor și Hardcover.
Nu sunt sfat juridic; le reciteşti tu și le actualizezi dacă adaugi analytics sau altceva.

ETAPA 7: VERIFICARE FINALĂ
--------------------------
- Audit automat pe cele 21 de pagini: 0 linkuri stricate, titlu / descriere / canonical / un singur h1 / alt la imagini peste tot.
- Contrast: textul gri mic a fost făcut mai deschis (se citește mai bine).
- Home: imaginea hero se încarcă mai devreme (preload).
- PUBLISH.txt: pașii siguri de publicare, ce se urcă, ce se șterge, lista de test și ce faci după.

CE URMEAZĂ
----------
Tu: completezi imaginile și textele rămase (vezi PUBLISH.txt, punctul A), apoi testezi. Eu: te ghidez la publicare. Etapa 4: Vanguard. Etapa 5: Viewer.
