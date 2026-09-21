# Tryb `content-brief-authoring`: strona z briefu, bez referencyjnego HTML

Użyj tego trybu, gdy masz **treść**, ale nie masz makiety do
zmierzenia: nowa podstrona serwisu, strona z briefu klienta, powielenie układu
z już zapisanej strony na kolejne adresy.

Tryb `owned-html-reconstruction` i jego zakaz ręcznego buildera **tu nie
obowiązują** — nie ma czego mierzyć, więc nie ma referencyjnej trasy pomiarowej.
Na Builderze ≥ 1.6 kanoniczną trasą rozwinięcia jest serwer
(`POST /compositions/plan`, sekcja niżej); `layout-kit.mjs` pozostaje trasą
offline i awaryjną dla starszych kontraktów. Bramką jakości jest
`normalize-layout.js` plus pomiar zapisanej strony.

## Nowa kompozycja z briefu: plan danych

Dla nowej strony bez wzorca preferuj kompozycje publikowane przez bieżący
Builder. Pobierz pełny `GET /wp-json/monteby/v1/contract` do pliku dla narzędzi.
Do wyboru kompozycji czytaj tylko
`GET /wp-json/monteby/v1/contract?mode=design`: skrócony katalog jest pomocą
wyboru, nie kontraktem walidatora. Nie dopisuj do niego brakujących kontrolek.
Gdy pełny kontrakt nie zawiera `authoring.compositions.version: 1`, zachowaj
istniejącą trasę wzorca poniżej; nie odtwarzaj receptur z pamięci.

Przed zleceniem modelowi przygotowania planu sprawdź, czy discovery publikuje
co najmniej jedną recepturę. `recipes: []` oznacza najpierw diagnozę
kompatybilności lub integralności kontraktu; nie wydawaj tokenów modelu na
planowanie z pustego katalogu.

Model wybiera `compositionId` z opublikowanego katalogu i wypełnia wyłącznie
jego sloty. Nie pisze skryptu JavaScript, node mapy ani własnych propów.
Przed rozwinięciem planu sprawdź zgodność z briefem:

- Zachowaj wszystkie dostarczone teksty, etykiety i adresy linków oraz zatwierdzone media; porównaj liczbę sekcji z briefem.
- Umieść dokładnie jeden H1 w otwarciu strony.
- Dla pełnej strony sprawdź obecność nagłówka z nawigacją, hero i stopki; uwzględnij istniejące globalne szablony nagłówka i stopki, aby nie dodawać ich ponownie w treści strony.
- Wybierz dostępny hero pasujący do dostarczonych zasobów. Bez zatwierdzonego zdjęcia wybierz hero bez mediów; nie wymyślaj zdjęcia, aby wypełnić slot.

Zapisz `.monteby/plan-<slug>.json` w kształcie:

```json
{
  "version": 1,
  "sections": [
    {
      "compositionId": "hero-split",
      "content": {
        "title": "Dokładny tytuł z briefu",
        "media": { "src": "/wp-content/uploads/approved-photo.webp", "alt": "Opis zatwierdzonego zdjęcia" }
      }
    }
  ]
}
```

