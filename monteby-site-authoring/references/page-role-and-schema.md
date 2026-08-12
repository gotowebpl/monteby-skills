# Role strony i graf Schema.org

Ta instrukcja obowiązuje zawsze, gdy agent ma utworzyć albo zmienić SEO strony,
jej rolę, FAQ schema lub relację Article/TechArticle/Service. Nie jest kopią
wersji produktu. Wszystkie pola, enumy i zasoby muszą pochodzić z bieżącego
`GET /wp-json/monteby/v1/contract`.

## 1. Najpierw ustal właściciela i kontrakt

Odczytaj jednocześnie:

- `layoutPersistence.seo.owner` i jego `authorable`;
- `layoutPersistence.seo.schema`, w tym pełną listę `required` oraz enum
  `schemaProfile`;
- `layoutPersistence.seo.graphPreview`, zwłaszcza `responseField`, dozwolone
  role, tryby wyjścia i wymaganie kanonicznego dowodu;
- aktualny `seo`, `seoOwnership` i `seoGraph` z
  `GET /wp-json/monteby/v1/pages/{id}/layout`.

Jeśli `authorable` ma wartość `false`, nie dołączaj `seo` do zapisu. Dokończ
zmiany layoutu, które nie zależą od SEO, a zmianę SEO zgłoś jako
`blocked_seo_owner`. Nie korzystaj z legacy page-settings, meta WordPressa ani
panelu innej wtyczki jako obejścia.

## 2. Zapisuj pełny, typowany blok

Zmiana SEO idzie w tym samym wersjonowanym `PUT` co layout i korzysta z tego
samego świeżego `expectedModifiedGmt`. Wyślij kompletny obiekt `seo` zgodny z
live `required`; zacznij od bloku odczytanego z GET i zmień tylko pola objęte
zadaniem. Nie rekonstruuj pominiętych pól z pamięci i nie zamieniaj `inherit`
na wartość efektywną bez jawnej decyzji użytkownika.

Nie wolno dodawać:

- surowego JSON-LD ani własnego `@graph`;
- typu Schema.org spoza live enumu;
- canonicala, autora, recenzenta, źródła, daty lub encji firmy wywnioskowanej
  ze slugu, zrzutu ekranu albo tekstu marketingowego;
- drugiego emitera obok właściciela wskazanego przez `seoOwnership`.

## 3. Rola jest decyzją treściową, nie heurystyką URL

Wybierz wyłącznie rolę opublikowaną w live `schemaProfile`:

- `informational` — zwykła strona informacyjna;
- `article` — artykuł redakcyjny;
- `tech_article` — materiał techniczny, gdy treść rzeczywiście nim jest;
- `service` — jedna opisana usługa;
- `faq` — pytania i odpowiedzi widoczne w tym samym layoucie;
- `collection` — publiczna kolekcja/listing;
- `profile` — publiczny profil jawnie wskazanej osoby;
- `contact` i `about` — odpowiednio strona kontaktowa i o podmiocie;
- `tool` — działające narzędzie;
- `auxiliary` — strona pomocnicza bez silniejszej roli;
- `none` — świadome wyłączenie encji strony;
- `webpage` — zachowywany historyczny odpowiednik strony informacyjnej.

`auto` i `inherit` są poprawne tylko wtedy, gdy zadanie świadomie pozostawia
decyzję niższej warstwie. Nie wybieraj `service`, bo slug zawiera `/uslugi/`,
ani `article`, bo strona ma dużo tekstu.

Article, TechArticle i Service nie zastępują WebPage. Oczekiwany graf ma osobny
kontener strony oraz encję główną połączone wzajemnie przez `mainEntity` i
`mainEntityOfPage`. Profil wymaga jawnej encji `Person`; organizacja nie jest
osobą zastępczą. FAQ musi pochodzić z widocznych pytań i odpowiedzi Buildera —
nie twórz ukrytej listy tylko dla wyszukiwarki.

## 4. Odczytaj raport po zapisie

Udany PUT zwraca pole nazwane przez
`layoutPersistence.seo.graphPreview.responseField` (obecnie `seoGraph`). Sprawdź:

1. `role.authored`, `role.effective`, `role.schemaType`, `role.pageType` i
   `role.source` odpowiadają decyzji;
2. `owner`, `outputMode` i `serverRendered` opisują oczekiwany tor emisji;
3. `entities` zawiera jeden kontener strony i właściwe encje główne;
4. `valueSources` nie wskazuje domysłu ani przypadkowego fallbacku;
5. żaden wpis `findings` o severity `error` nie pozostał;
6. `complete` ma wartość `true`.

`yoast-adapter-projection` oznacza, że Yoast pozostaje jedynym emiterem, a
raport pokazuje dane i relacje przekazane przez Builder. Nie wolno z tego
wnioskować, że identyfikatory końcowego grafu Yoasta będą identyczne z
projekcją.

## 5. Kanoniczna bramka na stronie publicznej

Raport REST jest diagnostyką ostatnio zapisanych ustawień, nie dowodem
kanonicznym. Po zapisie pobierz publiczną stronę renderowaną przez WordPress/PHP
bez wykonywania JavaScriptu i potwierdź:

- dokładnie jeden dokument/graf standardowego JSON-LD;
- brak konkurencyjnego Organization, Person, WebSite lub WebPage o tej samej
  tożsamości;
- typ kontenera strony zgodny z `seoGraph.role.pageType`;
- dla Article/TechArticle/Service zgodne, istniejące odwołania `mainEntity` i
  `mainEntityOfPage`;
- FAQ dokładnie odpowiada treści widocznego komponentu;
- canonical, robots i graf pochodzą od jednego właściciela;
- treść grafu istnieje w odpowiedzi HTML bez JavaScriptu.

Bez tej bramki wynik pozostaje `diagnostic_passed`. Błąd raportu lub konflikt
dwóch emiterów blokuje `canonical_verified`.
