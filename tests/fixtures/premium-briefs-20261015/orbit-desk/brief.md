# Orbit Desk — surowy brief QA

To fikcyjny produkt demonstracyjny, nie działająca aplikacja ani oferta sprzedaży. Cała treść poniżej jest wymyślonym materiałem QA. Nie dopisuj klientów, opinii, statystyk, cen, integracji ani obietnic bezpieczeństwa.

## Cel i odbiorca

Jednostronicowa prezentacja koncepcji narzędzia porządkującego pracę małych zespołów. Odbiorca powinien zrozumieć trzy sytuacje użycia i samodzielnie przejrzeć prezentację. Kierunek przejrzysty i produktowy, z wyraźnym kontrastem hierarchii. Ważniejszy czytelny pokaz działania niż dekoracje. Prezentacja ma być manualnym sliderem: jawne przyciski poprzedni/następny, bez autoplay, przechwytywania przewijania i zależności od najechania myszką. Przy reduced-motion przejścia statyczne, a bez JS treść nadal dostępna. Nie twórz fałszywych zrzutów działającej aplikacji; treściowy pokaz koncepcji jest wystarczający.

## Dokładna treść demonstracyjna

Marka: Orbit Desk

Etykieta menu: Poznaj koncepcję

Nawigacja: Możliwości → #mozliwosci; Pokaz → #pokaz; Następny krok → #dalej

Oznaczenie otwarcia: KONCEPCJA PRODUKTU · DEMO QA

Tytuł strony: Mniej szukania. Więcej wspólnego obrazu pracy.

Wprowadzenie: Orbit Desk to fikcyjna koncepcja miejsca na zadania, ustalenia i spokojny przegląd dnia. Pokazujemy pomysł na organizację pracy — bez sugerowania, że aplikacja jest już dostępna.

Główna akcja: Obejrzyj pokaz → #pokaz

Tytuł możliwości: Każda informacja ma swoje miejsce.

Wprowadzenie do możliwości: Trzy obszary porządkują koncepcję. Nie są listą funkcji wdrożonego produktu.

- Plan — Zobacz, nad czym pracuje zespół i co wymaga decyzji, bez przeskakiwania między długimi listami.
- Kontekst — Zapisz ustalenie obok zadania, którego dotyczy, żeby kolejna osoba mogła zrozumieć powód zmiany.
- Przegląd — Oddziel rzeczy gotowe, bieżące i oczekujące. Wybierz, czym zajmiesz się w następnym kroku.

Tytuł pokazu: Przejdź przez dzień po swojemu.

Wprowadzenie do pokazu: Zmień slajd przyciskiem. Pokaz nie uruchamia się sam i nie wysyła żadnych danych.

- Początek dnia — Zbierz sprawy wymagające uwagi i wybierz tę, od której chcesz zacząć.
- Wspólna decyzja — Dopisz kontekst do zadania i zaznacz, które ustalenie czeka na odpowiedź zespołu.
- Zamknięcie pętli — Podsumuj wykonane kroki i zostaw krótką wskazówkę dla osoby, która wróci do tematu.

Tytuł zakończenia: Najpierw jasny problem. Potem narzędzie.

Tekst zakończenia: Zastanów się, gdzie dziś giną informacje w Twoim zespole. Ten prototyp służy rozmowie o potrzebach, nie rejestracji konta.

Akcja końcowa: Wróć do pokazu → #pokaz

Opis stopki: Porządek pracy jako punkt wyjścia do rozmowy.

Nota stopki: Fikcyjna koncepcja produktu. Brak rejestracji, płatności i integracji z zewnętrznymi usługami.

Link stopki: Na początek → #start

## Granice i odbiór

Pełna strona, około czterech–sześciu głównych pasm oraz niezbędna lokalna nawigacja i stopka; brak istniejących globalnych szablonów tego projektu. Nie skracaj treści, aby wymusić limit pasm. Nie dodawaj formularza ani działania CTA poza kotwicami. Na telefonie pokaz nie może ukrywać sterowania ani wymagać gestu przesunięcia. Testy obejmą klawiaturę, focus, reduced-motion i brak JS. Jeśli katalog nie ma treściowego slidera, zgłoś lukę — nie zastępuj go karuzelą fałszywych opinii ani zdjęć.
