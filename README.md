Stavová logika (shrnutí)
status	barva	text
present	zelená	jméno + čas
absent	červená	jméno
holiday	šedá	SVÁTEK
empty	šedá	NEOBSAZENO


dochazka/
│
├── backend/
│   ├── main.py
│   └── data.py
│
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js

PŘEDPOKLAD: EXCEL
Předpokládaná struktura Excelu (např. rozvrh.xlsx):

A (1)	B (2)	C (3)	...	J (10)
Po	Jan Novák	Petr Svoboda		
Út	…	…		
St	…	…		
Čt	…	…		
Pá	…	…		

prázdná buňka → empty
speciální text „SVÁTEK“ (nebo celý den) → holiday

## Živá data a cache

Veřejné UI načítá `https://zaci.pihrt.com/data/status.json` každé 2 sekundy.
Každý požadavek obsahuje jedinečný parametr `_`, aby CDN nebo prohlížeč
nepoužily předchozí odpověď. Soubor `data/.htaccess` nastavuje na samotný
`status.json` hlavičky `Cache-Control: no-store`, `Pragma: no-cache` a
`Expires: 0`.

V administraci WEDOS Global Protection je vhodné zároveň přidat CDN cache
výjimku pro `/data/status.json` a po nasazení provést purge cache.

Pokud se v UI zobrazí upozornění „DATA NEAKTUALIZOVÁNA“, zkontrolujte nejdříve
hodnotu `generated_at` v JSONu a odpovědní HTTP hlavičky na veřejné adrese.
