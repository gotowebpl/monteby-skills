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
| 0 Kontrakt | `GET /wp-json/monteby/v1/contract` → `.monteby/contract.json` | HTTP 200, jest `components` |
| 1 Wzorzec | `GET .../pages/{wzorzec}/layout` → zapisz jako `.monteby/pattern.json` | masz wartości propów sekcji, których będziesz używać |
| 2 Treść | zbierz treść w jednym pliku JSON (jeden obiekt na stronę) | teksty 1:1 z briefu, bez skracania i parafraz |
| 3 Build | `node .monteby/build-<slug>.mjs` na `layout-kit.mjs` | skrypt kończy się bez wyjątku |
| 4 Uwagi kitu | przeczytaj `result.notes` | **pusta lista** albo każda pozycja świadomie zaakceptowana i opisana |
| 5 Pre-flight | `normalize-layout.js --contract … --layout …` | `Błędy: 0`, ostrzeżenia przeczytane |
| 6 Walidacja | `POST /wp-json/monteby/v1/validate` | `valid: true` |
| 7 Zapis | `GET .../layout` po `postModifiedGmt`, potem `PUT` z `expectedModifiedGmt` | HTTP 200 |
| 8 Pomiar | zapisana strona na 1440/768/390 | brak przepełnienia poziomego, sekcje wyrenderowane |

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
  rozciąga się na całą szerokość kolumny).

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