Dobieraj strukturę do objętości i celu treści, nie do stałej liczby sekcji.
W aktualnym katalogu `hero-agenda` rozdziela tytuł i wprowadzenie oraz pokazuje
2–4 dostarczone tematy jako wiersze; `hero-photo-led` oddaje główne miejsce
zatwierdzonemu zdjęciu, z krótkim wprowadzeniem i opcjonalnym kontekstem.
`manifesto` wyróżnia dostarczoną deklarację z jej wyjaśnieniem; atrybucję
podaj tylko wtedy, gdy brief rzeczywiście ją zawiera. `site-navigation`
przyjmuje markę, etykietę menu, rzeczywiste linki `label`/`href` i wymagany
kontakt CTA. `site-footer` zamyka stronę marką, opisem, notą i linkiem
dostarczonymi w briefie; nie dopisuj roku copyright ani niepotwierdzonych deklaracji.
Nie twórz menu powtórnie, gdy strona korzysta już z odpowiedniego
globalnego nagłówka. Linki `#cel` muszą odpowiadać unikalnym `anchorId`
docelowych sekcji; te kotwice podaje plan, nie generuj losowych ID.
Gdy pełna strona wymaga historii projektu, szczegółów usługi lub dalszych
fotografii, zachowaj je w kolejnych odpowiednich kompozycjach zamiast
skracania briefu do hero i kilku kart. Nie mnoż pustych sekcji, aby osiągnąć
arbitralną liczbę. Zawsze sprawdzaj faktyczną dostępność tych ID i slotów
w bieżącym kontrakcie.

To przykład kształtu, nie stały kontrakt slotów: wymagania zawsze odczytaj z
bieżącej receptury. Slot `text` jest tekstem; `media` ma `src` i jawne `alt`
(puste wyłącznie dla obrazu dekoracyjnego), `link` ma `label` i `href`, a
`items` jest listą obiektów zgodnych z `itemSlots`. Plan ma 1–20 sekcji,
lista najwyżej 8 pozycji. Nie podawaj nieznanych pól ani dowolnych `props`.
Nie wymyślaj tekstów referencji, statystyk, opinii, tożsamości ani mediów.
Do stron demonstracyjnych preferuj zdjęcia stockowe z zatwierdzonego źródła (np. Pexels/Freepik) i manifestu. Jeśli użytkownik wyklucza generowanie zdjęć, korzystaj wyłącznie z istniejących materiałów; generowanie w innych projektach pozostaje dostępne zgodnie z ich briefem.
Źródła mediów muszą pochodzić z zatwierdzonego manifestu praw do zasobów;
walidacja URL nie potwierdza praw do obrazu. Jeśli wymaganego slotu brakuje,
wybierz inną dostępną kompozycję lub zgłoś brak. Nie podstawiaj pustego pola.

### Rozwinięcie po stronie serwera (Builder ≥ 1.6)

Sprawdź odpowiednią bramkę z
`references/site-contract-compatibility.json`: `compositionPlan` przed
rozwinięciem całego planu albo `compositionInstantiate` przed rozwinięciem
jednej receptury. Obie wymagają `productVersion >= 1.6.0` oraz właściwego
deskryptora w `authoring.compositions.resources`; sama flaga capability nie
autoryzuje zapamiętanego adresu. Wtedy serwer, a nie lokalny kit, jest źródłem
prawdy dla identyfikatorów węzłów, odwołań do tokenów i reguł slotów. Adres
zasobu czytaj z deskryptora, który przeszedł bramkę. Oba zasoby są tylko do
odczytu (`edit_pages`, bez tokenu zapisu) i niczego nie zapisują.

- `POST /wp-json/monteby/v1/compositions/plan { plan, postId? }` rozwija cały
  plan (1–20 sekcji, wspólny licznik ID per receptura, budżet 1000 węzłów),
  wymusza dokładnie jeden H1 (`h1_missing`, `h1_multiple`) i rozwiązywalne,
  unikalne kotwice (`invalid_anchor_reference`, `unresolved_anchor`), uruchamia
  pełną walidację i lint, a zwraca `{ valid, layout, sections, errors, lint,
  decisions }`. Zwrócony `layout` zapisuj przez wersjonowany
  `PUT /pages/{id}/layout` z `expectedModifiedGmt`.
- `POST /wp-json/monteby/v1/compositions/instantiate { recipeId, slots,
  parentId?, index?, idPrefix?, postId? }` rozwija jedną recepturę i zwraca
  `{ valid, rootNodeId, nodes, operation, errors, lint, decisions }`;
  `operation` to gotowe `insert_tree` dla `patch-validate` → `patch-save`
  (`references/partial-layout-operations.md`). `parentId` inny niż `ROOT`
  wymaga `postId`, aby serwer zweryfikował rodzica.

