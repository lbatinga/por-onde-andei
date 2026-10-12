# Por Onde Andei

Meu mapa de viagens: cidades, países, estados, patrimônios da UNESCO, aeroportos, portos e atrações, tudo em português.

PWA de um arquivo só (`index.html`), com dados no Supabase (projeto Recordes de Corrida, tabelas `viagem_*`) e mapas do Natural Earth.

Hospedagem: Vercel, importando este repositório (publica sozinho a cada push na `main`). Não usar o GitHub Pages: em `lbatinga.github.io` o Chrome confunde com o CineList e não deixa instalar.

## Regra das cidades

No Brasil, "cidade" é só município oficial do IBGE (`municipios-br.json`, 5.570 municípios com código, UF e coordenadas). Povoados, bairros e regiões administrativas (ex.: Ceilândia, Gama) entram como "Outro lugar". Cidades salvas guardam `ref_externa = ibge:<código>`.

Estados: primeiro nível que as pessoas reconhecem. Itália, França e Espanha por região; Reino Unido pelas 4 nações.

## Bases prontas

- **UNESCO**: tabela `viagem_unesco` no Supabase (só leitura), montada a partir do Wikidata (`P757`), com nome em português (rótulo pt/pt-br ou título da Wikipédia em português). Lugares marcados guardam `ref_externa = unesco:<id>`.
- **Aeroportos**: `aeroportos.json`, do OurAirports (grandes e médios com voo comercial e código IATA), com nomes adaptados para o português. Lugares marcados guardam `ref_externa = iata:<código>`.
- **Atrações e parques nacionais**: tabela `viagem_atracoes` (Wikidata): 430 atrações famosas (relevância = número de Wikipédias que têm artigo) e 2.438 parques nacionais. Ficam no tipo `atracao`; parques usam `ref_externa = parque:<QID>` e atrações `wd:<QID>`.

## Compartilhar

`viagem_compartilhar` guarda um token aleatório por pessoa. O link `/?v=<token>` abre o app em modo visitante (só leitura), usando a função `viagem_publico(token)`, que devolve rótulos, lugares e marcações; notas e datas de visita não saem. Desmarcar "Link ativo" corta o acesso na hora.
