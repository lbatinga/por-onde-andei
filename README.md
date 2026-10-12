# Por Onde Andei

Meu mapa de viagens: cidades, países, estados, patrimônios da UNESCO, aeroportos, portos e atrações, tudo em português.

PWA de um arquivo só (`index.html`), com dados no Supabase (projeto Recordes de Corrida, tabelas `viagem_*`) e mapas do Natural Earth.

Hospedagem: Vercel, importando este repositório (publica sozinho a cada push na `main`). Não usar o GitHub Pages: em `lbatinga.github.io` o Chrome confunde com o CineList e não deixa instalar.

## Regra das cidades

No Brasil, "cidade" é só município oficial do IBGE (`municipios-br.json`, 5.570 municípios com código, UF e coordenadas). Povoados, bairros e regiões administrativas (ex.: Ceilândia, Gama) entram como "Outro lugar". Cidades salvas guardam `ref_externa = ibge:<código>`.

Estados: primeiro nível que as pessoas reconhecem. Itália, França e Espanha por região; Reino Unido pelas 4 nações.
