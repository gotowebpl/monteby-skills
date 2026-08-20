# QueryLoop: publiczne wyszukiwanie, sortowanie i filtry

Ta instrukcja obowiązuje w każdym trybie, który tworzy lub modyfikuje publiczną
listę opartą na `QueryLoop`. Nie jest snapshotem produktu. Nazwy komponentów,
właściwości, enumy, limity i zasoby opisane niżej muszą istnieć w aktualnej
odpowiedzi `GET /wp-json/monteby/v1/contract`.

Query controls są capability Buildera od `productVersion` 1.3.9. Odczytaj gate
`queryControls` z manifestu schema 3: wersja poniżej minimum to
`blocked_plugin_version`; wersja spełniająca minimum bez
`authoring.relationshipRules.queryControls` to
`blocked_contract_inconsistency`; dopiero spójny kontrakt, który nie potrafi
wyrazić wymaganej funkcji listy, jest `blocked_product_gap`.

## 1. Najpierw odkryj kontrakt grafu

Sprawdź równocześnie:

- `components` dla `QueryLoop`, `FilterBar`, `SearchControl`, `SortControl` i
  `ActiveFilters`;
- `authoring.relationshipRules.queryControls` — komponent pętli, dozwolone
  kontrolki, prop referencji, regułę jednoznaczności, obsługę `source="inherit"`,
  zgodność typu treści i wymaganie opcji sortowania;
- `hostChoices.queryLoop.templates`, `emptyTemplates`, `postTypes`,
  `metaKeysByPostType`, `taxonomiesByPostType` i `termsByTaxonomy`;
- `hostBindings`, `controls`, `props`, `defaults` i limity każdej używanej
  właściwości.

Po klasyfikacji wersji i spójności brak wymaganej funkcji oznacza
`blocked_product_gap`. Nie odtwarzaj jej klasą, surowym HTML, własnym
JavaScriptem, parametrem URL ani child theme.

## 2. Zbuduj jeden jednoznaczny graf

1. Nadaj pętli jawny, stabilny `queryId` zgodny z jej live schema. Nie wyprowadzaj
   go z tłumaczonego tytułu ani chwilowej pozycji noda.
2. Ten `queryId` musi wskazywać dokładnie jeden `QueryLoop` w całej node mapie.
   Duplikat jest niejednoznaczny, a kontrolka bez pętli jest osierocona.
3. Każdy `FilterBar`, `SearchControl`, `SortControl` i `ActiveFilters` tej listy
   otrzymuje dokładnie ten sam `queryId`.
4. Nie dołączaj publicznych kontrolek do pętli z `source="inherit"`, jeżeli live
   `inheritSourceAllowed` ma wartość `false`. Nie zamieniaj jej po cichu na
   `custom` — to zmiana znaczenia zapytania.
5. `FilterBar.postType` musi być zgodny z `QueryLoop.postType`, gdy wskazuje to
   `postTypeParityComponents`.

Waliduj cały graf przez `/validate`; sama poprawność pojedynczych propsów nie
wykrywa duplikatu ani osieroconej referencji.

## 3. Host jest jedynym źródłem wartości

- `postType` wybierz z `hostChoices.queryLoop.postTypes`.
- `templateId` wybierz z `templates`, a `emptyTemplateId` z `emptyTemplates`.
  Nie zakładaj, że zwykły szablon karty może pełnić rolę pustego stanu.
- `taxonomy` wybierz z `taxonomiesByPostType.{postType}`, a `terms` wyłącznie z
  `termsByTaxonomy.{taxonomy}`.
- `orderMetaKey` oraz `sortOptions[].metaKey` wybierz wyłącznie z
  `metaKeysByPostType.{postType}`. Lista zawiera tylko zarejestrowane,
  REST-visible, skalarne pola; nie wolno zgadywać prywatnych kluczy bazy.
