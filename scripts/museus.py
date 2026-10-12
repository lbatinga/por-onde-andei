"""Gera museus.json para o app Por Onde Andei.

Fonte oficial: Cadastro Nacional de Museus (MuseusBr), do Instituto Brasileiro de Museus (IBRAM).
Entram só museus com status "Aberto" e com coordenadas dentro do Brasil.
Formato: [codigo_ibram, nome, lat, lon, municipio, uf]
"""
import json, sys, time
import requests

UA = {"User-Agent": "PorOndeAndei/1.0 (https://github.com/lbatinga/por-onde-andei)"}
API = "https://cadastro.museus.gov.br/wp-json/tainacan/v2/collection/208/items"
META = {"local": 228, "municipio": 15568, "uf": 15563, "status": 269, "codigo": 15171}


def valor(item, mid):
    for v in (item.get("metadata") or {}).values():
        if isinstance(v, dict) and str(v.get("id")) == str(mid):
            return (v.get("value_as_string") or "").strip()
    return ""


def main():
    saida, pagina, total, vistos = [], 1, 0, set()
    while True:
        params = {"perpage": 96, "paged": pagina, "fetch_only": "title", "fetch_only_meta": ",".join(map(str, META.values())), "orderby": "id", "order": "ASC"}
        for tentativa in range(4):
            try:
                r = requests.get(API, params=params, headers=UA, timeout=120)
                r.raise_for_status()
                itens = r.json().get("items", [])
                break
            except Exception as e:  # o servidor do IBRAM às vezes demora
                print("erro página", pagina, e, file=sys.stderr); time.sleep(5 * (tentativa + 1))
        else:
            raise SystemExit("falhou na página %d" % pagina)
        if not itens:
            break
        for it in itens:
            total += 1
            if it["id"] in vistos:
                continue
            vistos.add(it["id"])
            if valor(it, META["status"]).lower() != "aberto":
                continue
            try:
                lat, lon = [float(x) for x in valor(it, META["local"]).split(",")[:2]]
            except ValueError:
                continue
            if not (-34.5 < lat < 5.5 and -74.5 < lon < -28.5):   # fora do Brasil = coordenada errada
                continue
            codigo = valor(it, META["codigo"]) or str(it["id"])
            saida.append([codigo, it["title"].strip(), round(lat, 5), round(lon, 5), valor(it, META["municipio"]), valor(it, META["uf"])])
        pagina += 1
    saida.sort(key=lambda x: (x[5], x[4], x[1]))
    with open("museus.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print("museus lidos", total, "abertos com coordenadas", len(saida), file=sys.stderr)


if __name__ == "__main__":
    main()
