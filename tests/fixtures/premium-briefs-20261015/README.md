# Forward test authoringu — 2026-10-15

Tryb: `content-brief-authoring`. Te materiały są **propozycją offline**, nie wynikiem walidacji ani dowodem jakości premium.

Surowe `brief.md` powstały przed doborem receptur. Osoba oceniająca powinna dostać je przed handoffem i obejrzeć późniejsze publiczne zrzuty bez podpowiadania wybranych receptur. Treści są jawnie fikcyjne; nie dodano fake proof, opinii, cen, formularzy ani prawdziwych danych kontaktowych.

| Projekt | Proponowany profil | Plan | Charakter |
|---|---|---|---|
| Papier Studio | `editorial-serif` | 5 pasm | Redakcyjne otwarcie z zakresem w wierszach, jeden blok procesu, bez mediów i motion |
| Orbit Desk | `modern-grotesk` | 6 pasm, interakcja niegotowa | Produktowy komunikat, lista możliwości, manualny pokaz przez istniejący SliderBlock |
| Forma Wnętrz | `warm-humanist` | 6 pasm, medium przekazane przez integratora | Fotografia, manifest, proces i kontakt |

Wszystkie trzy ID profili oraz wybrane ID kompozycji występują w bootstrapie `contract-before.json` dostarczonym przez integratora. Potwierdzono je też w świeżym HTTP `contract.json` z tego samego katalogu output; oba mają SHA `bcdba2d66e0840ba933568f44eb0f67724e250a16c447e432af5ac95b94d943b`. Ten odczyt **nie zastępuje świeżego live contract po instalacji nowej paczki**. Źródło wyboru struktur: obecny katalog Buildera; bieżące drzewka receptur nie zostały skopiowane do node mapy ani do tych fixture'ów.

`project-tokens.json` pozostaje celowo pusty: nie zatwierdzono lokalnych nadpisań tokenów. Użytkownik następnie jawnie zatwierdził **tymczasowe, sekwencyjne testy globalnych profili wyłącznie na `http://127.0.0.1:8192`, z przywróceniem oryginalnych ustawień**. Handoffy odnotowują tę zgodę, nie wykonanie zmian ani zgodę na publikację. Istniejący resolver zachowuje referencje; wartości trzeba odczytać z live contract i opublikowanych profili, bez kopiowania ich do literałów strony.

Integrator przekazał ID z kanonicznego bulk-create: Papier **11253**, Orbit **11255**, Forma **11257**. Publicznego `viewUrl` nie konstruujemy ze slugu ani z ID — musi pochodzić z kanonicznego snapshotu layoutu.

Każdy test profilu wymaga świeżego snapshotu global styles/revision, compose i preview, jednego wersjonowanego zapisu, readback, pomiaru właściwej strony oraz przywrócenia i ponownego readback oryginalnych wartości. Zachować Custom CSS i wszystkie nieobjęte zmianą pola; nigdy nie zapisywać ich do tych publicznych fixture'ów. Przed przywróceniem potwierdzić nadal własną wersję zapisu; cudza zmiana/konflikt zatrzymuje automatyczne odtwarzanie i wymaga uzgodnienia. Po przywróceniu profil konkretnej strony nie będzie izolowany od reszty witryny — dowód wizualny musi wskazywać profil obowiązujący w chwili zrzutu. Nie uruchamiać testów profili równolegle.

## Ujawnione ograniczenia i następny krok

1. **Orbit: brak kompozycji manualnego slidera, ale istnieje widget.** Bazowy `content-cards` jest nośnikiem dokładnych tekstów, nie zamiennikiem wymaganego działania. W bootstrapie `SliderBlock` publikuje `slides`, `showArrows`, `showDots`, `autoplay` oraz `transitionReducedMotion`, ze slotami `title` i `subtitle`. Po świeżym kontrakcie i rozwinięciu planu należy użyć istniejących operacji na rozpoznanych ID, zachować nagłówek/wprowadzenie i zastąpić tylko karty. Nie można zapisać tego bazowego planu jako ukończonego: tekst „Zmień slajd przyciskiem” byłby wtedy nieprawdziwy. Warunki reduced-motion/no-JS/klawiatury są niewykonane, nie PASS.
2. **Forma: medium uzupełniono dopiero po potwierdzonym imporcie.** Początkowy plan jawnie pomijał wymagane media, zamiast stosować sztuczny URL. Integrator następnie przekazał obraz, manifest i załącznik 11252. Obejrzano wygenerowany PNG, zapisano SHA oraz opis zgodny z obrazem. Plan używa przekazanego WebP z lokalnej biblioteki, a nie ścieżki pliku jako URL. Import wykonał integrator; ta ścieżka nie dowodzi jeszcze jakości kadru ani publicznego renderu.
3. **Wspólny katalog ogranicza rytm końca stron.** Każdy plan kończy istniejące `closing-cta` i `site-footer`. Nie jest to dowód, że trzy finalne strony są dostatecznie różne; niezależny review ma ocenić powtarzalność, dominację CTA i rolę fotografii. Modyfikacje wyłącznie istniejącymi kontrolkami i operacjami po pomiarze.
4. **Papier: zakres w otwarciu, bez dodatkowego pasma.** `Zakres pracy` w briefie jest etykietą grupy danych; dokładne nazwy i opisy trzech usług trafiają do `hero-agenda`. Kotwica `#zakres` wskazuje całe otwarcie. Nie powstały obcięcia lub parafrazy opisów. Nie deklarujemy source-bound 1:1: dokument v2 wymaga jeszcze canonical `viewUrl` i jawnego review źródłowych wpisów; istniejący skill nie ma generatora Markdown → dokument v2.
5. **Lokalna nawigacja to izolowany eksperyment QA.** Te strony nie zmieniają globalnych szablonów. Jeżeli świeży kontekst będzie mieć aktywne chrome, należy uzgodnić prezentację standalone i uniknąć duplikacji. Nie używać receptury Navbar jako obejścia prawdziwego SiteBranding/WPMenu w globalnym nagłówku.

