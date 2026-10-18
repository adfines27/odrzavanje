# Elektro održavanje – web verzija (PWA)

Ovo je ista aplikacija kao iOS verzija, ali radi u pregledaču (Safari na iPhone-u, Chrome na Androidu).
Kada se doda na početni ekran, otvara se preko celog ekrana i **radi bez interneta**.
Nema spoljnih biblioteka i nema servera: svi podaci i fotografije ostaju na telefonu.

## 1. Postavljanje na internet (jednom)

Aplikacija mora biti dostupna na **HTTPS** adresi. Bez HTTPS-a iPhone ne dozvoljava rad bez interneta ni kameru.
Na internet se postavlja ceo sadržaj foldera `web/`. Najlakše je besplatno, preko GitHub Pages:

1. Napravite nalog na github.com i novi **javni** repozitorijum, npr. `odrzavanje`.
2. *Add file → Upload files* → prevucite **sadržaj** foldera `web/` (index.html, sw.js, css/, js/, icons/…) → *Commit*.
3. *Settings → Pages → Branch: main, folder: / (root) → Save*.
4. Posle 1–2 minuta aplikacija je na adresi `https://VAŠE-IME.github.io/odrzavanje/`.

Može i bilo koji drugi statički hosting (Netlify, Cloudflare Pages, sopstveni server sa HTTPS-om).
U kodu i fotografijama nema nikakvih podataka sa telefona. Podaci se nikad ne šalju na server.

## 2. Instalacija na iPhone

1. Otvorite adresu u **Safariju** (ne u Chrome-u na iPhone-u).
2. Dodirnite **Deli** (kvadrat sa strelicom) → **Dodaj na početni ekran** → **Dodaj**.
3. Otvorite aplikaciju sa ikonice **jednom dok ste na internetu**. Posle toga radi i bez signala.

> **Važno:** podaci u Safari kartici i u aplikaciji sa početnog ekrana su **odvojeni**.
> Uvek koristite ikonicu sa početnog ekrana.

## 3. Šta je drugačije u odnosu na iOS aplikaciju

| | |
|---|---|
| **Podsetnici** | Web stranica na iPhone-u ne može sama da zakaže obaveštenje u 08:00 bez servera. Zato **Podešavanja → Dodaj rokove u kalendar telefona** pravi kalendarski fajl: kalendar vas podseća u 08:00 na dan roka i dan ranije, i bez interneta. Posle izmene plana izvezite ponovo i obrišite stare događaje. Početna uvek pokazuje šta kasni i šta ističe. |
| **Kamera** | Dugme „Slikaj” otvara sistemsku kameru. Ako se ne otvori: iOS Podešavanja › Safari › Kamera › Dozvoli. |
| **Galerija** | Sistemski izbor fotografija, više odjednom, bez pristupa celoj galeriji. |
| **Podaci** | Čuvaju se na telefonu (IndexedDB). Ako se obrišu podaci Safarija ili se aplikacija ukloni sa početnog ekrana, brišu se i podaci. **Redovno pravite rezervnu kopiju.** |
| **Rezervna kopija** | ZIP (podaci.json, oprema.csv, Fotografije/). Za razliku od iOS verzije, ovde može i da se **vrati**: Podešavanja → Vrati podatke iz rezervne kopije. Tako se podaci prenose i na novi telefon. |
| **PDF** | A4, svaka strana je slika (tekst u PDF-u nije moguće označiti), ali su sva srpska slova ispravna i sve radi bez interneta. |

## 4. Nova verzija aplikacije

Posle izmene fajlova povećajte `VERSION` u `sw.js` (npr. `1.0.1`) i ponovo ih postavite na internet.
Telefon preuzima novu verziju pri sledećem otvaranju sa internetom, a podaci ostaju.

## 5. Probno pokretanje na računaru

```bash
python3 -m http.server 8765 --directory web
```
Zatim otvorite `http://localhost:8765/?dev`. Sa `?dev` se ne koristi keš za rad bez interneta, pa se izmene odmah vide.

## Provereno u pregledaču (mobilni prikaz 375×812)
- Primer podataka: 5 opreme, 7 zadataka (kasni / uskoro / u redu), 3 izveštaja sa fotografijama.
- Novi izveštaj sa 6 fotografija (uspravne i položene), zatim ponovno učitavanje stranice pre čuvanja: nacrt, tekst i sve fotografije su ostali.
- Preventivno + Završen za „Podmazivanje ležajeva” (90 dana): rok je pomeren sa 13.10.2026. na 16.01.2027.
- PDF: 2 strane, „Strana 1 od 2”, fotografije u 2 kolone, bez rotacije i razvlačenja.
- Rezervna kopija ZIP se ispravno čita nazad. CSV uvoz radi sa zarezom i sa tačka-zarezom.
- Sa ugašenim serverom aplikacija se otvara iz keša (rad bez interneta).
- Nije provereno na pravom iPhone-u: kamera, deljenje fajla i dodavanje na početni ekran.