Reguły serwera: identyfikatory to deterministyczne
`<idPrefix lub recipeId>-<n>` w kolejności pre-order (z `postId` licznik
startuje za istniejącymi ID, `decisions.idStart`); `tokenProps` rozwiązują się
przez `designTokens` do `var(--monteby-token-…)` (`missing_token`); tekst
zostaje dosłownie (≤ 20000 znaków); `media` to dokładnie `{ src, alt }` z
`http(s)`; `link` to dokładnie `{ href, label }` z `http(s)`, `mailto:`, `tel:`
lub adresem względnym od korzenia; lista `items` musi mieścić się w
`minItems`–`maxItems` (poza zakresem to `invalid_slot`, nigdy przycięcie);
nieobecny opcjonalny slot zostawia propy nieustawione; brak wymaganego to
`missing_slot`, nieznany — `unknown_slot`, niebezpieczny URL — `unsafe_url`.
Nieznana receptura to `404 monteby_site_authoring_unknown_composition`.
Odpowiedź `400` niesie ten sam kształt z `errors[{ code, message, path,
slot? }]` — popraw wskazany slot w planie, nie w zwróconych węzłach. `lint[]`
czytaj jak uwagi kitu: każda pozycja wymaga decyzji i nie zmienia `valid`.

Każda receptura w kontrakcie 1.6 niesie jednozdaniowe `description` obok `id`
i `label` (`?mode=authoring` redukuje receptury do tych trzech pól). Używaj go
do wyboru kompozycji; nie trafia do node mapy. Po rozwinięciu obowiązuje ta
sama ścieżka co niżej: pre-flight `normalize-layout.js`, wersjonowany zapis
i bramka „Zapis i ocena".

### Trasa offline: `layout-kit.mjs`

Obowiązuje, gdy bramka nie jest dostępna (starszy Builder to
`blocked_plugin_version`, Builder 1.6 bez właściwego deskryptora to
`blocked_contract_inconsistency`) albo gdy pracujesz bez połączenia z witryną.
Nie mieszaj obu tras w jednym zapisie: ID i tokeny z kitu nie muszą być równe
serwerowym.

```bash
node monteby-site-authoring/scripts/layout-kit.mjs \
  --contract .monteby/contract.json \
  --plan .monteby/plan-<slug>.json \
  --out .monteby/layout-<slug>.json \
  --report .monteby/composition-report-<slug>.json
```

Jeżeli brief dostarcza zatwierdzone lokalne tokeny projektu, przekaż je jako
plik danych JSON przez `--project-tokens .monteby/approved-tokens.json`.
Nie wykonuj pliku JavaScript jako części planu.

Receptury istnieją tylko w kontrakcie Buildera. Kit rozwija je deterministycznie
przez obecny walidator w zwykłe edytowalne węzły. Kolory i typografia zachowują
odwołania do tokenów; plan nie nadpisuje ustawień całego serwisu. Raport podaje
sekcje i uwagi; `diagnostic_passed` oznacza wyłącznie rozwinięcie lokalne.
Następnie wyrenderuj cały pierwszy szkic raz, przeczytaj uwagi i wykonaj
pre-flight, `/validate`, wersjonowany zapis oraz bramkę WordPress/PHP poniżej.
Podgląd po każdej sekcji jest potrzebny przy ręcznej adaptacji wzorca, nie przy
niezmienionej opublikowanej recepturze.

### Zapis i ocena

