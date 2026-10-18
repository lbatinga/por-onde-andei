# Por Onde Andei

Mapa pessoal de viagens, em português. O núcleo é **países, estados, cidades e aeroportos**; patrimônios da UNESCO, atrações e parques e museus são extras. O foco é o que a pessoa já visitou ("Estive"); "Quero ir" é a lista de desejos. Tudo funciona para qualquer usuário, morando no Brasil ou fora.

- PWA de um arquivo só (`index.html`) com service worker (`sw.js`, versão em `VERSAO`; subir a cada publicação).
- Dados no Supabase (tabelas `viagem_*`, cada linha com `user_id` e RLS "dono").
- Hospedagem: Vercel, importando este repositório (publica sozinho a cada push na `main`). Não usar o GitHub Pages: em `lbatinga.github.io` o Chrome confunde com o CineList e não deixa instalar.

## O que o app faz

- **Mapa e lista**: países e estados pintados, pinos de cidades, aeroportos e extras; a lista mostra o que está visível no mapa. Contadores no topo (Países, Estados, Cidades, Aeroportos, Mais). Malha dos municípios do Brasil de perto (zoom 6+).
- **Rótulos**: Estive, Quero ir, Favorito e Escala vêm prontos; cada pessoa cria, renomeia e escolhe se o rótulo pinta o mapa, conta só o lugar ou não conta. O "?" da legenda explica cada um. Não dá para excluir o último rótulo que pinta o mapa, e excluir um rótulo tem Desfazer.
- **Primeiro acesso**: boas-vindas, "Onde você mora?" (a casa) e a **marcação rápida** de países e estados inteiros (também no Menu). País ou estado já pintado por lugares da pessoa vem marcado e travado.
- **Cidade automática**: marcar aeroporto, patrimônio, atração ou museu como visitado marca também a cidade onde fica (com Desfazer).
- **Viagens**: roteiros com paradas e meio de transporte, quilômetros, linha do tempo e sugestões de viagem por mês.
- **Voos e passaporte**: número do voo + data preenchem o resto. Passaporte com capa, rotas, carimbos, recordes, por ano, companhias (nome e logo da época), aviões (fotos pela matrícula) e por viagem. Botão "Completar" busca o que falta.
- **Carteira do Google**: cartão "Passaporte de voos" com os números e o mapa das rotas, atualizado sozinho.
- **Bandeiras, estatísticas e selos**: álbum de bandeiras, área do mundo, continentes, distâncias, ranking dos aeroportos e selos por coleção e por marcos.
- **Compartilhar**: imagem pronta para WhatsApp/Instagram e link só de leitura.
- **Sem internet**: abre com a última cópia dos dados e envia as alterações quando a conexão volta.

## Regras dos lugares

- **Cidades**: no Brasil, só município oficial do IBGE (`municipios-br.json`); salvas com `ref_externa = ibge:<código>`. Povoados e bairros não entram como cidade.
- **Estados**: primeiro nível que as pessoas reconhecem (Itália, França e Espanha por região; Reino Unido pelas 4 nações).
- **País inteiro / Estado inteiro**: lugares dos tipos `pais` e `estado` (`ref_externa = pais:<ISO>` / `estado:<código>`), criados pela marcação rápida ou pela busca.
- **Aeroportos**: `ref_externa = iata:<código>`. Portos saíram do app (os antigos viraram atrações).

## Bases

| Base | Arquivo / tabela | Origem |
|---|---|---|
| Países e estados | `paises.json`, `estados.json` | Natural Earth |
| Municípios do Brasil | `municipios-br.json`, `malhas/XX.json` | IBGE |
| População | `cidades-pop.json`, `cidades-mundo.json` | IBGE e GeoNames |
| Aeroportos e ranking | `aeroportos.json`, `ranking-aeroportos.json` | OurAirports, ACI, ANAC e listas oficiais |
| Museus | `museus.json` | Cadastro Nacional de Museus (IBRAM) |
| Companhias e aviões | `aerolinhas.json`, `aeronaves.json` | OpenFlights |
| Histórico das companhias | `cias-historico.json` | Wikidata (qual empresa usava o código em cada data; logos de época do Wikimedia Commons) |
| UNESCO, atrações e parques | `viagem_unesco`, `viagem_atracoes` | Wikidata |

## Voos

Função `voo` no Supabase (só para usuário logado):
- **Último ano**: AeroDataBox (chave em `viagem_segredos`, via RapidAPI). Traz horários, avião e, quase sempre, a matrícula.
- **Mais antigo, no Brasil**: VRA da ANAC (dados abertos), com horário de Brasília convertido para o fuso de cada aeroporto, inclusive horário de verão. Não tem matrícula. Resultado guardado em `viagem_vra_cache`.
- **Mais antigo, fora do Brasil**: sem fonte gratuita; preenchimento manual.

Companhias: uma companhia é uma **empresa**, não uma marca. TAM e LATAM Brasil contam como uma; o título usa o nome do voo mais recente, cada voo mostra o nome e o logo da sua época, e empresas extintas aparecem com "encerrou em".

## Carteira do Google

Função `carteira` (Generic pass): classe `poa_passaporte_v1` e um cartão por usuário (`voos_<id>`). Chaves em `viagem_segredos` (`GOOGLE_WALLET_ISSUER`, `GOOGLE_WALLET_SA`). A imagem do cartão vem do bucket público `carteira`, só da pasta do próprio usuário. O emissor ainda está em modo de teste: só contas de teste conseguem salvar o cartão.

## Erros (Sentry)

O app manda para o Sentry (projeto `por-onde-andei`, organização `batinga`) os erros que acontecem no uso real, só no endereço de produção (`*.vercel.app`): erros de JavaScript e as mensagens de erro mostradas na tela ("Erro…", "Não deu…"). Vai só o id do usuário, nunca e-mail ou dados das viagens. Falhas de rede comuns são ignoradas.

## Compartilhar e fotos

- `viagem_compartilhar` guarda um token por pessoa; `/?v=<token>` abre em modo visitante pela função `viagem_publico(token)`, sem notas, datas nem fotos. Desmarcar "Link ativo" corta o acesso na hora.
- Fotos: bucket privado `viagem-fotos`, caminho `<usuário>/<lugar>/<arquivo>.jpg`, reduzidas para até 1600 px antes de enviar.

## Atualização das bases

- **GitHub Actions "Bases mensais"** (`ranking-aeroportos.yml`, todo dia 5): rankings, museus, cidades, aeroportos, municípios, companhias, aviões e histórico das companhias. Só grava se algo mudou. Não fazer push enquanto ela roda (o commit dela falha).
- **GitHub Actions "Malhas"** (`malhas.yml`, todo 15 de fevereiro): malhas dos municípios por UF.
- **pg_cron no Supabase** (agosto, depois da reunião anual da UNESCO): `viagem_atualiza_bases_pedir()` e `viagem_atualiza_bases_processar()` acrescentam UNESCO, parques e atrações novos; `viagem_atualiza_bases_repetir()` tenta de novo se der timeout. Resultado em `viagem_base_pedidos`.
