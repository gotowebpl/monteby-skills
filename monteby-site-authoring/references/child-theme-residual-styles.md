# Residua: dokładne 1:1, gdy kontrakt czegoś nie wyraża

Ta referencja opisuje **jedyną dopuszczalną drogę** dopięcia wierności do 1:1, gdy
Builder nie ma kontrolki dla zmierzonego zachowania. Nie jest to furtka do
stylowania serwisu CSS-em — to wąski, generowany margines dla resztek.

## Kiedy wolno sięgnąć po arkusz

Dopiero po przejściu tej kolejności:

1. **Czy kontrakt to wyraża?** Uruchom `scripts/audit-reference-css.mjs`. Ok. 80%
   deklaracji typowej makiety mapuje się na propsy. Nie zgaduj — sprawdź.
2. **Czy da się to przebudować węzłem?** Pseudoelementy dekoracyjne (kreska przed
   nadtytułem, kropka, znacznik) odtwarzaj `Container`em o zmierzonych wymiarach.
   Audytor oznacza je jako `rebuild-as-node`.
3. **Czy to brak, który powinien trafić do produktu?** Jeśli kontrolka istnieje, ale
   ma zbyt zgrubny krok, brakuje wariantu responsywnego albo brak jest właściwości
   przydatnej na wielu serwisach — to zadanie dla `monteby-widget-development`.
   Ta droga jest domyślna dla wszystkiego, co wielokrotnego użytku.
4. **Dopiero teraz arkusz motywu potomnego** — dla rzeczy z natury site-specific
   albo takich, których kontrakt świadomie nie wystawia.

## Co należy do arkusza, a co nie

**Należy** (kontrakt tego nie wystawia z założenia lub konstrukcji):

| Residuum | Dlaczego nie propsem |
|---|---|
| `:hover`, `:focus`, `:active` | `authoring.blockedProps` blokuje `hoverBg`, `hoverColor`, `hoverShadow` |
| `transition` | stanów nie ma, więc i czasu przejścia |
| `position: sticky` na nagłówku | `Section` nie ma kontrolki pozycji |
| druga warstwa tła (siatka, szum, maska) | kontrakt składa gradient + jeden akcent radialny |
| `font-variation-settings` / oś `wdth` | brak kontrolki osi fontu zmiennego |
| reset domyślnych stylów wtyczki bez tokenu zerowego | np. `border-radius` pól formularza |

**Nie należy** — jeśli piszesz w arkuszu któreś z poniższych, wróć do node mapy:
kolory, typografia, odstępy, siatki, ramki, tła jednowarstwowe, wymiary, widoczność
responsywna. Wszystko to ma propsy.

## Zasada nadrzędna: arkusz jest generowany

Klasy renderera (`gcb-…`) są skrótem propsów węzła. Zmiana dowolnego propa zmienia
klasę, więc **ręcznie przepisany selektor po cichu przestaje działać** — strona
wygląda dobrze do najbliższej edycji.

Dlatego:

1. Opisz residua w pliku planu, wskazując węzły trwale — tekstem nagłówka, tekstem
   odnośnika albo numerem sekcji treści.
2. Wygeneruj arkusz ze **świeżo zapisanej** strony:

```bash
node $SKILL/scripts/emit-child-theme-css.mjs \
  --url http://SITE/strona/ --plan .monteby/residual-plan.json \
  --out wp-content/themes/<child>/assets/monteby-custom.css
```

3. Po **każdym** zapisie layoutu uruchom generator ponownie. Niezerowy kod wyjścia
   oznacza, że któregoś węzła nie odnaleziono — napraw plan, zanim uznasz stronę
   za gotową.

Plan trzymaj w repozytorium projektu obok layoutu. To on jest źródłem prawdy, nie
wygenerowany CSS.

## Podpięcie w motywie potomnym

Arkusz ładuj po stylu motywu, z wersją z `filemtime`, żeby nie walczyć z cache:

```php
add_action( 'wp_enqueue_scripts', static function (): void {
    $path = get_stylesheet_directory() . '/assets/monteby-custom.css';
    if ( ! is_file( $path ) ) {
        return;
    }
    wp_enqueue_style(
        'monteby-residual',
        get_stylesheet_directory_uri() . '/assets/monteby-custom.css',
        array( 'monteby-child' ),
        (string) filemtime( $path )
    );
}, 20 );
```

Gdy residuum wymaga zasobu (oś fontu zmiennego), dołóż go do **istniejącego**
zapytania zamiast ładować drugi arkusz tej samej rodziny:

```php
add_filter( 'style_loader_src', static function ( $src, $handle ) {
    if ( 'gotoweb-google-fonts' !== $handle || ! is_string( $src ) ) {
        return $src;
    }
    return str_replace( 'family=Archivo:wght@100..900',
                        'family=Archivo:wdth,wght@75..125,100..900', $src );
}, 10, 2 );
```

Motyw potomny trzymaj na bind moncie i w repozytorium projektu — nie w wolumenie
kontenera, gdzie zniknie przy odtworzeniu.

## Kolejność, gdy residuum zmienia metrykę

Niektóre residua zmieniają wymiary, nie tylko wygląd — oś `wdth` zmienia łamanie
wierszy i wysokość każdej sekcji. Zawsze:

1. najpierw wdroż residuum,
2. potem zdejmij obejścia, które kompensowały jego brak (np. zwężone `maxWidth`
   nagłówków dobierane pod węższy font),
3. dopiero na końcu mierz `compare-geometry.js`.

Odwrotna kolejność prowadzi do strojenia szerokości pod stan, który zaraz zniknie.

## Raport końcowy

Każde residuum wymień w podsumowaniu dla użytkownika: czego dotyczy, dlaczego nie
dało się propsem i gdzie trafiło (arkusz czy `monteby-widget-development`). Residuum
w arkuszu to dług produktowy — jeśli powtarza się na kolejnych serwisach, przenieś
je do kontraktu jako typowaną kontrolkę.
