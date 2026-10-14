"""Gera ranking-aeroportos.json para o app Por Onde Andei.

Brasil: dados abertos da ANAC (Dados Estatísticos do Transporte Aéreo), soma de
passageiros (pagos + grátis) embarcados e desembarcados em cada aeroporto brasileiro
no último ano completo.
Argentina: dados abertos da ANAC argentina (pousos e decolagens processados), soma de
passageiros de cada movimento em cada aeroporto argentino no último ano completo — a mesma
métrica do Brasil (embarcados + desembarcados). Códigos ANAC (AER, BAR...) convertidos para
IATA pelo campo local_code do OurAirports.
Mundo: top 50 do ranking do ACI World, como publicado na Wikipedia
("List of busiest airports by passenger traffic"), ano mais recente.
"""
import csv, io, json, re, sys, datetime, collections
import requests
from bs4 import BeautifulSoup
sys.path.insert(0, __import__("os").path.dirname(__file__))
import regioes

UA = {"User-Agent": "PorOndeAndei/1.0 (https://github.com/lbatinga/por-onde-andei)"}
ANAC = "https://sistemas.anac.gov.br/dadosabertos/Voos%20e%20opera%C3%A7%C3%B5es%20a%C3%A9reas/Dados%20Estat%C3%ADsticos%20do%20Transporte%20A%C3%A9reo/Dados_Estatisticos.csv"
OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"
AR_CKAN = "https://datos.transporte.gob.ar/api/3/action/package_show?id=aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac"
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


_OA = None
def ourairports():
    global _OA
    if _OA is None:
        r = requests.get(OURAIRPORTS, headers=UA, timeout=120)
        r.raise_for_status()
        _OA = list(csv.DictReader(io.StringIO(r.text)))
    return _OA


def iata_por_icao():
    m = {}
    for row in ourairports():
        if row["iata_code"]:
            for k in ("icao_code", "gps_code", "ident"):
                if row.get(k):
                    m.setdefault(row[k], row["iata_code"])
    return m


def argentina():
    """Último ano completo da base argentina: {codigo_anac: passageiros}."""
    pacote = requests.get(AR_CKAN, headers=UA, timeout=120).json()["result"]
    anos = []
    for res in pacote["resources"]:
        m = re.search(r"año (20\d\d)", res.get("name", ""))
        if m:
            anos.append((int(m.group(1)), res["url"]))
    for ano, url in sorted(anos, reverse=True):
        pax, meses = collections.defaultdict(float), set()
        with requests.get(url, headers=UA, stream=True, timeout=600) as r:
            r.raise_for_status()
            linhas = (l.decode("utf-8-sig", "replace") for l in r.iter_lines())
            leitor = csv.reader(linhas, delimiter=";")
            cab = next(leitor)
            i_data, i_aero = cab.index("Fecha UTC"), cab.index("Aeropuerto")
            i_pax = next(i for i, c in enumerate(cab) if c.strip() == "Pasajeros")
            for row in leitor:
                if len(row) <= max(i_data, i_aero, i_pax):
                    continue
                d = row[i_data].split("/")
                if len(d) != 3 or d[2] != str(ano):
                    continue
                meses.add(d[1])
                pax[row[i_aero].strip()] += num(row[i_pax])
        if len(meses) == 12:
            print("ANAC Argentina ano", ano, "aeroportos", len(pax), file=sys.stderr)
            return ano, sorted(pax.items(), key=lambda x: -x[1])
        print("ANAC Argentina", ano, "incompleto:", len(meses), "meses", file=sys.stderr)
    raise SystemExit("nenhum ano completo na base argentina")


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


def com_tentativas(fn, n=3):
    """A ANAC às vezes corta o download de 360 MB no meio: tenta de novo."""
    for i in range(n):
        try:
            return fn()
        except (requests.exceptions.RequestException, ValueError) as e:
            print(f"tentativa {i + 1} falhou:", e, file=sys.stderr)
            if i == n - 1:
                raise
            __import__("time").sleep(30)