Oceń zapis na 1440/834/390: czy cała treść jest widoczna, tytuł ma właściwą
hierarchię i mieści się w kolumnie, media są załadowane i poprawnie wykadrowane,
CTA jest widoczne i klikalne, rytm i wyrównanie powtarzanych elementów są spójne,
a mobile zachowuje sensowną kolejność czytania. Brak overflow jest konieczny,
ale sam nie dowodzi jakości projektu. Nie skracaj dostarczonego tekstu, aby
ukryć przepełnienie; zmień wybór kompozycji lub zgłoś konkretną niezgodność.
Sprawdź też edycję kontrolek, Undo, zapis i ponowne otwarcie. Dopiero kanoniczny
zapis i te pomiary mogą dać `canonical_verified`; nowa kompozycja bez wzorca
nie otrzymuje wyniku `canonical_verified_1_to_1`.

## Adaptacja istniejącego wzorca

Poniższa trasa dotyczy świadomej adaptacji zapisanej strony, nie wymagań nowej
kompozycji powyżej.

## Skąd bierze się wzorzec

Nigdy z pamięci ani z opisu słownego. Zawsze z jednego z dwóch źródeł:

1. **Zapisana strona wzorcowa** — pobierz jej layout
   (`GET /wp-json/monteby/v1/pages/{id}/layout`) i czytaj wartości propów wprost
   z node mapy. To jest źródło rozstrzygające.
2. **Specyfikacja z pomiaru** — jeśli wzorzec istnieje jako strona, ale chcesz
   geometrii, użyj `extract-reference-spec.mjs` na niej i traktuj wynik jak
   referencję (wtedy w praktyce wracasz do trasy mechanicznej).

Jawna nowa decyzja użytkownika w briefie ma pierwszeństwo przed zapisanym
wzorcem. Wzorzec wypełnia tylko decyzje, których brief nie zmienia; każdą
rozbieżność odnotuj. Wartości muszą nadal przejść żywy kontrakt. Fonty wybieraj
z opublikowanego systemu typografii lub zatwierdzonych tokenów projektu,
nie z zapamiętanej nazwy ani CSS-u motywu.

Nowe węzły bez jawnej wartości korzystają z powiązań opublikowanych przez live
contract: `var(--gcb-color-*)`, `var(--gcb-font-*)`,
`var(--monteby-token-*)` oraz `typographyPreset`. Nie kopiuj ich obliczonej
wartości jako literału. Kolejność jest stała: wartość istniejąca lub dokładny
pomiar, zatwierdzone tokeny projektu, `globalStyles`, `designTokens`, neutralny
fallback. Konflikt koloru lub typografii rozstrzyga `globalStyles` i trafia do
uwag kitu. `customCSS` nigdy nie jest wejściem profilu.

## Procedura

| Faza | Komenda / czynność | Warunek przejścia |
|---|---|---|
| 0 Tokeny | wczytaj zatwierdzone tokeny marki projektu: `.monteby/design-tokens.mjs` i `brand.json` (albo `handoff.json` z przekazania, patrz `references/design-handoff.md`) | kolory, fonty i skala odstępów pochodzą z tokenów, nie z pamięci; brak plików tokenów odnotuj jawnie w raporcie |
| 1 Kontrakt | `GET /wp-json/monteby/v1/contract` → `.monteby/contract.json`; zbuduj `resolvedDesignProfile` | HTTP 200, jest `components`; pełne `globalStyles` i opcjonalne `designTokens` pochodzą z tego samego live response |
| 2 Wzorzec | `GET .../pages/{wzorzec}/layout` → zapisz jako `.monteby/pattern.json` | masz wartości propów sekcji, których będziesz używać |
| 3 Treść | zbierz treść w artefakcie `monteby-client-content-document` v1 (unikalne `id` + dokładny `text`) | teksty 1:1 z briefu, z zachowaniem U+00A0, bez skracania i parafraz |
| 4 Build per sekcja | `node .monteby/build-<slug>.mjs` na `layout-kit.mjs`, sekcja po sekcji z szybkim podglądem (niżej) | każda sekcja obejrzana w podglądzie zanim powstanie następna |
| 5 Uwagi kitu | przeczytaj `result.notes` | **pusta lista** albo każda pozycja świadomie zaakceptowana i opisana |
| 6 Pre-flight | `normalize-layout.js --contract … --layout …` | `Błędy: 0`, ostrzeżenia przeczytane |
| 7 Walidacja | `POST /wp-json/monteby/v1/validate` | `valid: true` |
| 8 Zapis | `GET .../layout` po `postModifiedGmt`, potem `PUT` z `expectedModifiedGmt` | HTTP 200 |
| 9 Bramka treści | przechwyć żywą stronę przez `capture-template-reference.js`, potem uruchom `verify-client-content.js --client-document … --live-manifest …` | `complete: true`; brak `missing`, `truncatedOrChanged`, `duplicateCountMismatch` i `added` |
| 10 Bramka końcowa | porównanie zrzutów zapisanej strony na 1440/834/390 (niżej) | brak przepełnienia poziomego, sekcje wyrenderowane, różnice zrzutów rozliczone |

