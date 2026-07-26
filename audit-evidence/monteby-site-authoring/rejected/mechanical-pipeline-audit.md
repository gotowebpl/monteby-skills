# Audyt toru mechanicznego: gdzie kończy się maszyna, a zaczyna model

Wynik audytu skilla pod kątem pracy lekkich modeli (Haiku/Sonnet) nad złożonymi
layoutami. Zasada podziału jest jedna:

> **Maszyna robi wszystko, co jest funkcją pomiaru. Model podejmuje wyłącznie
> decyzje wypisane w raportach — nigdy nie interpretuje makiety „na oko".**

## Architektura toru

```
makieta ──► extract-reference-spec ──► spec.json        (pomiar, 100% mechaniczne)
spec.json ─► spec-to-layout ─────────► layout + RAPORT  (kompilacja, 100% mechaniczne)
layout ────► normalize-layout ───────► czysty layout    (kontrola, 100% mechaniczna)
layout ────► /validate → PUT ────────► strona           (REST, 100% mechaniczne)
strona ────► compare-geometry ───────► TABELA DELT      (pomiar, 100% mechaniczny)

RAPORT + TABELA DELT ──► model ──► poprawki propsów / plan residuów
                          ▲ jedyne miejsce sprawczości modelu
```

Model dostaje dwa dokumenty wejściowe o ograniczonej długości i pracuje listę
po liście. Nie ogląda makiety, nie wymyśla struktury, nie pisze node mapy od
zera — poprawia rusztowanie w punktach, które maszyna sama wskazała.

## Kalibracja (zmierzone na stronie referencyjnej, 9 sekcji, 139 węzłów)

- kompilacja bez udziału modelu: **wszystkie sekcje obecne i w kolejności**,
  zero przepełnień, ~88% głębokości makiety, `/validate` czyste za pierwszym
  podejściem;
- raport kompilatora: kilkanaście pozycji, każda z adresatem
  (`media` / `child-theme` / `manual-controls` / `widget-development` /
  `dropped-prop` / `content`);
- typowa praca modelu po kompilacji: podmiana mediów, dostrojenie kontrolek
  formularza, plan residuów — rzeczy z raportu, nie odkrycia.

Ten poziom to **rusztowanie**, nie wynik końcowy. Wynik końcowy = rusztowanie
+ przepracowany raport + delty poniżej progu z runbooka.

## Jak model pracuje raport kompilatora

Każdy `target` w raporcie ma jedną, zamkniętą procedurę:

| target | Co robi model |
|---|---|
| `media` | eksportuje SVG makiety do PNG/WebP, wgrywa przez `wp media import`, wpisuje URL w propsa `src`/`backgroundImage` |
| `dropped-prop` | obramowanie sekcji → przenosi na wewnętrzny `Container` albo `Divider`; inne — sprawdza, czy prop ma sens na dziecku |
| `manual-controls` | otwiera specyfikację wskazanego węzła i przepisuje wartości na kontrolki widgetu (np. kolory pól `FormBlock`) |
| `content` | uzupełnia treść wskazaną w raporcie |
| `legal` | prosi użytkownika o zatwierdzoną treść zgody (administrator, cel, adres polityki); niczego nie wymyśla — do czasu dostarczenia formularz ma werdykt `blocked_legal_copy` |
| `child-theme` | prosi właściciela o imienną zgodę na to jedno zachowanie; dopiero po niej dopisuje regułę do planu residuów — polityka i tryb wyjątku: `child-theme-residual-styles.md` (domyślnie residualny CSS jest zabroniony) |
| `widget-development` | zgłasza lukę produktu; **nie** obchodzi jej CSS-em |
| `compiler-fallback` | sprawdza wynik wizualnie; fallback flex zwykle wystarcza |

## Jak model pracuje tabelę delt

Z `compare-geometry.js`, mechanicznie, wiersz po wierszu:

| Objaw | Procedura |
|---|---|
| delta sekcji > +60 px | nadmiarowe marginesy/paddingi — porównaj `padding` sekcji ze spec |
| delta sekcji < −60 px | zgubiona zawartość — porównaj liczbę dzieci sekcji ze spec; najczęściej media (`asset`) bez podmiany |
| inne łamanie nagłówka | oś fontu zmiennego → plan residuów (`font-variation-settings` jest w spec) |
| `overflow: true` | element z raportu `dropped-prop`/nagłówek — `responsiveDisplay` |
| suma delt < progu | koniec pracy nad geometrią |

## Zamknięte luki (z tej kalibracji)

Każda z tych rzeczy była wcześniej „kombinatoryką" — teraz jest regułą w kodzie:

1. **Pasy strony to nie tylko `<section>`** — kolektor bierze wszystkie blokowe
   dzieci `<main>` (pasek tickera był divem i ginął).
2. **Rząd samych odnośników to kontener, nie akapit** — inaczej przyciski CTA
   znikały w roli `text`.
3. **Section nie przyjmuje obramowań** — kompilator filtruje propsy pod docelowy
   komponent i raportuje odrzuty, zamiast się wywracać.
4. **Pionowe paddingi wrappera treści sumują się z sekcją** przy podnoszeniu
   go do `innerMaxWidth` — bez tego każda sekcja była za niska o swój padding.
5. **Warstwy tła**: `radial + linear` → gradient + akcent kontraktu; sam radial
   albo >2 stopnie → raport `child-theme`.
6. **Siatki**: równe 1/2/3/4/6 → tokeny; 5 równych → flex `flexBasis 20%`;
   2 nierówne → `two-proportional` + procent z pomiaru; inne → raport.
7. **Warianty responsywne siatek** mają tabelę domyślną (`three→two→one` itd.) —
   model korektę robi z pomiaru 768/390, nie z wyobraźni.
8. **Formularz bez zgody zatrzymuje się na raporcie `legal`** — treści prawnej
   nie wolno wymyślać; kompilator żąda zatwierdzonego tekstu zgody.

## Czego świadomie nie automatyzujemy

- **Podmiana mediów** — wymaga eksportu grafik i decyzji o licencji; raport
  wskazuje każdy plik.
- **Dobór widgetów specjalnych** (`TickerBlock`, `StatsGrid`, `TabsBlock`) —
  kompilator daje wierną wersję z prymitywów; podmiana na widget dedykowany to
  świadoma decyzja modelu (raport nie blokuje).
- **Treść i język** — kompilator przenosi tekst wiernie; wszelkie zmiany
  redakcyjne są poza torem.
- **Estetyka stanów** (kolory hoverów itp.) — model proponuje wartości do planu
  residuów; makieta jest źródłem, gdy je definiuje.

## Kryterium „mechaniczności" przy zmianach skilla

Nowa instrukcja w tym skillu musi przejść test: *czy krok da się wykonać komendą
albo lookupem w tabeli, a wynik sprawdzić kodem wyjścia lub progiem liczbowym?*
Jeśli nie — to nie jest krok runbooka, tylko kandydat na narzędzie albo wpis
w raporcie kompilatora.