def main():
    ano_br, atualizado, lista_br, nomes = com_tentativas(brasil)
    iata = iata_por_icao()
    br = [{"pos": i + 1, "icao": icao, "iata": iata.get(icao), "nome": nomes.get(icao, icao).title(), "pax": round(v)}
          for i, (icao, v) in enumerate(lista_br)]
    ano_mundo, lista_mundo = mundo()
    ar = None
    try:
        ano_ar, lista_ar = argentina()
        locais = {row["local_code"]: row for row in ourairports() if row["iso_country"] == "AR" and row["local_code"]}
        ar = {"ano": ano_ar, "fonte": "ANAC Argentina, dados abertos (aterrizajes y despegues)",
              "lista": [{"pos": i + 1, "local": cod, "iata": (locais.get(cod) or {}).get("iata_code") or None,
                         "nome": (locais.get(cod) or {}).get("name", cod), "pax": round(v)}
                        for i, (cod, v) in enumerate(x for x in lista_ar if x[1] > 0)]}
    except Exception as e:  # a base argentina falhar não pode derrubar o resto
        print("Argentina falhou:", e, file=sys.stderr)
        try:
            ar = json.load(open("ranking-aeroportos.json", encoding="utf-8")).get("argentina")
        except Exception:
            pass
    saida = {
        "gerado_em": datetime.date.today().isoformat(),
        "brasil": {"ano": int(ano_br), "fonte": f"ANAC, dados abertos (atualizado em {atualizado})", "lista": br},
        "mundo": {"ano": ano_mundo, "fonte": "ACI World, via Wikipedia", "lista": lista_mundo},
    }
    if ar:
        saida["argentina"] = ar
    anterior = {}
    try:
        anterior = json.load(open("ranking-aeroportos.json", encoding="utf-8"))
    except Exception:
        pass
    # continentes (Wikipedia, a partir do ACI regional e órgãos oficiais) e Europa por país (Eurostat)
    oa = ourairports()
    por_wiki, por_icao, por_iata = regioes.indice_ourairports(oa)
    ano_max = datetime.date.today().year - 1
    try:
        sessao = requests.Session()
        resolve = regioes.wikidata_resolver(sessao, UA)
        cont = {}
        for reg, pagina in regioes.WIKI_REGIOES.items():
            html = sessao.get("https://en.wikipedia.org/api/rest_v1/page/html/" + pagina, headers=UA, timeout=120).text
            ano, lista = regioes.parse_regiao(html, por_wiki, resolve=resolve, ano_max=ano_max)
            print("Continente", reg, ano, len(lista), file=sys.stderr)
            if ano and len(lista) >= 10:
                cont[reg] = {"ano": ano, "fonte": "Wikipedia (ACI e órgãos oficiais)",
                             "lista": [{"pos": i + 1, "iata": iata, "pais": (por_iata.get(iata) or {}).get("iso_country"),
                                        "nome": nome, "pax": pax} for i, (_, iata, nome, pax) in enumerate(lista)]}
        if len(cont) >= 4:
            saida["continentes"] = cont
        else:
            raise RuntimeError(f"só {len(cont)} continentes")
    except Exception as e:
        print("Continentes falharam:", e, file=sys.stderr)
        if anterior.get("continentes"):
            saida["continentes"] = anterior["continentes"]
    try:
        uk = None
        for ano_uk in (ano_max, ano_max - 1):
            r = requests.get(regioes.CAA_PAGINA.format(ano=ano_uk), headers=UA, timeout=60)
            link = r.ok and regioes.link_caa(r.text)
            if link:
                a_uk, lista_uk, sem = regioes.parse_caa(requests.get(link, headers=UA, timeout=60).text)
                if sem:
                    print("CAA sem código IATA:", sem, file=sys.stderr)
                if len(lista_uk) >= 20:
                    uk = {"ano": a_uk, "fonte": "CAA (Table 09, passageiros terminais e em trânsito)",
                          "lista": [{"pos": i + 1, "iata": iata, "pax": pax} for i, (iata, pax) in enumerate(lista_uk)]}
                    break
        if not uk:
            raise RuntimeError("tabela da CAA não encontrada")
        print("CAA ano", uk["ano"], "aeroportos", len(uk["lista"]), file=sys.stderr)
        saida["reino_unido"] = uk
    except Exception as e:
        print("CAA falhou:", e, file=sys.stderr)
        if anterior.get("reino_unido"):
            saida["reino_unido"] = anterior["reino_unido"]
    try:
        txt = requests.get(regioes.EUROSTAT, headers=UA, timeout=180).text
        ano_eu, lista_eu = regioes.parse_eurostat(txt, por_icao)
        if not ano_eu:
            raise RuntimeError("Eurostat sem ano completo")
        paises = collections.defaultdict(list)
        for icao, iata, pax in lista_eu:
            pais = (por_iata.get(iata) or {}).get("iso_country")
            if pais:
                paises[pais].append({"iata": iata, "pax": pax})
        for pais, l in paises.items():
            l.sort(key=lambda x: -x["pax"])
            for i, x in enumerate(l):
                x["pos"] = i + 1
        print("Eurostat ano", ano_eu, "aeroportos", len(lista_eu), "países", len(paises), file=sys.stderr)
        saida["europa_paises"] = {"ano": ano_eu, "fonte": "Eurostat (avia_paoa)", "paises": paises}
    except Exception as e:
        print("Eurostat falhou:", e, file=sys.stderr)
        if anterior.get("europa_paises"):
            saida["europa_paises"] = anterior["europa_paises"]
    with open("ranking-aeroportos.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print("ok", len(br), len(lista_mundo), file=sys.stderr)


if __name__ == "__main__":
    main()