Szerokości pomiaru: 1440/834/390. Wcześniejsza wersja tej tabeli podawała 768;
obowiązuje jedna reguła szerokości tabletu z `mechanical-workflow-protocol.md`
(arkusz tabletowy wtyczki działa do 900px, mobilny do 767px, a 834 to
szerokość pomiarowa).

## Iteracja per sekcja

Nie buduj całej strony na ślepo. Po każdej sekcji wyrenderuj szybki podgląd
statyczny i obejrzyj go, zanim przejdziesz dalej:

```bash
node monteby-site-authoring/scripts/render-monteby-preview.js \
  --contract .monteby/contract.json \
  --layout .monteby/layout-<slug>.json \
  --out .monteby/preview-<slug>.html
```

Podgląd statyczny jest diagnostyką, nie dowodem kanonicznym: łapie złe kolory,
złamane siatki, brakujące media i rozjechane odstępy od tokenów, zanim
zapłacisz koszt pełnego zapisu. Iteruj na pojedynczej sekcji do skutku, dopiero
potem dodawaj kolejną. Kanoniczna prawda pozostaje po stronie zapisanej strony
WordPress/PHP.

Przekazuj ten sam pełny kontrakt, którego użył Kit lub drafter. Podgląd korzysta
z jego `globalStyles`, `designTokens`, `typographyPreset` i `fontCatalog`,
bez przepisywania powiązań na literały w JSON. Nierozpoznana referencja, preset
lub brak źródła opublikowanego fontu blokuje podgląd; nie zastępuj go przypadkowym
fontem ani paletą. Samo poprawne wygenerowanie HTML nie potwierdza pobrania fontu.

## Bramka końcowa: porównanie zrzutów

Po zapisie wykonaj zrzuty zapisanej strony na trzech viewportach i porównaj je
z podglądem lub wzorcem wizualnym (makietą z design skilla, stroną wzorcową):

```bash
node monteby-site-authoring/scripts/capture-template-reference.js \
  --url "https://example.test/nowa-strona" \
  --out-dir .monteby/final-<slug> \
  --name candidate \
  --full-page \
  --capture-layout

node monteby-site-authoring/scripts/compare-screenshots.js \
  --target .monteby/final-<slug>/pattern-desktop.png \
  --candidate .monteby/final-<slug>/candidate-desktop.png \
  --diff .monteby/final-<slug>/diff-desktop.png \
  --label desktop
```

