"""Gera aerolinhas.json e aeronaves.json para o diário de voos (OpenFlights, dados abertos).

aerolinhas.json: {IATA: nome}. O OpenFlights repete códigos e tem nomes antigos (TAM, LAN),
então os nomes atuais das principais vêm de ATUAIS. É só para o autocompletar: o nome que a
AeroDataBox devolve na busca do voo tem prioridade e fica salvo no próprio voo.
aeronaves.json: [[nome, IATA, ICAO]] dos modelos de avião.
"""
import csv, io, json, sys
import requests

BASE = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/"
ATUAIS = {"G3": "GOL", "AD": "Azul", "JJ": "LATAM Brasil", "LA": "LATAM", "4M": "LATAM Argentina", "XL": "LATAM Equador",
          "LP": "LATAM Peru", "4C": "LATAM Colômbia", "2Z": "Voepass", "AR": "Aerolíneas Argentinas", "TP": "TAP Air Portugal",
          "AV": "Avianca", "CM": "Copa Airlines", "H2": "Sky Airline", "JA": "JetSMART", "FO": "Flybondi", "AA": "American Airlines",
          "UA": "United Airlines", "DL": "Delta Air Lines", "AF": "Air France", "KL": "KLM", "IB": "Iberia", "UX": "Air Europa",
          "LH": "Lufthansa", "BA": "British Airways", "EK": "Emirates", "QR": "Qatar Airways", "TK": "Turkish Airlines",
          "AZ": "ITA Airways", "ET": "Ethiopian Airlines", "MS": "EgyptAir", "AM": "Aeroméxico", "AC": "Air Canada"}


def main():
    linhas = csv.reader(io.StringIO(requests.get(BASE + "airlines.dat", timeout=60).text))
    cias = {}
    for r in linhas:
        if len(r) < 8 or r[3] in ("", "\\N", "-") or len(r[3]) != 2 or r[7] != "Y":
            continue
        cias.setdefault(r[3], r[1])
    cias.update(ATUAIS)
    planes = csv.reader(io.StringIO(requests.get(BASE + "planes.dat", timeout=60).text))
    avioes = [[r[0], r[1] if r[1] != "\\N" else "", r[2] if r[2] != "\\N" else ""] for r in planes if len(r) >= 3]
    if len(cias) < 500 or len(avioes) < 150:
        raise SystemExit(f"OpenFlights veio incompleto: {len(cias)} cias, {len(avioes)} aviões")
    json.dump(dict(sorted(cias.items())), open("aerolinhas.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(avioes, open("aeronaves.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("Companhias", len(cias), "aviões", len(avioes), file=sys.stderr)


if __name__ == "__main__":
    main()
