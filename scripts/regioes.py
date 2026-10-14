"""Rankings regionais de aeroportos para o Por Onde Andei.

- Continentes: listas da Wikipedia ("List of the busiest airports in ..."), montadas a partir
  do ACI regional e dos órgãos oficiais de cada país. Métrica: total de passageiros
  (embarcados + desembarcados), a mesma da ANAC e do ACI. Pega a tabela do ano mais recente.
- Europa oficial: Eurostat (avia_paoa), passageiros transportados por aeroporto declarante,
  total (regular + não regular, doméstico + internacional).

As funções de parse recebem o texto já baixado, para poderem ser testadas sem rede.
"""
import json, re, sys, urllib.parse

WIKI_REGIOES = {
    "america_latina": "List_of_the_busiest_airports_in_Latin_America",
    "america_norte": "List_of_busiest_airports_in_North_America",
    "europa": "List_of_the_busiest_airports_in_Europe",
    "asia": "List_of_the_busiest_airports_in_Asia",
    "oriente_medio": "List_of_the_busiest_airports_in_the_Middle_East",
    "africa": "List_of_the_busiest_airports_in_Africa",
}
# Oceania ficou de fora: a tabela da Wikipedia mistura anos ("dados de 2017, salvo indicação").
EUROSTAT = ("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/avia_paoa"
            "?format=JSON&unit=PAS&tra_meas=PAS_CRD&freq=A&schedule=TOTAL&tra_cov=TOTAL&sinceTimePeriod=2022")


def titulo_wiki(href):
    """'./Sydney_Airport#x' ou '/wiki/Sydney_Airport' -> 'Sydney Airport' (use .lower() como chave)"""
    if not href:
        return None
    h = href.split("#")[0]
    h = re.sub(r"^(\./|/wiki/|https?://[a-z]+\.wikipedia\.org/wiki/)", "", h)
    if not h or ":" in h:
        return None
    return urllib.parse.unquote(h).replace("_", " ").strip()


def indice_ourairports(linhas):
    """linhas do airports.csv do OurAirports -> (titulo_wiki -> iata, icao -> iata, iata -> linha)"""
    por_wiki, por_icao, por_iata = {}, {}, {}
    for row in linhas:
        iata = row.get("iata_code")
        if not iata:
            continue
        por_iata.setdefault(iata, row)
        t = titulo_wiki(row.get("wikipedia_link") or "")
        if t:
            por_wiki.setdefault(t.lower(), iata)
        for k in ("icao_code", "gps_code", "ident"):
            if row.get(k):
                por_icao.setdefault(row[k], iata)
    return por_wiki, por_icao, por_iata


def numero(txt):
    txt = re.sub(r"\[[^\]]*\]", "", txt or "")          # tira notas [1]
    m = re.search(r"\d{1,3}(?:[,.\s]\d{3})+|\d{6,}", txt)
    if not m:
        return None
    return int(re.sub(r"[^\d]", "", m.group(0)))


def _ano_perto(tabela):
    """Ano da tabela: título da seção anterior, legenda, cabeçalho ou parágrafo anterior."""
    textos = []
    cap = tabela.find("caption")
    if cap:
        textos.append(cap.get_text(" ", strip=True))
    linha1 = tabela.find("tr")
    if linha1:
        textos.append(linha1.get_text(" ", strip=True))
    h = tabela.find_previous(["h2", "h3", "h4"])
    if h:
        textos.append(h.get_text(" ", strip=True))
    p = tabela.find_previous("p")
    if p:
        textos.append(p.get_text(" ", strip=True))
    for t in textos:
        anos = [int(a) for a in re.findall(r"\b(20[1-3]\d)\b", t)]
        if anos:
            return max(anos)
    return None