Powtórz porównanie dla tabletu i mobile. Gdy nie ma żadnego wzorca rastrowego,
bramką pozostaje inspekcja zrzutów: brak przepełnienia poziomego, kompletność
sekcji, zgodność kolorów i typografii z tokenami. Różnice wypisz w raporcie
z decyzją dla każdej; cicha akceptacja różnicy jest defektem. Sprawdź też
budżety wydajności z `mechanical-workflow-protocol.md` (sekcja „Budżety
wydajności").

**Uwagi kitu są bramką, nie logiem.** Kit zgłasza tam każde docięcie wartości do
kroku kontrolki oraz każdą pułapkę renderera. Pusta lista to jedyny dowód, że
layout odpowiada briefowi co do wartości — pre-flight tego nie wyłapie, bo widzi
już wartości po docięciu.

## Nazewnictwo artefaktów

Każdy plik pośredni nazywaj **per strona**: `.monteby/build-<slug>.mjs`,
`.monteby/layout-<slug>.json`, `.monteby/payload-<slug>.json`. Stała nazwa
(`payload.json`) w katalogu projektu to wyścig, gdy kilka stron powstaje
równolegle — plik znika albo zostaje nadpisany cudzą node mapą, a `/validate` i
`PUT` przyjmą to bez jednego ostrzeżenia.

## Spójność między stronami jednego serwisu

Te decyzje muszą być identyczne na wszystkich stronach serwisu — jeśli brief ich
nie rozstrzyga, weź je ze strony wzorcowej i zapisz w briefie na przyszłość:

- rytm pionowy sekcji: od Buildera 1.2.0 preferuj `sectionRhythmPreset`
  (`compact`/`standard`/`spacious`/`hero`, z wariantami Tablet/Mobile) zamiast
  ręcznego kopiowania `paddingTop*`/`paddingBottom*` ze wzorca; ręczne paddingi
  zostają tylko tam, gdzie zmierzony rytm nie pasuje do żadnego presetu. To samo
  dotyczy `sectionContentWidthPreset` wobec `innerMaxWidth`;
- skuteczne `lineHeight` na każdym `Heading` i `Text`, jawne albo z
  opublikowanego `typographyPreset`; nie nadpisuj działającego presetu lokalną
  wartością tylko po to, by uciszyć ostrzeżenie;
- `fontSizeTablet` i `fontSizeMobile` wszędzie, gdzie `fontSize ≥ 30px`
  (renderer nakłada `clamp()` od tego progu);
- `heightTablet`/`heightMobile` na każdym `ImageBlock` z `height`;
- liczba kafli w siatce hairline (`gap: 1px` + tło = kolor linii) musi być
  wielokrotnością liczby kolumn — inaczej pusta komórka renderuje się jako
  pomalowany prostokąt. Gdy nie jest, ostatniemu kaflowi nadaj
  `gridColumnSpan` równy liczbie kolumn oraz `gridColumnSpanTablet/Mobile: 1`;
- odstępy i wyrównanie kontenerów z przyciskami (`ButtonBlock` bez kontenera
  rozciąga się na całą szerokość kolumny);
- ruch: używaj wyłącznie kontrolek opublikowanych przez żywy kontrakt, jeżeli
  brief wymaga animacji. Nowa kompozycja nie wymaga CSS-u motywu potomnego.
  Brak wymaganego zachowania jest luką Builder/Core; nie zastępuj go klasami
  ani skryptem. Sprawdź w kanonicznym podglądzie działanie i preferencję
  ograniczenia ruchu.


## Treść ekspercka

Jeżeli strona zawiera odpowiedź ekspercką, autora, metadane redakcyjne albo
źródła, przeczytaj `references/expert-content-authoring.md`. Użyj
`QuickAnswer`, `PostInfo`, `AuthorBox` i `Sources` tylko wtedy, gdy publikuje je
żywy kontrakt. Dane faktograficzne pochodzą z briefu lub wskazanych materiałów;
brakującego autora, recenzenta, daty weryfikacji, profilu ani źródła nie wolno
uzupełniać domysłem.

## Listy, wyszukiwanie, sortowanie i filtry

Jeżeli brief wymaga publicznej listy treści lub produktów, przeczytaj
`references/query-loop-authoring.md`. `QueryLoop`, `FilterBar`,
`SearchControl`, `SortControl` i `ActiveFilters` twórz jako jeden graf związany
tym samym, jawnym `queryId`. Wszystkie typy treści, szablony wyników i pustego
stanu, taksonomie, termy oraz klucze pól własnych wybieraj wyłącznie z bieżącego
`hostChoices.queryLoop`. Nie przepisuj do URL surowych parametrów sortowania ani
kluczy meta; publiczna kontrolka wybiera tylko zapisany w pętli identyfikator
opcji sortowania.

## Kotwice i spis treści

Kotwica jest parą, a nie samym linkiem. Najpierw sprawdź w żywym kontrakcie,
czy docelowy `Section`, `Container` lub `Heading` wystawia kontrolowane pole
`anchorId`, i zastosuj dokładnie jego `pattern`. Potem ustaw tę samą wartość:

- bez `#` w `anchorId` oraz `TableOfContents.items[].anchor`;
- z jednym `#` w `ButtonBlock.href`, `Heading.href` lub innym linku do tego
  samego dokumentu.

Każda wartość docelowa musi wystąpić jako `anchorId` dokładnie raz w całej node
mapie. `cssId` pozostaje zablokowanym polem zgodności wstecznej i nie wolno go
używać do authoringu AI. Brak `anchorId` w żywym kontrakcie, brak celu albo
duplikat to `blocked_product_gap`; nie zastępuj tego klasą, surowym HTML,
JavaScriptem ani CSS-em potomnym. Po zbudowaniu kandydatury uruchom walidację
kitu i serwera przed zapisem.

## SEO i rola strony

Jeżeli brief jawnie określa SEO, rolę treści, FAQ schema albo encję główną,
przeczytaj `references/page-role-and-schema.md`. Najpierw pobierz pełny blok
`seo`, `seoOwnership` i `seoGraph` z zasobu layoutu. Rolę wybierz wyłącznie z
live `layoutPersistence.seo.schema.properties.schemaProfile.enum`; nie
wyprowadzaj jej ze slugu ani długości treści. Zapisuj pełny blok `seo` razem z
layoutem i tym samym `expectedModifiedGmt`, a po zapisie sprawdź `seoGraph` oraz
serwerowy HTML bez JavaScriptu. Gdy brief nie obejmuje SEO, nie dołączaj `seo`
do payloadu i zachowaj zapisany profil bez zmian.

## Czego kontrakt nie wystawia

- Zakres typografii `ButtonBlock` i pozostałych widgetów odczytuj z bieżących
  `props` i `controls`. Nie zakładaj braku `fontSizeTablet`, `fontSizeMobile`
  ani `lineHeight` na podstawie starszej wersji; nie dopisuj też wariantów,
  których aktualny kontrakt nie publikuje.
- `components[].defaults` to domyślne **edytora**. Renderer czyta
  `$props[...] ?? null` i pominiętego propa nie dokłada — nie zerujesz ich
  ręcznie.
- Typ kontrolki nie zwalnia z walidacji. Korzystaj ze wspólnego indeksu
  opublikowanych metadanych: zakresów, jednostek, repeaterów i referencji.
  Uruchamiaj `normalize-layout.js` i `/validate`; nie zakładaj, że `custom`,
  `color`, `font-picker` lub `media` oznacza dowolną wartość. Nieznany kształt
  wymaga sprawdzenia kontraktu, nie obejścia przez surowy CSS.
- Kit emituje skrócony kształt węzła (5 pól); serwer dopisuje `displayName`,
  `custom`, `hidden`, `linkedNodes`, `schemaVersion` przy zapisie. To jest
  poprawne, nie brak.

## Raport końcowy

Podaj: adres zapisanej strony, liczbę węzłów, wynik `/validate`, kod PUT, pomiar
przepełnienia na trzech szerokościach oraz **listę uwag kitu z decyzją dla
każdej**. Każde odstępstwo od briefu wymienia się jawnie — cicha zmiana wartości
jest defektem, nawet gdy strona wygląda dobrze.
