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
- `data/gadgets.json`, `data/melees.json`, `data/throwables.json`: catálogos data-driven das telas de equipamento.

Os valores do MVP são editáveis e marcados como placeholders quando ainda não foram verificados contra uma versão específica do jogo. O calculador aplica base, attachments, skills e perk, exibindo a origem de cada contribuição. O otimizador é rule-based: combina prioridades do heist com playstyle e propósito, e mostra score breakdown e limitações.

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