def parse_regiao(html, por_wiki, resolve=None, ano_max=None):
    """Primeira tabela de ano fechado (<= ano_max) com 10+ aeroportos -> (ano, [(titulo, iata, nome, pax)])."""
    from bs4 import BeautifulSoup
    sopa = BeautifulSoup(html, "html.parser")
    for sup in sopa.find_all("sup"):
        sup.decompose()
    for tabela in sopa.find_all("table"):
        cls = " ".join(tabela.get("class") or [])
        if "wikitable" not in cls:
            continue
        ano_tab = _ano_perto(tabela)
        if not ano_tab or (ano_max and ano_tab > ano_max):
            continue
        linhas = []
        for tr in tabela.find_all("tr"):
            cel = tr.find_all(["td", "th"])
            if len(cel) < 3:
                continue
            # aeroporto: primeiro link que é um aeroporto conhecido (ou código IATA numa célula)
            iata, i_aero, titulo, nome = None, None, None, None
            for i, c in enumerate(cel):
                for a in c.find_all("a"):
                    t = titulo_wiki(a.get("href"))
                    if t and t.lower() in por_wiki:
                        iata, i_aero, titulo, nome = por_wiki[t.lower()], i, t, a.get_text(" ", strip=True)
                        break
                    if t and titulo is None and re.search(r"airport|aeropuerto|aeroporto|aéroport|flughafen|aeroport|lufthavn|havalimanı|terminal", t.lower()):
                        titulo, i_aero, nome = t, i, a.get_text(" ", strip=True)
                if iata:
                    break
            if i_aero is None:
                continue
            if not iata:
                for c in cel:
                    m = re.match(r"^([A-Z]{3})(\s*/\s*[A-Z]{4})?$", c.get_text(" ", strip=True))
                    if m:
                        iata = m.group(1)
                        break
            if not iata and resolve and titulo:
                iata = resolve(titulo)
            # passageiros: primeiro número grande depois da célula do aeroporto
            pax = None
            for c in cel[i_aero + 1:]:
                txt = c.get_text(" ", strip=True)
                if re.fullmatch(r"[A-Z]{3}(\s*/\s*[A-Z]{4})?", txt) or "%" in txt:
                    continue
                n = numero(txt)
                if n and n >= 100000:
                    pax = n
                    break
            if iata and pax:
                linhas.append((titulo, iata, nome, pax))
        if len(linhas) >= 10:
            vistos, lista = set(), []
            for l in sorted(linhas, key=lambda x: -x[3]):
                if l[1] in vistos:
                    continue
                vistos.add(l[1])
                lista.append(l)
            return ano_tab, lista
    return None, []


def parse_eurostat(texto, por_icao):
    """JSON-stat do Eurostat -> (ano, [(icao, iata, pax)]) do ano mais recente com 300+ aeroportos."""
    d = json.loads(texto)
    ids, tam = d["id"], d["size"]
    idx = {k: d["dimension"][k]["category"]["index"] for k in ids}
    val = d["value"]

    def pos(coords):
        p = 0
        for k, n in zip(ids, tam):
            p = p * n + coords.get(k, 0)
        return str(p)

    anos = sorted(idx["time"], key=lambda a: -int(a))
    for ano in anos:
        lista = []
        for aero, ia in idx["rep_airp"].items():
            if aero.endswith("_OTH") or "_" not in aero:
                continue
            c = {k: 0 for k in ids}
            c.update({"rep_airp": ia, "time": idx["time"][ano]})
            for k in ("schedule", "tra_cov"):
                if k in idx:
                    c[k] = idx[k].get("TOTAL", 0)
            v = val.get(pos(c)) if isinstance(val, dict) else val[int(pos(c))]
            icao = aero.split("_", 1)[1]
            if v and icao in por_icao:
                lista.append((icao, por_icao[icao], int(v)))
        if len(lista) >= 300:
            lista.sort(key=lambda x: -x[2])
            return int(ano), lista
    return None, []


