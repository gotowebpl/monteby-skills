# Runbook: HTML → Monteby w kilkunastu minutach

Procedura do wykonania krok po kroku. Każdy krok ma komendę i warunek przejścia
dalej. Nie improwizuj — jeśli warunek nie jest spełniony, wróć do wskazanego kroku.
Napisane tak, by dało się wykonać bez wnioskowania o kontrakcie: reguły są
w narzędziach, nie w głowie.

Ścieżki poniżej zakładają katalog roboczy projektu i katalog `.monteby/` na
artefakty. `$SKILL` to katalog tego skilla.

---

## Krok 0 — Dane wejściowe (30 s)

Potrzebujesz trzech rzeczy. Jeśli którejś brakuje, zapytaj użytkownika i zatrzymaj się.

1. Adres działającej instalacji WordPress z Monteby (np. `http://localhost:8200`).
2. Login i hasło aplikacyjne do REST.
3. Referencja: adres HTML makiety **albo** plik HTML.

---

## Krok 1 — Kontrakt (30 s)

```bash
curl -s -u "USER:APP_PASSWORD" http://SITE/wp-json/monteby/v1/contract -o .monteby/contract.json
```

**Warunek:** plik istnieje i ma klucz `components`. Jeśli nie — przerwij i zgłoś,
że workflow wymaga działającego Site Contract API.

Nie czytaj kontraktu w całości. Wszystkie reguły wartości egzekwuje `layout-kit.mjs`.

---

## Krok 2 — Pomiar makiety (2 min)

Otwórz makietę w przeglądarce, ustaw szerokość **1440**, wykonaj snippet:

```bash
node $SKILL/scripts/compare-geometry.js --emit-snippet
```

Wynik zapisz jako `.monteby/ref-1440.json`.

**Warunek:** `sections` ma tyle pozycji, ile pasów widać na makiecie. Jeśli 0 —
makieta używa innej struktury; zmierz ręcznie i zapisz w tym samym formacie.

Z pomiaru weź do planu: liczbę i kolejność sekcji, ich wysokości, kolory tła,
paddingi, oraz liczbę wierszy każdego nagłówka.

---

## Krok 2b — Audyt CSS makiety (1 min)

```bash
node $SKILL/scripts/audit-reference-css.mjs --contract .monteby/contract.json \
  --css MAKIETA.css --out .monteby/residual-plan-raw.json
```

Czytasz jedną liczbę: ile deklaracji trafia do koszyka `residual`. To lista rzeczy,
których **nie próbuj** robić propsami — zajmiesz się nimi w kroku 9. Reszta jest
wyrażalna i należy do kroku 4.

Jeśli nie masz pliku CSS (makieta jest tylko pod adresem), pomiń ten krok i wróć do
niego po kroku 7, gdy zobaczysz różnice.

**Warunek:** plan zapisany. Typowo 75–85% deklaracji ląduje w koszyku `contract`.

---

## Krok 3 — Plan sekcji (2 min)

Wypisz listę sekcji w kolejności z pomiaru. Dla każdej ustal jedną linijkę:
tło, padding góra/dół, układ. Układ dobierz z tabeli — nie wymyślaj:

| Co widać w makiecie | Co ustawiasz |
|---|---|
| jedna kolumna treści | brak `layoutDisplay` |
| dwie równe kolumny | `layoutDisplay: 'grid'`, `gridTemplateColumns: 'two'` |
| dwie nierówne kolumny | `'two-proportional'` + `gridFirstColumnPercent: <udział 1. kolumny w %>` |
| trzy/cztery równe kafle | `'three'` / `'four'` |
| pięć równych kafli | `layoutDisplay: 'flex'` + dzieci `flexBasis: '20%'`, `flexGrow: 1`, `minWidth: '0px'` |
| rząd elementów obok siebie | `layoutDisplay: 'flex'`, `flexDirection: 'row'`, `gap` |
| wąski znacznik + tekst | flex + dziecko o stałej `width` i `flexShrink: 0` |

Na tablet i mobile dodaj `gridTemplateColumnsTablet: 'one'` wszędzie tam, gdzie
kolumny mają się złożyć.

---

## Krok 4 — Budowa layoutu (5–10 min)

Napisz jeden plik `.monteby/build.mjs` na bazie `layout-kit.mjs`. Kit sam pilnuje
kontraktu i naprawia pułapki renderera, więc podawaj wartości wprost z CSS makiety —
zaokrągli je do dozwolonego kroku.

```js
import { Kit } from '$SKILL/scripts/layout-kit.mjs';
const k = await Kit.fromContract('.monteby/contract.json');

const hero = k.shell(
  { background: '#0a0b0d', paddingTop: '104px', paddingBottom: '84px',
    layoutDisplay: 'grid', gridTemplateColumns: 'two-proportional',
    gridFirstColumnPercent: 63, gridTemplateColumnsTablet: 'one', gap: '72px' },
  [
    k.box({}, [
      k.heading('Nagłówek', { tag: 'h1', fontSize: '78px', lineHeight: '1.05',
                              fontWeight: '800', textColor: '#f4f2ee' }),
      k.text('Lead…', { fontSize: '20px', lineHeight: '1.65', textColor: '#e6e2da' }),
      k.button('Kontakt', '#kontakt', { backgroundColor: '#ffbe00', textColor: '#0a0b0d' }),
    ]),
    k.image('https://…/rysunek.png', { width: '100%', height: '402px', objectFit: 'contain' }),
  ]
);

const res = await k.write('.monteby/layout.json', [hero /*, kolejne sekcje w kolejności */]);
console.log(res.nodes, res.notes);
```

Zasady, których nie łam:

