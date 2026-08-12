# Tryb `content-brief-authoring`: strona z briefu, bez referencyjnego HTML

Użyj tego trybu, gdy masz **treść i wzorzec wizualny**, ale nie masz makiety do
zmierzenia: nowa podstrona serwisu, strona z briefu klienta, powielenie układu
z już zapisanej strony na kolejne adresy.

Tryb `owned-html-reconstruction` i jego zakaz ręcznego buildera **tu nie
obowiązują** — nie ma czego mierzyć, więc nie ma referencyjnej trasy pomiarowej.
Kanoniczną trasą jest `layout-kit.mjs`, a bramką jakości `normalize-layout.js`
plus pomiar zapisanej strony.

## Skąd bierze się wzorzec

Nigdy z pamięci ani z opisu słownego. Zawsze z jednego z dwóch źródeł:

1. **Zapisana strona wzorcowa** — pobierz jej layout
   (`GET /wp-json/monteby/v1/pages/{id}/layout`) i czytaj wartości propów wprost
   z node mapy. To jest źródło rozstrzygające.
2. **Specyfikacja z pomiaru** — jeśli wzorzec istnieje jako strona, ale chcesz
   geometrii, użyj `extract-reference-spec.mjs` na niej i traktuj wynik jak
   referencję (wtedy w praktyce wracasz do trasy mechanicznej).

Gdy brief podaje wartość inną niż zapisany wzorzec — **wygrywa wzorzec**.
Rozbieżność zgłoś w raporcie, nie wybieraj po cichu. Dotyczy to zwłaszcza
stacków fontów (`fontFamily`), których nie waliduje ani kontrakt, ani żadne
narzędzie: skopiuj dokładny string z `globalStyles.typography.fonts` albo
z layoutu wzorcowego.

## Procedura

| Faza | Komenda / czynność | Warunek przejścia |
|---|---|---|
| 0 Tokeny | wczytaj tokeny marki projektu: `.monteby/design-tokens.mjs` i `brand.json` (albo `handoff.json` z przekazania, patrz `references/design-handoff.md`) | kolory, fonty i skala odstępów pochodzą z tokenów, nie z pamięci; brak plików tokenów odnotuj jawnie w raporcie |
| 1 Kontrakt | `GET /wp-json/monteby/v1/contract` → `.monteby/contract.json` | HTTP 200, jest `components` |
| 2 Wzorzec | `GET .../pages/{wzorzec}/layout` → zapisz jako `.monteby/pattern.json` | masz wartości propów sekcji, których będziesz używać |
| 3 Treść | zbierz treść w jednym pliku JSON (jeden obiekt na stronę) | teksty 1:1 z briefu, bez skracania i parafraz |
| 4 Build per sekcja | `node .monteby/build-<slug>.mjs` na `layout-kit.mjs`, sekcja po sekcji z szybkim podglądem (niżej) | każda sekcja obejrzana w podglądzie zanim powstanie następna |
| 5 Uwagi kitu | przeczytaj `result.notes` | **pusta lista** albo każda pozycja świadomie zaakceptowana i opisana |
| 6 Pre-flight | `normalize-layout.js --contract … --layout …` | `Błędy: 0`, ostrzeżenia przeczytane |
| 7 Walidacja | `POST /wp-json/monteby/v1/validate` | `valid: true` |
| 8 Zapis | `GET .../layout` po `postModifiedGmt`, potem `PUT` z `expectedModifiedGmt` | HTTP 200 |
| 9 Bramka końcowa | porównanie zrzutów zapisanej strony na 1440/834/390 (niżej) | brak przepełnienia poziomego, sekcje wyrenderowane, różnice zrzutów rozliczone |

Szerokości pomiaru: 1440/834/390. Wcześniejsza wersja tej tabeli podawała 768;
obowiązuje jedna reguła szerokości tabletu z `mechanical-workflow-protocol.md`
(arkusz tabletowy wtyczki działa do 900px, mobilny do 767px, a 834 to
szerokość pomiarowa).

## Iteracja per sekcja

