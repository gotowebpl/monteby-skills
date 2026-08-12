# Treść ekspercka: autor, metadane, szybka odpowiedź i źródła

Ten dokument obowiązuje w każdym trybie, w którym strona zawiera treść
ekspercką. Nie zastępuje żywego kontraktu. Najpierw pobierz
`GET /wp-json/monteby/v1/contract` i sprawdź `components`; właściwości, typy,
limity repeaterów, dozwoleni rodzice i kontrolki z odpowiedzi są jedynym
autorytatywnym schematem.

Jeżeli potrzebnego widgetu nie ma w żywym kontrakcie, nie odtwarzaj go przez
`HtmlBlock`, shortcode, klasę CSS ani child theme. To `blocked_product_gap` i
osobny przebieg przez skill `monteby-widget-development`.

## Publiczny katalog ekspertów i przypisanie redakcyjne

Jeżeli `contract.layoutPersistence.editorial` istnieje, jest jedynym źródłem
tożsamości autora i recenzenta dla grafu strony. Nie pobieraj osób z kont
logowania WordPressa ani nie wysyłaj wpisanej ręcznie nazwy. Używaj wyłącznie
obiektów z `editorial.profiles`, które serwer opublikował jako kwalifikujące się
profile ekspertów.

1. Pobierz bieżący dokument strony przez
   `GET /wp-json/monteby/v1/pages/{postId}/editorial`.
2. Wybierz `authorProfileId` i opcjonalny `reviewerProfileId` z dokładnej listy
   `profiles`. Autor i recenzent muszą być różnymi osobami.
3. Zapisz cały dokument przez metodę i ścieżkę wskazane w
   `contract.layoutPersistence.editorial.resource`. Wyślij dokładnie:
   `authorProfileId`, `reviewerProfileId`, `reviewAction` oraz niezmieniony
   `expectedContentSha256` z `verification.currentContentSha256`.
4. Dla zwykłego przypisania użyj `reviewAction: "keep"`. Nie używaj
   `"confirm"`, dopóki człowiek nie potwierdzi, że wskazany recenzent naprawdę
   sprawdził bieżącą zapisaną treść. `"clear"` jawnie usuwa wcześniejsze
   potwierdzenie, zachowując wybrane osoby.
5. Status `409` oznacza, że treść zmieniła się od odczytu. Pobierz dokument
   ponownie, pokaż różnicę człowiekowi i nie ponawiaj starego potwierdzenia.

Potwierdzenie jest związane z dokładnym odciskiem zapisanej treści. Po zmianie
layoutu lub treści `verification.status` przechodzi na `stale`; nie kopiuj wtedy
`verifiedAt` do widocznego `PostInfo`, nie emituj recenzenta jako aktualnego i
nie próbuj przywracać daty przez zapis propsów layoutu. Ponowna weryfikacja jest
osobną, świadomą czynnością człowieka.

Jeżeli kontrakt nie publikuje zasobu `editorial`, pozostaw autora i recenzenta
nieprzypisanych w workflow. Możesz użyć jawnie zatwierdzonych danych w widocznym
widżecie tylko zgodnie z bramką pochodzenia poniżej, ale nie wolno udawać, że
tworzą one serwerowo potwierdzoną encję lub recenzję.

## Reguły kategorii i masowe przypisanie

Jeżeli `contract.layoutPersistence.editorial.automation` istnieje, odczytaj
metody, ścieżki i limity dokładnie z jego `resources` oraz `limits`. Nie zgaduj
endpointów i nie zapisuj przypisań bez podglądu.

1. Pobierz dokument reguł z `automation.resources.rules.path`. Zachowaj jego
   `revision`; reguły są uporządkowane, a `first_matching_rule` oznacza, że
   pierwsza pasująca reguła wygrywa.
2. Zmieniaj wyłącznie profile, typy treści, taksonomie i terminy opublikowane
   przez serwer. Zapis reguł wysyła cały dokument z `expectedRevision`. Przy
   `409` przerwij, pobierz bieżące reguły i pokaż różnicę człowiekowi.