- Jeśli zależna gałąź host choices jest pusta, pomiń zależną funkcję albo zgłoś
  brak. Nie zastępuj jej wartością pamiętaną z innej strony lub instalacji.

## 4. Sortowanie jest zamkniętym menu

Opcje sortowania zapisuje właściciel zapytania, czyli `QueryLoop.sortOptions`.
Każda opcja ma stabilne `id`, widoczną `label` oraz dozwolone przez live schema
`orderBy` i `order`; `metaKey` występuje tylko dla wariantu, który go wymaga.
`SortControl` wolno dodać dopiero, gdy pętla ma co najmniej jedną poprawną opcję.

Publiczny adres przenosi wyłącznie identyfikator zapisanej opcji. Nigdy nie
twórz kontrolki ani linku, który przyjmuje z URL surowe `orderBy`, `order`,
`metaKey` lub nazwę kolumny. Nie dodawaj własnego parsera tych wartości.

## 5. Filtry i indeksowanie

`FilterBar.terms` ogranicza publiczne wybory do termów opublikowanych przez
hosta. Domyślnie traktuj warianty filtrowane jako `noindex`. Ustaw
`indexPolicy="allowlist"` tylko wtedy, gdy wymagania SEO jawnie wskazują
konkretne kombinacje, a live schema publikuje tę możliwość.

Każdy wpis `indexableTermSets` jest dokładnym, kanonicznym zbiorem slugów spośród
termów oferowanych przez ten filtr, zgodnym z `selectionMode`. Nie generuj
kombinacji automatycznie i nie traktuj podzbioru jako zgody na indeksowanie
supersetu. Wyszukiwanie i zmienione sortowanie pozostają `noindex`; nie próbuj
obchodzić tej reguły przez props SEO ani ręczny canonical.

## 6. Paginacja i pusty wynik

Wybierz `paginationMode` wyłącznie z enumu bieżącego `QueryLoop`. Tryb
`infinite`, jeśli jest dostępny, ma zachować serwerowy link progresywnego
fallbacku; nie usuwaj go i nie zastępuj przewijania własnym skryptem. To samo
zapytanie, filtry, wyszukiwanie i sortowanie muszą działać po przejściu bez AJAX.

Jeśli brief wymaga zaprojektowanego pustego stanu, wskaż istniejący
`emptyTemplateId` z `hostChoices.queryLoop.emptyTemplates`. Brak odpowiedniego
szablonu wymaga osobnego, jawnego utworzenia go przez obsługiwany zasób hosta;
nie wpisuj arbitralnego ID.

## 7. Modyfikacja istniejącej strony

Dla ograniczonej zmiany użyj operacji z live
`layoutPersistence.operations`: najpierw `patch-validate`, potem wyłącznie
emitowany `patch-save`. Zmiany `queryId`, `postType`, `sortOptions` lub polityki
indeksowania waliduj razem ze wszystkimi zależnymi kontrolkami; częściowa zmiana
jednej strony relacji ma zostać odrzucona, nie „naprawiona” domysłem.

## 8. Bramka końcowa

Po kanonicznym zapisie sprawdź stronę WordPress/PHP z JavaScriptem i bez niego:

- wynik początkowy, pusty stan i całkowitą liczbę wyników;
- wyszukiwanie, każdą zapisaną opcję sortowania oraz dozwolone filtry;
- usuwanie aktywnych filtrów i czyszczenie stanu;
- paginację lub progresywny fallback trybu `infinite`;
- zachowanie parametrów URL po odświeżeniu i brak surowych kluczy meta/query;
- canonical/robots dla bazowej listy, wyszukiwania, sortowania i każdej jawnie
  dozwolonej kombinacji filtrów;
- brak duplikatów `queryId`, kontrolek osieroconych i niezgodnych typów treści.

Podgląd statyczny nie potwierdza zapytania WordPress, odpowiedzi AJAX ani SEO.
Taki wynik pozostaje `diagnostic_passed` do czasu weryfikacji zapisanej strony.
