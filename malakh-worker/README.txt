VA COMICS // MALAKH (chatbot) Worker  — M2, nov 2026
=====================================================
Worker separat (va-malakh), ca va-board și va-reader. Site-ul (icy-sun-9f9e) nu depinde de el.

CE FACE
  /api/malakh/status   GET   e pornit sau nu
  /api/malakh/open     POST  deschide canalul (Turnstile + bifa 18+) -> token valabil 2 ore
  /api/malakh/ask      POST  o întrebare -> răspunsul lui Malakh
  /foundry/api/malakh/*      admin (doar prin Cloudflare Access): status, settings, kb/<id>, test

CE NU E AICI (repo-ul e public)
  - baza de cunoștințe și lista de spoilere: în D1 „va-malakh”, tabela kb (se editează din Foundry, M4)
  - setările (pornit/oprit, limite): D1, tabela settings
  - TURNSTILE_SECRET: Secret în dashboard (aceeași valoare ca la va-board)

PORNIT DIN FABRICĂ: NU. settings.enabled = 0 până trec testele live. Asta e și KILL_SWITCH-ul.

LIMITE IMPLICITE (se schimbă din Foundry)
  per_hour 12 / per_day_visitor 30 / daily_cap 50 răspunsuri AI pe zi / neuron_cap 6500 (restul rămâne pentru board)
  Răspunsurile fixe (refuzuri mecanice) nu costă nimic și nu intră în plafon.

CONVERSAȚIILE NU SE SALVEAZĂ. Se păstrează doar numărători pe zi și amprente anonime care se schimbă zilnic.