3. Masowe przypisanie rozpocznij przez zasób `bulkPreview`. Podgląd musi być
   wygenerowany z aktualnym `expectedRulesRevision`; nie powoduje zapisu.
4. Pokaż człowiekowi każdy element `changes`, w tym bieżącego autora i
   recenzenta, wynik, `ruleId` oraz wszystkie `matchedRuleIds`. Kilka dopasowań
   jest ważnym ostrzeżeniem o kolejności reguł. Jeżeli `hasMore` ma wartość
   `true`, po zatwierdzeniu bieżącej partii pobierz następną od `nextOffset`;
   ponowne zaczynanie od zera może nigdy nie dojść do dalszych wpisów.
5. Do `bulkApply` przekaż bez zmian `rulesRevision`, `previewToken` oraz dokładne
   `operation` z każdego zatwierdzonego wiersza. Nie buduj operacji samodzielnie
   i nie zmieniaj ich po podglądzie.
6. Każdy `409` oznacza zmianę reguł, treści, przypisania lub dopasowania między
   podglądem a wykonaniem. Wygeneruj nowy podgląd; nigdy nie ponawiaj starego.

Masowa operacja służy wyłącznie do przypisania osób. Zgodnie z
`reviewPolicy: bulk_assignment_never_confirms_review` nie może potwierdzić
weryfikacji merytorycznej ani utworzyć `verifiedAt`. Takie potwierdzenie zawsze
pozostaje osobną czynnością człowieka na konkretnej wersji treści.

## Bramka pochodzenia danych

Każda wartość faktograficzna musi wskazywać jedno z dozwolonych źródeł:

- zatwierdzony brief projektu;
- opublikowana treść lub profil w tym samym serwisie;
- źródło wskazane przez użytkownika, wraz z jego adresem;
- wynik jawnie udokumentowanej weryfikacji redakcyjnej.

Nie twórz autora, recenzenta, roli, biografii, doświadczenia, profilu,
`sameAs`, daty publikacji/modyfikacji/weryfikacji, źródła ani odpowiedzi
faktograficznej z nazwy firmy, etykiety zespołu, slugu, snippetu wyszukiwarki,
zrzutu ekranu lub prawdopodobnego kontekstu. Gdy dowodu brakuje, pomiń wartość
albo cały widget i wpisz brak w raporcie. Nigdy nie zostawiaj tekstów
placeholderów dostarczanych przez domyślne propsy widgetu.

## Dobór widgetu

### `QuickAnswer`

Użyj na początku treści, gdy brief zawiera jedno konkretne pytanie i krótką,
bezpośrednią odpowiedź. `question` ma odzwierciedlać rzeczywiste pytanie,
`answer` ma być zrozumiałe bez sąsiedniego akapitu, a `headingLevel` ma
kontynuować hierarchię strony (`h2`–`h6`; widget nigdy nie zastępuje H1).

`sourceLabel` i `sourceUrl` dodaj wyłącznie dla źródła, które faktycznie
uzasadnia odpowiedź. Brak adresu nie uprawnia do wymyślenia linku. Dłuższe
uzasadnienie pozostaje w widocznej treści strony; szybka odpowiedź nie może
ukrywać zastrzeżeń ani zmieniać znaczenia briefu.

### `PostInfo`

Umieść przy tytule lub na początku artykułu. Daty mają format `YYYY-MM-DD` i
oznaczają różne zdarzenia:

- `publishedDate` — rzeczywista data pierwszej publikacji;
- `modifiedDate` — data istotnej zmiany treści, nie technicznego zapisu;
- `verifiedDate` — data rzeczywistej weryfikacji merytorycznej.

Nie ustawiaj `verifiedDate` tylko dlatego, że agent zbudował lub zapisał stronę.
`authorName` i `reviewerName` muszą odpowiadać profilom zwróconym przez zasób
redakcyjny, jeżeli jest dostępny; organizacja nie jest osobą zastępczą.
`authorUrl`, `reviewerUrl`, `categoryUrl` i adresy
tagów wskazują wyłącznie istniejące, zatwierdzone zasoby. Utrzymuj zgodność
nazwy i adresu autora z `AuthorBox`. Czas czytania podaj tylko wtedy, gdy brief
go dostarcza albo projekt ma jawnie zatwierdzoną metodę obliczania.

