# Kości – zapis wyników gry w kości

Aplikacja PWA (działa na telefonie, także offline) do zapisywania wyników gry w kości. Czysty HTML/CSS/JavaScript: nie trzeba niczego budować ani instalować.

## Publikacja na GitHub Pages (krok po kroku)

1. Zaloguj się na https://github.com i kliknij **+ → New repository**.
2. Nazwa, np. `kosci`. Widoczność: **Public** (na darmowym koncie GitHub Pages działa tylko dla publicznych repozytoriów). Kliknij **Create repository**.
3. Na stronie nowego repozytorium kliknij link **uploading an existing file**.
4. Przeciągnij **całą zawartość** folderu `kosci` (pliki i foldery `fonts`, `icons`, nie sam folder `kosci`) i kliknij **Commit changes**.
   - Plik `.nojekyll` jest ukryty (zaczyna się od kropki). Jeśli system go nie pokazuje, możesz go pominąć – aplikacja zadziała i bez niego.
5. Wejdź w **Settings → Pages**. W „Build and deployment” wybierz **Source: Deploy from a branch**, gałąź **main**, folder **/ (root)** i kliknij **Save**.
6. Po 1–2 minutach na górze tej strony pojawi się adres aplikacji, np. `https://<twój-login>.github.io/kosci/`.

Sprawdź, czy pliki leżą w głównym katalogu repozytorium: na stronie repo musisz od razu widzieć `index.html`, a nie folder `kosci`.

## Instalacja na telefonie

- **Android (Chrome):** otwórz adres → menu ⋮ → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.
- **iPhone (Safari):** otwórz adres → przycisk Udostępnij → „Do ekranu początkowego”.

Po pierwszym otwarciu aplikacja działa bez internetu.

## Aktualizacja aplikacji

1. Zmień pliki i **podnieś wersję** w `sw.js`:
   ```js
   const CACHE = 'kosci-v7';   // było kosci-v6
   ```
   Bez tego zainstalowane telefony zostaną przy starej wersji.
2. W repozytorium: **Add file → Upload files**, przeciągnij zmienione pliki, **Commit changes**. GitHub Pages opublikuje je w 1–2 minuty.
3. Na telefonie zamknij i otwórz aplikację (czasem dwa razy), żeby wczytała nową wersję.

## Zawartość

| Plik | Do czego służy |
|---|---|
| `index.html` | strona startowa aplikacji |
| `app.js` | cała logika: ekrany, punktacja, zapis danych, statystyki |
| `app.css` | wygląd (kolory i czcionki z makiety „Dices”) |
| `sw.js` | service worker: działanie offline |
| `manifest.webmanifest` | opis aplikacji do instalacji (nazwa, ikony, kolory) |
| `icons/` | ikony aplikacji |
| `fonts/` | czcionki Sora i Inter (licencja OFL w `OFL-*.txt`) |
| `.nojekyll` | wyłącza przetwarzanie plików przez GitHub Pages (Jekyll) |

## Test na komputerze

W folderze aplikacji uruchom `python3 -m http.server 8000` i otwórz http://localhost:8000. Samo dwukrotne kliknięcie w `index.html` nie wystarczy.

## Dane

- Wszystko zapisuje się lokalnie na urządzeniu (localStorage przeglądarki), pod kluczem `kosci.v1`. Nic nie trafia na GitHub ani do internetu.
- **Wyczyszczenie danych przeglądarki / odinstalowanie aplikacji usuwa wszystkie gry i statystyki.**
- Dane nie synchronizują się między urządzeniami. Żeby przenieść je na inny telefon, zapisz kopię w Ustawieniach i wczytaj ją na drugim urządzeniu.
- Regularnie zapisuj kopię danych do pliku – to jedyne zabezpieczenie przed utratą gier.

## Zasady zaimplementowane w aplikacji

- Góra (1–6) wpisywana jako punkty, może być ujemna. Bonus po wypełnieniu całej góry: suma ≥ 9 → +50, 0–8 → 0, < 0 → −50.
- Dół (1P, 2P, T, MS, DS, F, K, P, Sz) odblokowuje się dla wszystkich, gdy każdy gracz ma co najmniej 3 wyniki z góry – wtedy rozwija się sam i zostaje odblokowany do końca gry; na dole nie da się wpisać wartości ujemnej.
- Tabela ma zwijane sekcje „Góra” i „Dół”. Góra zwija się sama po wypełnieniu wszystkich jej pól (pasek „Wszystko wpisane”) i można ją rozwinąć w każdej chwili; po usunięciu wyniku z góry zostaje tak, jak jest.
- „Nie zrobiono” wpisuje 0. Wpisane pole można zmienić albo usunąć („Usuń wynik”, bez pytania) aż do zakończenia gry.
- „Zakończ grę” jest aktywne po wypełnieniu wszystkich pól i pyta o potwierdzenie (po zakończeniu wyników nie można już poprawić); potem pokazuje się ranking (remisy dzielą miejsce).
- Niedokończoną grę można kontynuować z ekranu głównego. Nowa gra przy niedokończonej pyta o jej porzucenie; porzucona gra jest usuwana.
- Nazwy graczy są wymagane i nie mogą się powtarzać w jednej grze (wielkość liter bez znaczenia).
- Statystyki liczone są tylko z zakończonych gier. Zakładka „Porównanie”: liczba zwycięstw wybranych graczy w grach rozegranych dokładnie w tym składzie (remis na 1. miejscu nie jest zwycięstwem).
- Nowa gra startuje z 2 graczami; błędne nazwy pokazują czerwony pasek „Popraw nazwę gracza / nazwy graczy, aby rozpocząć grę”.
- W tabeli gry niewpisane pola, które gracz może już wypełnić, są podświetlone na czerwono.
- Historia gier: zakończone gry od najnowszej, filtr „Szukaj gracza” – wybrani gracze jako „pigułki”, lista pokazuje gry, w których grali wszyscy wybrani, podgląd gry tylko do odczytu. Gracz z najwyższym wynikiem (przy remisie – wszyscy) jest wyróżniony na żółto w liście i w podglądzie.
- Ustawienia (ikona zębatki): miejsce zapisu danych, data ostatniej kopii („brak”, dopóki nie zapiszesz pierwszej), wersja aplikacji, kopia danych.
- Kopia danych to plik `.json` (np. `kosci-kopia-2026-11-01-1823.json`) z graczami i zakończonymi grami, bez gry w toku. Wczytanie kopii pyta o potwierdzenie i **zastępuje** wszystkie dane, także grę w toku. Data ostatniej kopii zmienia się tylko przy zapisie.
