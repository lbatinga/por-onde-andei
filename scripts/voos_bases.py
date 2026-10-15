"""Gera aerolinhas.json e aeronaves.json para o diário de voos (OpenFlights, dados abertos).

aerolinhas.json: {IATA: nome}. O OpenFlights repete códigos e tem nomes antigos (TAM, LAN),
então os nomes atuais das principais vêm de ATUAIS. É só para o autocompletar: o nome que a
AeroDataBox devolve na busca do voo tem prioridade e fica salvo no próprio voo.
aeronaves.json: [[nome, IATA, ICAO]] dos modelos de avião.
cias-historico.json: {IATA: [{q, n, i, f, l: [[arquivo, de, até]]}]} do Wikidata. Serve para saber
qual empresa usava o código na data do voo (códigos são reaproveitados: RG foi da Varig e hoje é
de outra) e qual logo ela tinha na época (arquivos do Wikimedia Commons, com datas quando houver).
"""
import csv, io, json, sys
from urllib.parse import unquote
import requests

SPARQL = """
SELECT ?a ?c ?cs ?ce ?nome ?inicio ?fim ?logo ?ls ?le WHERE {
  ?a p:P229 ?st . ?st ps:P229 ?c . FILTER(STRLEN(?c) = 2)
  OPTIONAL { ?st pq:P580 ?cs } OPTIONAL { ?st pq:P582 ?ce }
  OPTIONAL { ?a wdt:P571 ?inicio } OPTIONAL { ?a wdt:P576 ?fim }
  OPTIONAL { ?a p:P154 ?sl . ?sl ps:P154 ?logo . OPTIONAL { ?sl pq:P580 ?ls } OPTIONAL { ?sl pq:P582 ?le } }
  OPTIONAL { ?a rdfs:label ?pt . FILTER(LANG(?pt) = "pt") } OPTIONAL { ?a rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?pt, ?en) AS ?nome)
}"""


def historico():
    r = requests.get("https://query.wikidata.org/sparql", params={"query": SPARQL, "format": "json"},
                     headers={"User-Agent": "PorOndeAndei/1.0 (github.com/lbatinga/por-onde-andei)"}, timeout=180)
    r.raise_for_status()
    d = lambda b, k: (b.get(k, {}).get("value") or "")[:10] or None
    ents = {}
    for b in r.json()["results"]["bindings"]:
        q = b["a"]["value"].rsplit("/", 1)[1]; c = b["c"]["value"].upper()
        e = ents.setdefault((c, q), {"q": q, "n": b.get("nome", {}).get("value") or q, "i": None, "f": None, "l": []})
        # datas do código (quando a empresa usou o código) valem mais que fundação e encerramento
        e["i"] = d(b, "cs") or e["i"] or d(b, "inicio")
        e["f"] = d(b, "ce") or e["f"] or d(b, "fim")
        if "logo" in b:
            l = [unquote(b["logo"]["value"].rsplit("/", 1)[1]), d(b, "ls"), d(b, "le")]
            if l not in e["l"]: e["l"].append(l)
    out = {}
    for (c, _), e in sorted(ents.items()):
        if not e["l"]: del e["l"]
        out.setdefault(c, []).append({k: v for k, v in e.items() if v})
    return out

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
    try:
        h = historico()
        if sum(len(v) for v in h.values()) < 1000:
            raise RuntimeError(f"histórico incompleto: {len(h)} códigos")
        json.dump(h, open("cias-historico.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("Histórico de companhias", len(h), "códigos", sum(len(v) for v in h.values()), "empresas", file=sys.stderr)
    except Exception as e:  # sem o histórico, o app usa o logo atual pelo código
        print("Histórico de companhias FALHOU:", e, file=sys.stderr)


if __name__ == "__main__":
    main()