## Dowody wymagane przed oceną

- Odświeżony kontrakt, zgodność profili, slotów i kontrolek; żadnego podmieniania braków przez surowy CSS/JS/klasy.
- Oficjalne composition-plan, następnie preflight wymaganych operacji Orbit. Nie zakładać wcześniej identyfikatorów węzłów.
- Walidacja, preview i zapis przez oficjalny, wersjonowany REST z odczytem po zapisie; bez zmian danych źródłowych i bez migracji innych stron.
- Zrzuty publicznego PHP 1440/834/390 oraz 375 px stress; czytelność pełnej treści, media i kadry, kolejność, CTA, focus, brak overflow.
- Dla Orbit manualna interakcja, klawiatura, reduced-motion, no-JS, brak autoplay. Dla pozostałych brak dodanego ruchu.
- Osobny werdykt techniczny i jakościowy. Wyjście skryptu ani poprawny plan nie upoważniają do „premium” lub „1:1”.

## Dokument treści v2 — potwierdzona trasa i brak generatora

Sprawdzono pełne `scripts/verify-client-content.js`, `scripts/content-ledger.js`, `tests/verify-client-content.test.js` oraz wywołania w repozytorium skilla. Istnieją parser, hash i weryfikator dokumentu, **nie ma generatora briefów Markdown ani komendy tworzącej dokument v2**. Dlatego nie utworzono pozornego artefaktu z ręcznie wymyślonym schematem lub fikcyjnym wynikiem capture.

Bezpieczna trasa po odrębnym zatwierdzeniu przygotowania danych istniejącego formatu:

1. Dla właściwego ID pobrać kanoniczny snapshot i użyć dokładnego `viewUrl`. Scope wybrać jawnie: `full-render` dla całej standalone strony albo `page-content` wyłącznie z odpowiednio wyodrębnionym rzeczywistym capture. Samo pole `region` w verifierze nie filtruje ledgeru.
2. Z surowego `brief.md` wyodrębnić i zrecenzować ordered `entries` zawierające wyłącznie unikalne `id` i dokładne `text`. Zachować każde zamierzone powtórzenie i NBSP. Nie wyprowadzać oczekiwań z wygenerowanego layoutu, bo skopiowałoby to jego ewentualne pominięcia. Oddzielić instrukcje/redakcyjne nagłówki briefu od zatwierdzonej treści publicznej. Dla Orbit nie omijać niewidocznych slajdów ani wymagań interakcji tylko po to, aby otrzymać PASS.
3. Użyć istniejącego `clientDocumentEntries` do sprawdzenia danych oraz `canonicalClientSourceSha256` do obliczenia `source.sha256`. V2 dopuszcza wyłącznie `schemaVersion`, `artifact`, `scope`, `source`, `entries`; `scope` zawiera tylko `viewUrl` i `region`, a `source` tylko `label` i `sha256`. Ten hash wiąże uporządkowane wpisy, **nie bajty Markdown**. Hash całego briefu pozostaje oddzielnie w `handoff.provenance.briefSha256`; nie wolno podstawić go jako `source.sha256`.
4. Po rzeczywistym publicznym capture uruchomić istniejące `verify-client-content.js --client-document … --live-manifest … --out …`. Dokument v2 sam w sobie nie jest dowodem: wymagane są `sourceBound: true`, `complete: true`, właściwy URL/scope i brak missing/changed/duplicate/added. Nie konstruować sztucznego `liveManifest` z tych samych wejściowych tekstów.

Dokładna treść źródłowa, target IDs i hash briefu są już zapisane. Braku generatora nie zastąpiono nowym helperem, rendererem ani skryptem ekstrakcji. Integrator wybrał na ten etap porównanie surowego briefu i liczby wystąpień z rzeczywistym publicznym capture w przeglądarce, z jawnym **brakiem deklaracji 1:1**. Nie wykonano jeszcze tego porównania ani weryfikacji v2; przyszła trasa powyżej nie jest nową blokadą obecnego jakościowego eksperymentu QA.

Nie wykonano WP, Dockera, instalacji, zapisów, testów przeglądarkowych ani publikacji w tym etapie.
