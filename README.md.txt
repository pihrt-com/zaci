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