# Docházka žáků

Docházka žáků je malý systém pro živé zobrazení obsazení deseti míst. Raspberry Pi načítá rozvrh z Excelu, pravidelně se dotazuje Arduina s RFID čtečkou, sestaví aktuální stav a odesílá jej na veřejný web. Webový panel pak zobrazuje jména, příchody, nedostupnost čtečky a stav aktuálnosti dat.

## Jak systém pracuje

1. `backend/excel_loader.py` otevře `backend/data/rozvrh.xlsx`, vybere list `L` pro lichý nebo `S` pro sudý ISO týden a načte řádek aktuálního pracovního dne (`Po` až `Pá`).
2. Sloupce B až K určují deset zobrazovaných míst. Prázdná buňka znamená neobsazené místo, hodnota `SVÁTEK` zobrazuje svátek a ostatní hodnoty představují jméno žáka, který je pro daný den očekáván.
3. `backend/arduino.py` se každé dvě sekundy dotáže Arduina na sériovém portu `/dev/ttyACM0`. Arduino vrací řetězec přesně deseti znaků `0` a `1`, jeden znak pro každé místo.
4. `backend/state.py` spojí rozvrh se stavem Arduina. Při prvním zjištění hodnoty `1` pro očekávaného žáka uloží okamžik příchodu a stav drží do denního resetu.
5. `backend/main.py` poskytuje lokální JSON endpoint `/status`, každých pět sekund odesílá stejný stav na veřejný endpoint a každé dvě sekundy kontroluje dostupnost Arduina.
6. Veřejný `update.php` ověří příchozí požadavek, doplní `generated_at` a zapíše `data/status.json`. Hodnoty přístupové konfigurace zůstávají výhradně v nasazení a nikdy nepatří do dokumentace ani repozitáře.
7. Webový panel načítá veřejný JSON každé dvě sekundy, vykreslí deset polí v pevně daném pořadí a při změně přítomnosti použije krátkou animaci.

## Stavy míst

| Stav | Zobrazení | Význam |
| --- | --- | --- |
| `present` | zelené pole, jméno a čas | Očekávaný žák byl rozpoznán čtečkou. |
| `absent` | červené pole a jméno | Žák je podle rozvrhu očekáván, ale nebyl rozpoznán. |
| `holiday` | šedé pole `SVÁTEK` | V rozvrhu je pro místo zapsáno `SVÁTEK`. |
| `empty` | šedé pole `NEOBSAZENO` | Místo není pro daný den obsazené nebo je víkend. |

## Struktura repozitáře

```text
backend/
  arduino.py          komunikace s Arduino RFID čtečkou
  excel_loader.py     načtení rozvrhu z Excelu
  state.py            spojení rozvrhu a docházky
  main.py             FastAPI služba, lokální API a odesílání na web
  dochazka.service    definice systemd služby pro Raspberry Pi
  data/rozvrh.xlsx    zdrojový rozvrh
  static/             lokální varianta webového panelu
remote www/
  index.html          veřejný panel
  app.js              načítání a vykreslení živého stavu
  style.css           vzhled panelu
  update.php          ověřený příjem dat z Raspberry Pi
  data/status.json    poslední veřejně zobrazený stav, přepisovaný aplikací
```

## Raspberry Pi

Backend běží z adresáře `/home/pi/dochazka/backend` jako systemd služba `dochazka`. Definice služby používá virtuální prostředí `venv` a spouští Uvicorn na portu 8000.

```bash
sudo systemctl status dochazka --no-pager
sudo systemctl restart dochazka
curl -sS -D - -o /dev/null http://127.0.0.1:8000/status
```

Endpoint `/status` odpovídá JSONem obsahujícím objekt `arduino` a pole `boxes`. Odpověď má anti-cache hlavičky, aby lokální panel neviděl starší stav.

```json
{
  "arduino": {"online": true, "last_seen": "YYYY-MM-DD HH:MM:SS"},
  "boxes": [{"name": "Jméno", "status": "present", "time": "DD.MM.YYYY HH:MM"}]
}
```

## Veřejný web

Do dokumentového kořene `zaci.pihrt.com` patří obsah adresáře `remote www/`. Soubor `data/status.json` se nenahrává ručně, protože jej průběžně přepisuje `update.php` daty z Raspberry Pi.

Panel na `zaci.pihrt.com` přidává ke každému požadavku na `data/status.json` jedinečný parametr `_`. Tím se každé načtení odliší od předchozího a CDN ani prohlížeč nemají důvod použít starší odpověď. V administraci WEDOS Global Protection přidejte výjimku CDN cache pro cestu `/data/status.json` a po změně konfigurace proveďte purge cache. Pokud se na hostingu objeví chyba o nemožnosti číst `.htaccess`, nepoužívejte pro tento projekt `.htaccess` v adresáři `data`; nastavte výjimku přímo v CDN.

## Nasazení změn

Na Raspberry Pi se při změně backendu obvykle nahrazují pouze `backend/main.py` a `backend/static/app.js`, následně se restartuje služba `dochazka`. Na veřejný web se nahrávají změněné soubory z `remote www/`; nikdy se nenahrávají ani nevypisují přístupové hodnoty pro odesílání dat.

## Diagnostika

Pokud panel hlásí neaktuální data, ověřte nejdříve lokální API na Raspberry Pi, potom hodnotu `generated_at` na veřejném JSONu a nakonec HTTP hlavičky veřejné odpovědi.

```bash
curl -sS http://127.0.0.1:8000/status
curl -sS "https://zaci.pihrt.com/data/status.json?check=$(date +%s)"
curl -sS -D - -o /dev/null "https://zaci.pihrt.com/data/status.json?check=$(date +%s)"
```

Při selhání Arduina se v panelu zobrazí upozornění na nedostupnou RFID čtečku. Při chybě veřejného přenosu zkontrolujte log `backend/logs/dochazka.log`, dostupnost webu a konfiguraci nasazení; citlivé hodnoty do logu ani do issue nevkládejte.