Nie buduj całej strony na ślepo. Po każdej sekcji wyrenderuj szybki podgląd
statyczny i obejrzyj go, zanim przejdziesz dalej:

```bash
node monteby-site-authoring/scripts/render-monteby-preview.js \
  --layout .monteby/layout-<slug>.json \
  --out .monteby/preview-<slug>.html
```

Podgląd statyczny jest diagnostyką, nie dowodem kanonicznym: łapie złe kolory,
złamane siatki, brakujące media i rozjechane odstępy od tokenów, zanim
zapłacisz koszt pełnego zapisu. Iteruj na pojedynczej sekcji do skutku, dopiero
potem dodawaj kolejną. Kanoniczna prawda pozostaje po stronie zapisanej strony
WordPress/PHP.

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
- `lineHeight` na **każdym** `Heading` i `Text` (brak = motyw narzuca własną
  interlinię, typowo 1.5–1.6, i bliźniacze strony rozjadą się wizualnie);
- `fontSizeTablet` i `fontSizeMobile` wszędzie, gdzie `fontSize ≥ 30px`
  (renderer nakłada `clamp()` od tego progu);
- `heightTablet`/`heightMobile` na każdym `ImageBlock` z `height`;
- liczba kafli w siatce hairline (`gap: 1px` + tło = kolor linii) musi być
  wielokrotnością liczby kolumn — inaczej pusta komórka renderuje się jako
  pomalowany prostokąt. Gdy nie jest, ostatniemu kaflowi nadaj
  `gridColumnSpan` równy liczbie kolumn oraz `gridColumnSpanTablet/Mobile: 1`;
- odstępy i wyrównanie kontenerów z przyciskami (`ButtonBlock` bez kontenera
  rozciąga się na całą szerokość kolumny);
- ruch: stany po najechaniu i wejścia sekcji. Kontrakt ich nie wystawia, więc
  żyją w motywie potomnym i obowiązują cały serwis naraz — nowa podstrona
  dziedziczy je bez żadnej pracy, ale tylko wtedy, gdy nie odbiega strukturą.
  Arkusz ruchu adresuje elementy strukturalnie (siatki, klasy renderera), a nie
  po identyfikatorze węzła; kafel poza siatką albo sekcja o innej budowie po
  cichu wypada z mechanizmu. Po zapisie strony sprawdź, ile węzłów dostało
  oznaczenia ruchu, i porównaj z liczbą kafli. Szczegóły i pułapki:
  `references/html-to-monteby.md`, sekcja „Ruch: przejścia, stany, wejścia".

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

- `ButtonBlock` ma wyłącznie `fontSize` — brak wariantów responsywnych i
  `lineHeight*`. Reguła „zawsze podawaj warianty" dotyczy tylko komponentów,
  które je mają (`Heading`, `Text`, `Container`). Kit powie to wprost zamiast
  rzucać ogólnym „prop spoza kontraktu".
- `components[].defaults` to domyślne **edytora**. Renderer czyta
  `$props[...] ?? null` i pominiętego propa nie dokłada — nie zerujesz ich
  ręcznie.
- Kontrolki typu `custom`, `spacing`, `color`, `font-picker`, `media` nie mają
  opisanego kształtu wartości i **nie są sprawdzane** przez `normalize-layout.js`
  ani `/validate`. Nie autoryzuj zbiorczego `Container.padding` (typ `custom`) —
  składaj odstęp z `paddingTop/Right/Bottom/Left`.
- Kit emituje skrócony kształt węzła (5 pól); serwer dopisuje `displayName`,
  `custom`, `hidden`, `linkedNodes`, `schemaVersion` przy zapisie. To jest
  poprawne, nie brak.

## Raport końcowy

Podaj: adres zapisanej strony, liczbę węzłów, wynik `/validate`, kod PUT, pomiar
przepełnienia na trzech szerokościach oraz **listę uwag kitu z decyzją dla
każdej**. Każde odstępstwo od briefu wymienia się jawnie — cicha zmiana wartości
jest defektem, nawet gdy strona wygląda dobrze.
