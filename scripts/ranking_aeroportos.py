"""Gera ranking-aeroportos.json para o app Por Onde Andei.

Brasil: dados abertos da ANAC (Dados Estatísticos do Transporte Aéreo), soma de
passageiros (pagos + grátis) embarcados e desembarcados em cada aeroporto brasileiro
no último ano completo.
Mundo: top 50 do ranking do ACI World, como publicado na Wikipedia
("List of busiest airports by passenger traffic"), ano mais recente.
"""
import csv, io, json, re, sys, datetime, collections
import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "PorOndeAndei/1.0 (https://github.com/lbatinga/por-onde-andei)"}
ANAC = "https://sistemas.anac.gov.br/dadosabertos/Voos%20e%20opera%C3%A7%C3%B5es%20a%C3%A9reas/Dados%20Estat%C3%ADsticos%20do%20Transporte%20A%C3%A9reo/Dados_Estatisticos.csv"
OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"
WIKI = "https://en.wikipedia.org/api/rest_v1/page/html/List_of_busiest_airports_by_passenger_traffic"


def num(s):
    s = (s or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def brasil():
    pax = collections.defaultdict(float)          # (ano, icao) -> passageiros
    meses = collections.defaultdict(set)          # ano -> meses com dado
    nomes = {}
    with requests.get(ANAC, headers=UA, stream=True, timeout=600) as r:
        r.raise_for_status()
        linhas = (l.decode("utf-8-sig", "replace") for l in r.iter_lines())
        atualizado = next(linhas)                 # "Atualizado em: AAAA-MM-DD"
        leitor = csv.DictReader(linhas, delimiter=";")
        for row in leitor:
            ano, mes = row["ANO"], row["MES"]
            p = num(row["PASSAGEIROS_PAGOS"]) + num(row["PASSAGEIROS_GRATIS"])
            if not ano or not p:
                continue
            meses[ano].add(mes)
            for lado in ("ORIGEM", "DESTINO"):
                if row[f"AEROPORTO_DE_{lado}_PAIS"] == "BRASIL" and row[f"AEROPORTO_DE_{lado}_SIGLA"]:
                    icao = row[f"AEROPORTO_DE_{lado}_SIGLA"]
                    pax[(ano, icao)] += p
                    nomes[icao] = row[f"AEROPORTO_DE_{lado}_NOME"]
    completos = sorted(a for a, ms in meses.items() if len(ms) == 12)
    ano = completos[-1]
    lista = sorted(((icao, v) for (a, icao), v in pax.items() if a == ano), key=lambda x: -x[1])
    print("ANAC", atualizado, "ano", ano, "aeroportos", len(lista), file=sys.stderr)
    return ano, atualizado.replace("Atualizado em:", "").strip(), lista, nomes


def iata_por_icao():
    r = requests.get(OURAIRPORTS, headers=UA, timeout=120)
    r.raise_for_status()
    m = {}
    for row in csv.DictReader(io.StringIO(r.text)):
        if row["iata_code"]:
            for k in ("icao_code", "gps_code", "ident"):
                if row.get(k):
                    m.setdefault(row[k], row["iata_code"])
    return m


def mundo():
    r = requests.get(WIKI, headers=UA, timeout=120)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")
    for h in sopa.find_all(["h2", "h3"]):
        m = re.search(r"(20\d\d)", h.get_text())
        if not m:
            continue
        tabela = h.find_next("table")
        if not tabela:
            continue
        cab = [th.get_text(" ", strip=True).lower() for th in tabela.find("tr").find_all(["th", "td"])]
        if not any("code" in c for c in cab):
            continue
        i_code = next(i for i, c in enumerate(cab) if "code" in c)
        i_pax = next(i for i, c in enumerate(cab) if "passenger" in c)
        i_nome = next((i for i, c in enumerate(cab) if "airport" in c), 1)
        lista = []
        for sup in tabela.find_all("sup"):     # notas de rodapé [1] grudavam nos números
            sup.decompose()
        for tr in tabela.find_all("tr")[1:]:
            cel = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
            if len(cel) <= max(i_code, i_pax):
                continue
            iata = re.match(r"([A-Z]{3})", cel[i_code])
            if not iata:
                continue
            lista.append({"pos": len(lista) + 1, "iata": iata.group(1), "nome": cel[i_nome],
                          "pax": int(re.sub(r"[^\d]", "", (re.search(r"\d[\d,.\s]*", cel[i_pax]) or [""])[0]) or 0)})
        if len(lista) >= 10:
            print("Wikipedia/ACI ano", m.group(1), "aeroportos", len(lista), file=sys.stderr)
            return int(m.group(1)), lista[:50]
    raise SystemExit("tabela do ranking mundial não encontrada")


def main():
    ano_br, atualizado, lista_br, nomes = brasil()
    iata = iata_por_icao()
    br = [{"pos": i + 1, "icao": icao, "iata": iata.get(icao), "nome": nomes.get(icao, icao).title(), "pax": round(v)}
          for i, (icao, v) in enumerate(lista_br)]
    ano_mundo, lista_mundo = mundo()
    saida = {
        "gerado_em": datetime.date.today().isoformat(),
        "brasil": {"ano": int(ano_br), "fonte": f"ANAC, dados abertos (atualizado em {atualizado})", "lista": br},
        "mundo": {"ano": ano_mundo, "fonte": "ACI World, via Wikipedia", "lista": lista_mundo},
    }
    with open("ranking-aeroportos.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print("ok", len(br), len(lista_mundo), file=sys.stderr)


if __name__ == "__main__":
    main()