- kolejność sekcji dokładnie jak w pomiarze — bez pomijania i przestawiania;
- treść przepisz z makiety co do słowa, nie streszczaj;
- każdy obraz z `height` (inaczej ma zerową wysokość do czasu wczytania);
- listy pozycji: `ListBlock` przyjmuje **teksty**; jeśli mają być klikalne, użyj
  `k.button(...)` w kolumnie;
- formularz zawsze z wymaganą zgodą RODO (typ `checkbox`, `linkText`, `linkUrl`).

**Warunek:** skrypt kończy się bez wyjątku. Wyjątek = zła nazwa propa lub złe
zagnieżdżenie; komunikat wskazuje węzeł — popraw i uruchom ponownie.

---

## Krok 5 — Kontrola lokalna (30 s)

```bash
node $SKILL/scripts/normalize-layout.js --contract .monteby/contract.json --layout .monteby/layout.json
```

**Warunek:** `Błędy: 0`. Ostrzeżenia przeczytaj — każde opisuje realny defekt
w rendererze. Dopiero teraz wołaj REST.

---

## Krok 6 — Walidacja i zapis (1 min)

```bash
# walidacja
curl -s -u "USER:PASS" -X POST http://SITE/wp-json/monteby/v1/validate \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json;print(json.dumps({'nodeMap':json.load(open('.monteby/layout.json'))}))")"

# odczyt wersji, potem zapis z warunkiem
MOD=$(curl -s -u "USER:PASS" http://SITE/wp-json/monteby/v1/pages/ID/layout | python3 -c "import json,sys;print(json.load(sys.stdin)['postModifiedGmt'])")
```

W `PUT /wp-json/monteby/v1/pages/ID/layout` wyślij `expectedModifiedGmt` = `$MOD`
oraz `nodeMap`. Dla strony z sekcjami na pełną szerokość dołóż
`"presentation": {"layout": "full-width", "disableGlobalTemplates": false}`.

**Warunek:** HTTP 200. Kod 428/409 = pobierz layout ponownie i powtórz.

---

## Krok 7 — Pomiar kandydata i porównanie (2 min)

Otwórz zapisaną stronę przy szerokości **1440**, wykonaj ten sam snippet co w kroku 2,
zapisz jako `.monteby/cand-1440.json`, po czym:

```bash
node $SKILL/scripts/compare-geometry.js --reference .monteby/ref-1440.json --candidate .monteby/cand-1440.json
```

Czytaj wynik mechanicznie:

| Objaw w raporcie | Co zrobić |
|---|---|
| inna liczba sekcji | wróć do kroku 4, brakuje sekcji |
| głębokość < 95% | patrz „łamanie nagłówków” poniżej; jeśli równe — sprawdź paddingi sekcji z pomiaru |
| „inne łamanie nagłówków” | referencja używa innej osi szerokości fontu — patrz `html-to-monteby.md` §5–6 |
| „inne tło” w sekcji N | porównaj `background` z pomiaru; przy `backgroundType: 'image'` kolor tła nie jest emitowany |
| poziome przepełnienie | zwykle nagłówek strony: skróć etykiety menu, ukryj CTA (`responsiveDisplay`) |
| pojedyncze delty ±30 px | zignoruj, jeśli suma mieści się w 95% |

Powtarzaj kroki 4–7, aż raport powie „Bez zastrzeżeń”. Zwykle wystarczają dwa obiegi.

---

## Krok 8 — Responsywność (1 min)

Powtórz pomiar przy 390 i 768. Sprawdzasz jedną rzecz: `overflow: false`.
Przy przepełnieniu winowajcą jest prawie zawsze nagłówek — użyj
`responsiveDisplay: 'hide-mobile'` lub `'hide-tablet-down'` na elemencie CTA.

---

## Krok 9 — Residua (3 min)

Weź listę z kroku 2b i dopnij 1:1. Kolejność jest obowiązkowa — opisuje ją
`references/child-theme-residual-styles.md`.

1. Pozycje `rebuild-as-node` (kreski, kropki, znaczniki) odtwórz `Container`em
   o zmierzonych wymiarach — wróć do kroku 4.
2. Pozycje `widget-development` (za zgrubny krok kontrolki, brakujący wariant
   responsywny) zgłoś jako lukę produktu; nie obchodź ich CSS-em.
3. Resztę zapisz jako plan i wygeneruj arkusz:

```bash
node $SKILL/scripts/emit-child-theme-css.mjs --url http://SITE/strona/ \
  --plan .monteby/residual-plan.json \
  --out wp-content/themes/CHILD/assets/monteby-custom.css
```

Plan wskazuje węzły trwale (`headingText`, `linkText`, `sectionIndex`), nie klasami.
Klasy renderera zmieniają się przy każdej edycji propsów, dlatego arkusz
**regeneruj po każdym zapisie layoutu**.

**Warunek:** generator kończy się kodem 0 (wszystkie węzły odnalezione).

Jeśli residuum zmienia metrykę (oś `wdth` zmienia łamanie i wysokość sekcji):
wdroż je, potem zdejmij obejścia, które kompensowały jego brak, i dopiero wtedy
wróć do kroku 7.

---

## Warunki ukończenia

Zgłoś zakończenie dopiero, gdy wszystkie są spełnione:

- [ ] `normalize-layout.js` — 0 błędów
- [ ] `/validate` — `valid: true`
- [ ] `PUT layout` — HTTP 200
- [ ] `compare-geometry.js` przy 1440 — „Bez zastrzeżeń” albo głębokość ≥ 95%
- [ ] brak poziomego przepełnienia przy 390, 768 i 1440
- [ ] `emit-child-theme-css.mjs` — kod 0, arkusz podpięty w motywie potomnym
- [ ] lista residuów przekazana użytkownikowi z adresatem (arkusz / produkt)
