# Treść ekspercka: autor, metadane, szybka odpowiedź i źródła

Ten dokument obowiązuje w każdym trybie, w którym strona zawiera treść
ekspercką. Nie zastępuje żywego kontraktu. Najpierw pobierz
`GET /wp-json/monteby/v1/contract` i sprawdź `components`; właściwości, typy,
limity repeaterów, dozwoleni rodzice i kontrolki z odpowiedzi są jedynym
autorytatywnym schematem.

Jeżeli potrzebnego widgetu nie ma w żywym kontrakcie, nie odtwarzaj go przez
`HtmlBlock`, shortcode, klasę CSS ani child theme. To `blocked_product_gap` i
osobny przebieg przez skill `monteby-widget-development`.

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
`authorName` i `reviewerName` muszą odpowiadać zatwierdzonym osobom; organizacja
nie jest osobą zastępczą. `authorUrl`, `reviewerUrl`, `categoryUrl` i adresy
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

W raporcie końcowym wymień użyte widgety, pochodzenie danych autora/recenzenta,
daty weryfikacji, liczbę źródeł oraz każde celowo pominięte pole wraz z powodem.
