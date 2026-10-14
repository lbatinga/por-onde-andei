"""Gera malhas/XX.json: o contorno de cada município, um arquivo por estado (IBGE, malha municipal).

O app pinta no mapa os municípios onde você esteve e só baixa o arquivo do estado que precisa.
Coordenadas com 4 casas (~10 m), o suficiente para o mapa. Se um estado falhar, fica o arquivo anterior.
"""
import json, os, sys, time
import requests

UA = {"User-Agent": "PorOndeAndei/1.0 (https://github.com/lbatinga/por-onde-andei)"}
URL = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade={q}"
UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split()
QUALIDADE = os.environ.get("QUALIDADE", "intermediaria")


def anel(pts):
    out = []
    for x, y in pts:
        p = [round(x, 4), round(y, 4)]
        if not out or out[-1] != p:
            out.append(p)
    return out if len(out) >= 4 else None


def geometria(g):
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    novos = []
    for poly in polys:
        aneis = [a for a in (anel(r) for r in poly) if a]
        if aneis:
            novos.append(aneis)
    return {"type": "MultiPolygon", "coordinates": novos}


def main():
    os.makedirs("malhas", exist_ok=True)
    falhas = []
    for uf in UFS:
        try:
            for tentativa in range(3):
                try:
                    r = requests.get(URL.format(uf=uf, q=QUALIDADE), headers=UA, timeout=180)
                    r.raise_for_status()
                    geo = r.json()
                    break
                except Exception:
                    if tentativa == 2:
                        raise
                    time.sleep(5)
            feats = [{"type": "Feature", "properties": {"cod": f["properties"]["codarea"]}, "geometry": geometria(f["geometry"])} for f in geo["features"]]
            if not feats:
                raise ValueError("vazio")
            with open(f"malhas/{uf}.json", "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
            print(uf, len(feats), "municípios", os.path.getsize(f"malhas/{uf}.json") // 1024, "KB", file=sys.stderr)
        except Exception as e:
            falhas.append(uf)
            print(uf, "falhou:", e, file=sys.stderr)
    if len(falhas) == len(UFS):
        raise SystemExit("todas as malhas falharam")


if __name__ == "__main__":
    main()