### `AuthorBox`

Użyj dla publicznie zatwierdzonego eksperta. `name`, `role`, `biography` i
`expertise` muszą odpowiadać profilowi lub briefowi. Jeżeli `image` jest
ustawione, `imageAlt` opisuje osobę; pusty tekst alternatywny jest błędem
dostępności. `profileUrl` prowadzi do istniejącego profilu autora.

Lista `sameAs` zawiera tylko bezpośrednio zweryfikowane publiczne profile osoby
i ich pełne adresy HTTPS. Nie dodawaj wyników wyszukiwania, profilu firmy ani
profilu innej osoby. Brak potwierdzonej osoby oznacza brak `AuthorBox`; nie
twórz encji `Person` z nazwy działu lub organizacji.

### `Sources`

Umieść po treści, której źródła dotyczą. Każdy element zachowuje tytuł,
faktyczny adres, wydawcę i — jeżeli została zarejestrowana — datę dostępu w
formacie `YYYY-MM-DD`. `primary: true` oznacza materiał pierwotny, a nie źródło
uznane intuicyjnie za najważniejsze. Usuń duplikaty, zachowując kolejność
cytowania lub kolejność zatwierdzoną w briefie.

Nie wpisuj źródła, którego treści nie użyto. Nie przepisuj tekstu źródła do
layoutu ponad zakres potrzebny do własnej, zatwierdzonej treści. Ustawienie
`openInNewTab` jest decyzją projektu; gdy jest aktywne, renderer sam odpowiada
za bezpieczne `rel`.

## Bezpieczeństwo i zgodność kontraktu

- Adresy i daty wysyłaj dokładnie w kształcie dopuszczonym przez kontrolki
  żywego kontraktu. To, że renderer potrafi pokazać tekst po odrzuceniu adresu,
  nie jest zgodą na zapisanie wadliwego URL.
- Nie wkładaj raw HTML, JSON-LD ani atrybutów ARIA do propsów treści. Semantykę
  `<aside>`, `<time>`, `<cite>`, nagłówków i bezpiecznych linków zapewnia widget.
- `sameAs` wymaga publicznego adresu HTTP(S); linki profilu i źródła również
  muszą przejść kontrolę kontraktu. Nigdy nie obchodź walidacji schematu.
- Daty muszą być prawdziwymi datami gregoriańskimi. Odrzuć między innymi
  `2026-02-30`, nawet jeżeli tekst pasuje do wzorca `YYYY-MM-DD`.
- Zachowaj widoczną treść i źródła w HTML serwerowym. Nie przenoś istotnych
  informacji wyłącznie do JavaScriptu, atrybutu lub danych strukturalnych.

## Kontrola przed walidacją

Przed `POST /wp-json/monteby/v1/validate` sprawdź:

1. Każdy z czterech widgetów istnieje w żywym `components` i jego propsy
   odpowiadają aktualnym kontrolkom.
2. W żadnym polu nie pozostał tekst domyślny typu „Author name”, „Source title”
   ani przykładowa szybka odpowiedź.
3. Każdy autor, recenzent, profil, data i źródło ma odnotowane pochodzenie.
4. Każde ustawione zdjęcie autora ma niepusty `imageAlt`.
5. Hierarchia `QuickAnswer.headingLevel` i `Sources.headingLevel` nie przeskakuje
   poziomów i strona nadal ma dokładnie jedno właściwe H1.
6. Daty istnieją w kalendarzu, a adresy są pełne lub względne tylko tam, gdzie
   pozwala na to żywa kontrolka.
7. Źródła są unikalne, rzeczywiście użyte i mają poprawnie uzasadnione
   oznaczenie `primary`.

W raporcie końcowym wymień użyte widgety, identyfikatory zatwierdzonych profili,
status i odcisk weryfikacji, pochodzenie danych autora/recenzenta, daty
weryfikacji, liczbę źródeł oraz każde celowo pominięte pole wraz z powodem.
