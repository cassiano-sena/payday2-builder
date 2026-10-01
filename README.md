Fazer um builder de payday 2

## MVP atual

O projeto roda como uma página estática, sem framework. O ponto de entrada da aplicação é `index.html`, que carrega `planner.js`. O navegador precisa acessar os arquivos por HTTP para que `fetch` consiga ler os catálogos JSON.

Para iniciar localmente, use qualquer servidor estático na raiz do projeto, por exemplo:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

### Catálogos

- `data/weapons.json`: armas, stats base, tags e slots compatíveis.
- `data/attachments.json`: modificadores por slot e arma compatível.
- `data/skills.json`: cinco árvores, três branches por árvore e pares basic/aced com orçamento de 120 pontos.
- `data/perks.json`: decks, cards, progresso vertical e efeitos compartilhados declarados.
- `data/heists.json`: perfis de heist legados, usados diretamente pelo otimizador.
- `data/equipment.json`: base preparada para expansão.
- `data/gadgets.json`, `data/melees.json`, `data/throwables.json`, `data/armors.json`: catálogos data-driven das telas de equipamento.
- `data/armors.json`: sete armaduras equipáveis com stats-base de PC e link da fonte.

Os valores do MVP são editáveis e marcados como placeholders quando ainda não foram verificados contra uma versão específica do jogo. O calculador aplica base, attachments, skills e perk, exibindo a origem de cada contribuição. O otimizador é rule-based: combina prioridades do heist com playstyle e propósito, e mostra score breakdown e limitações.

### Dados extraídos do jogo

- `game-data/game_data.json` é carregado junto com os catálogos do MVP. As armas e peças são normalizadas para as telas de armas; os perk decks reais também aparecem no catálogo. Skills reais ficam disponíveis como registros pesquisáveis na tela de skills.
- Armas exibem os stats originais do jogo. O calculador só mapeia dano, concealment e fire rate; outros valores não são convertidos para accuracy/stability por aproximação. Partes só alteram stats com uma chave compatível com o calculador.
- `game-data/player_data.json` carrega inicialmente os perfis e inventário do jogador. Em **Player Data**, selecione outro skill profile ou envie um JSON de outro jogador no mesmo formato. A tela mostra skills desbloqueadas e armas equipadas.
- **Apply equipped weapons** aplica as armas equipadas encontradas no dataset e as peças do blueprint que puderem ser identificadas. Skills do save são mostradas como dados do jogo, mas não entram no cálculo de efeitos placeholder do MVP.
- Nomes, descrições e efeitos ainda podem depender de localização/upgrades que não estão presentes nos arquivos crus. O builder não inventa esses valores; mantenha os JSONs sob controle de versão ao trocar a fonte de dados.
- O visualizador de skills usa as 15 árvores e a relação real tier/skill de `game_data.json`. Seleções Basic/Aced entram na build exportada; seus custos e efeitos ainda não são aplicados ao score. O perfil do player sincroniza os níveis iniciais. Jack of All Trades Aced libera o segundo slot de gadget.
- Os dados fornecidos não contêm definições de melee, throwables ou deployables; suas telas mantêm os catálogos MVP existentes e indicam o estado de revisão de cada item. Os decks reais exibem os nove cards e upgrade IDs, sem converter upgrades internos em bônus calculados.
- A ordem visual do inventário é primary, skill trees, secondary, perk deck, throwable, gadget 1, gadget 2 e melee. Builds antigas com um único gadget continuam importáveis.
- Armor usa os sete modelos equipáveis e os valores-base de PC publicados na [Payday Wiki](https://payday.fandom.com/wiki/Armors). `Armor`, `Concealment`, `Speed`, `Dodge`, `Steadiness` e `Stamina` entram no cálculo e na origem de stats; modificadores de skills, decks e crew não estão embutidos nos números do catálogo.
- Gadgets, melee, throwables e armor usam o mesmo browser de tiles e inspector da tela de armas. Os catálogos de gadget/melee/throwable continuam marcados como placeholder até existir uma fonte de jogo para eles.

Os IDs importados do jogo usam o prefixo `game:` para armas e `game-part:` para peças, evitando colisões com builds e registros já existentes.

main points:
1- abrigar as opções de armas, attachments, skills e perks.
2- ter um otimizador de builds para heists, tipo de playstyle, tipo de inimigo, propósito específico. Isso pode ser uma secção diferente em outra aba da página.
> exemplo de uso:
- otimizar para shadow raid
- otimizar para matar bulldozer
- otimizar para farm solo
3- otimizador de build a partir de armas ou skills ou perks selecionados. 

outras coisas:
- a ideia é ter um visualizador geral (similar ao inventario do próprio payday2) que abrange toda uma build, podendo entrar em detalhes ao clicar em uma secção como arma, arma secundária, skill, perks etc.
- ainda não sei como pegar os dados, talvez tenha que fazer manualmente, pegar de algum local open source ou minerar através do próprio jogo.
- esse projeto é pra ser feito junto com um amigo meu que está começando a programar, ele em específico gostaria de trabalhar com html então vamos fazer web, talvez com javascript ou algo do tipo.

para customização de armas:
> deve ter uma calculadora interna de valores a partir de attachments, armas e skins.
> deve ter um visualizador dos valores que indica a fonte, valor, eficiencia.
> opçoes de auto build:
> matematicamente correto (overall mais alto)
> valor(es) selecionado(s) mais alto(s) (dano, rpm,  acurácia, estabilidade, munição, concealment, threat)
> outros (se houver)

para skill tree:
> deve ter uma calculadora interna de valores a partir de skills selecionadas.
> deve ter um visualizador dos valores que indica a fonte, valor, eficiencia.
> opções de auto build:
> valor(es) selecionado(s) mais alto(s) (dodge, critical chance, armor, health, ammo, etc.)
> otimizador para heist (generic stealth, generic loud, outra heist em específico que necessita de uma build específica ex: the bomb forest)

para perk decks:
> deve ter uma calculadora interna de valores a partir de decks selecionadas.
> deve ter um visualizador dos valores que indica a fonte, valor, eficiencia.
