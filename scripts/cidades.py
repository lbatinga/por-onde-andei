"""Gera cidades-pop.json para o app Por Onde Andei.

Brasil: estimativa oficial da população do IBGE (agregado 6579, variável 9324), último ano,
para todos os 5.570 municípios.
Fora do Brasil: GeoNames (cities15000: cidades com 15 mil habitantes ou mais). Serve só para
o porte e a população aproximada — o GeoNames junta censos de cada país e às vezes usa a
região metropolitana, por isso o app não faz ranking com ele.
"""
import csv, io, json, sys, zipfile
import requests

UA = {"User-Agent": "PorOndeAndei/1.0 (https://github.com/lbatinga/por-onde-andei)"}
IBGE = "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[all]"
GEONAMES = "https://download.geonames.org/export/dump/cities15000.zip"


def brasil():
    r = requests.get(IBGE, headers=UA, timeout=300)
    r.raise_for_status()
    pop, ano = {}, None
    for serie in r.json()[0]["resultados"][0]["series"]:
        (a, v), = serie["serie"].items()
        if v and v.isdigit():
            pop[serie["localidade"]["id"]] = int(v)
            ano = int(a)
    if len(pop) < 5000:
        raise SystemExit(f"IBGE veio incompleto: {len(pop)} municípios")
    print("IBGE ano", ano, "municípios", len(pop), file=sys.stderr)
    return ano, pop


def mundo():
    r = requests.get(GEONAMES, headers=UA, timeout=300)
    r.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(r.content))
    texto = z.read("cities15000.txt").decode("utf-8")
    lista = []
    for row in csv.reader(io.StringIO(texto), delimiter="\t", quoting=csv.QUOTE_NONE):
        # 1 name, 2 asciiname, 4 lat, 5 lon, 7 feature code, 8 country, 14 population
        if len(row) < 15 or row[8] == "BR" or not row[14].isdigit():
            continue
        pop = int(row[14])
        if pop < 15000 or row[7] in ("PPLX", "PPLH", "PPLW", "PPLQ"):   # bairros, históricos, destruídos
            continue
        lista.append([round(float(row[4]), 3), round(float(row[5]), 3), pop, row[8], row[2]])
    print("GeoNames cidades", len(lista), file=sys.stderr)
    return lista


def main():
    ano, pop = brasil()
    saida = {
        "brasil": {"ano": ano, "fonte": "IBGE, estimativa da população", "pop": pop},
        "mundo": {"fonte": "GeoNames (cidades com 15 mil habitantes ou mais)", "lista": mundo()},
    }
    with open("cidades-pop.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print("ok cidades", file=sys.stderr)


if __name__ == "__main__":
    main()
