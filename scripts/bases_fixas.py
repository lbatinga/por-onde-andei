"""Atualiza as listas de apoio do app Por Onde Andei.

aeroportos.json: aeroportos grandes e médios com voo comercial regular e código IATA (OurAirports).
  Mantém os nomes em português já existentes; aeroporto novo ganha o nome em português pela
  Wikidata (rótulo pt), ou o do OurAirports se a Wikidata não tiver. Quem perdeu o voo regular sai.
municipios-br.json: municípios do IBGE [código, nome, UF, lat, lon]. Atualiza nomes; município novo
  ganha a posição pelo centro da malha do IBGE.
"""
import csv, io, json, sys
import requests

UA = {"User-Agent": "PorOndeAndei/1.0 (https://github.com/lbatinga/por-onde-andei)"}
OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"
IBGE_MUN = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
IBGE_MALHA = "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{cod}?formato=application/vnd.geo+json"
WIKIDATA = "https://query.wikidata.org/sparql"


def nomes_pt(iatas):
    """IATA -> (nome em português, cidade em português) pela Wikidata."""
    if not iatas:
        return {}
    valores = " ".join(f'"{c}"' for c in iatas)
    q = f"""SELECT ?iata ?nome ?cidade WHERE {{
      VALUES ?iata {{ {valores} }}
      ?a wdt:P238 ?iata .
      OPTIONAL {{ ?a rdfs:label ?nome FILTER(lang(?nome) IN ("pt", "pt-br")) }}
      OPTIONAL {{ ?a wdt:P931 ?c . ?c rdfs:label ?cidade FILTER(lang(?cidade) = "pt") }}
    }}"""
    r = requests.get(WIKIDATA, params={"query": q, "format": "json"}, headers=UA, timeout=120)
    r.raise_for_status()
    out = {}
    for b in r.json()["results"]["bindings"]:
        i = b["iata"]["value"]
        nome, cid = b.get("nome", {}).get("value"), b.get("cidade", {}).get("value")
        a = out.setdefault(i, [None, None])
        a[0] = a[0] or nome
        a[1] = a[1] or cid
    return out


def aeroportos():
    r = requests.get(OURAIRPORTS, headers=UA, timeout=120)
    r.raise_for_status()
    cand = [x for x in csv.DictReader(io.StringIO(r.text))
            if x["iata_code"] and x["scheduled_service"] == "yes" and x["type"] in ("large_airport", "medium_airport")]
    if len(cand) < 2500:
        raise SystemExit(f"OurAirports veio incompleto: {len(cand)}")
    atual = {x[0]: x for x in json.load(open("aeroportos.json", encoding="utf-8"))}
    novos = [x["iata_code"] for x in cand if x["iata_code"] not in atual]
    pt = {}
    try:
        pt = nomes_pt(novos)
    except Exception as e:
        print("Wikidata falhou (fica o nome do OurAirports):", e, file=sys.stderr)
    saida = []
    for x in cand:
        i = x["iata_code"]
        nome, cidade = (atual[i][1], atual[i][5]) if i in atual else (
            (pt.get(i) or [None, None])[0] or x["name"], (pt.get(i) or [None, None])[1] or x["municipality"])
        saida.append([i, nome, round(float(x["latitude_deg"]), 4), round(float(x["longitude_deg"]), 4),
                      x["iso_country"], cidade, 1 if x["type"] == "large_airport" else 0])
    saida.sort(key=lambda a: a[0])
    sairam = sorted(set(atual) - {a[0] for a in saida})
    print("Aeroportos", len(saida), "novos", novos, "saíram", sairam, file=sys.stderr)
    with open("aeroportos.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))


def centro(geo):
    """Centro aproximado (média dos vértices do maior anel) de um GeoJSON do IBGE."""
    pts = []
    for feat in geo.get("features", [geo]):
        g = feat.get("geometry", feat)
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        anel = max((p[0] for p in polys), key=len)
        pts.extend(anel)
    return round(sum(p[1] for p in pts) / len(pts), 4), round(sum(p[0] for p in pts) / len(pts), 4)


def municipios():
    r = requests.get(IBGE_MUN, headers=UA, timeout=120)
    r.raise_for_status()
    ibge = r.json()
    if len(ibge) < 5500:
        raise SystemExit(f"IBGE veio incompleto: {len(ibge)}")
    atual = {str(x[0]): x for x in json.load(open("municipios-br.json", encoding="utf-8"))}
    saida, novos, renomeados = [], [], []
    for m in ibge:
        cod = str(m["id"])
        uf = m["microrregiao"]["mesorregiao"]["UF"]["sigla"] if m.get("microrregiao") else m["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"]
        if cod in atual:
            x = list(atual[cod])
            if x[1] != m["nome"]:
                renomeados.append((x[1], m["nome"]))
                x[1] = m["nome"]
            saida.append(x)
        else:
            g = requests.get(IBGE_MALHA.format(cod=cod), headers=UA, timeout=60).json()
            lat, lon = centro(g)
            saida.append([int(cod), m["nome"], uf, lat, lon])
            novos.append(m["nome"])
    # trava de segurança: mudança grande demais é sinal de dado errado, não de realidade
    if len(renomeados) > 20 or len(novos) > 20:
        raise SystemExit(f"mudança suspeita: {len(renomeados)} renomeados, {len(novos)} novos — nada gravado")
    vistos = {str(x[0]) for x in saida}
    saida += [list(x) for c, x in atual.items() if c not in vistos]   # nunca apaga município
    saida.sort(key=lambda x: x[1])
    print("Municípios", len(saida), "novos", novos, "renomeados", renomeados, file=sys.stderr)
    with open("municipios-br.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    for fn in (aeroportos, municipios):
        try:
            fn()
        except Exception as e:  # uma falhar não impede a outra
            print(fn.__name__, "falhou:", e, file=sys.stderr)