def wikidata_resolver(session, ua):
    """Título de artigo da Wikipedia em inglês -> IATA (P238) pela Wikidata, com cache."""
    cache = {}

    def resolve(titulo):
        if titulo in cache:
            return cache[titulo]
        cache[titulo] = None
        try:
            r = session.get("https://www.wikidata.org/w/api.php", headers=ua, timeout=30, params={
                "action": "wbgetentities", "sites": "enwiki", "titles": titulo, "props": "claims",
                "normalize": 1, "redirects": "yes", "format": "json"}).json()
            for ent in (r.get("entities") or {}).values():
                for cl in (ent.get("claims") or {}).get("P238", []):
                    v = cl.get("mainsnak", {}).get("datavalue", {}).get("value")
                    if v and re.fullmatch(r"[A-Z]{3}", v):
                        cache[titulo] = v
                        break
        except Exception as e:
            print("wikidata falhou para", titulo, e, file=sys.stderr)
        return cache[titulo]

    return resolve


# Reino Unido: CAA, tabela 09 (passageiros terminais + trânsito), anual. O link do CSV muda todo ano,
# então a página anual é lida para achar a "Table 09 ... (CSV".
CAA_PAGINA = "https://www.caa.co.uk/data-and-analysis/uk-aviation-market/airports/uk-airport-data/uk-airport-data-{ano}/annual-{ano}/"
CAA_IATA = {
    "GATWICK": "LGW", "HEATHROW": "LHR", "LONDON CITY": "LCY", "LUTON": "LTN", "SOUTHEND": "SEN", "STANSTED": "STN",
    "ABERDEEN": "ABZ", "BARRA": "BRR", "BELFAST CITY (GEORGE BEST)": "BHD", "BELFAST INTERNATIONAL": "BFS",
    "BENBECULA": "BEB", "BIGGIN HILL": "BQH", "BIRMINGHAM": "BHX", "BLACKPOOL": "BLK", "BOURNEMOUTH": "BOH",
    "BRISTOL": "BRS", "CAMPBELTOWN": "CAL", "CARDIFF WALES": "CWL", "CITY OF DERRY (EGLINTON)": "LDY", "DUNDEE": "DND",
    "EAST MIDLANDS INTERNATIONAL": "EMA", "EDINBURGH": "EDI", "EXETER": "EXT", "FARNBOROUGH": "FAB", "GLASGOW": "GLA",
    "HUMBERSIDE": "HUY", "INVERNESS": "INV", "ISLAY": "ILY", "ISLES OF SCILLY (ST.MARYS)": "ISC", "KIRKWALL": "KOI",
    "LANDS END (ST JUST)": "LEQ", "LEEDS BRADFORD": "LBA", "LERWICK (TINGWALL)": "LWK", "LIVERPOOL (JOHN LENNON)": "LPL",
    "LYDD": "LYX", "MANCHESTER": "MAN", "NEWCASTLE": "NCL", "NEWQUAY": "NQY", "NORWICH": "NWI", "OXFORD (KIDLINGTON)": "OXF",
    "PRESTWICK": "PIK", "SOUTHAMPTON": "SOU", "STORNOWAY": "SYY", "SUMBURGH": "LSI", "TEESSIDE INTERNATIONAL AIRPORT": "MME",
    "TIREE": "TRE", "WICK JOHN O GROATS": "WIC", "ALDERNEY": "ACI", "GUERNSEY": "GCI", "ISLE OF MAN": "IOM", "JERSEY": "JER",
}


def link_caa(html):
    """Acha o link do CSV da tabela 09 na página anual da CAA."""
    for m in re.finditer(r'href="([^"]+)"[^>]*>\s*<span>\s*Table 09[^<]*\(CSV', html):
        href = m.group(1)
        return href if href.startswith("http") else "https://www.caa.co.uk" + href
    return None


def parse_caa(texto):
    """CSV da tabela 09 -> (ano, [(iata, pax)]) e lista de nomes sem código."""
    import csv, io
    linhas = list(csv.DictReader(io.StringIO(texto.lstrip("\ufeff"))))
    ano, lista, sem = None, [], []
    for row in linhas:
        nome = (row.get("rpt_apt_name") or "").strip().upper()
        pax = int(float(row.get("total_pax_tp") or 0))
        ano = int(row.get("this_period") or 0) or ano
        if pax <= 0:
            continue
        iata = CAA_IATA.get(nome)
        if not iata:
            sem.append(nome)
            continue
        lista.append((iata, pax))
    lista.sort(key=lambda x: -x[1])
    return ano, lista, sem
