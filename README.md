# Sigil Generator

Módulo para Foundry VTT (testado na v13.351) que gera runas/sigilos
procedurais em SVG — no mesmo espírito do [Sigil Generator do
Watabou](https://watabou.itch.io/sigil-generator) — e permite:

1. Gerar uma runa aleatória (com semente reprodutível) e ajustar nome/poder/descrição.
2. Criar uma **Entrada de Diário** com a imagem da runa e o texto gerado.
3. Colocar automaticamente um **baú** no mapa da cena ativa, já vinculado a esse diário.
4. Criar um **Item** com a imagem da runa, ligado ao diário, que pode ir para o inventário de um jogador.

## Instalação

**Opção A — pela URL do manifesto (recomendado):**

1. No Foundry, vá em **Add-on Modules → Install Module**.
2. Cole a URL do manifesto:
   `https://raw.githubusercontent.com/fernandowrpg/sigil-generator/main/module.json`
3. Clique em **Install**.

**Opção B — manual:**

1. Baixe o repositório (Code → Download ZIP) e extraia.
2. Copie a pasta para `Data/modules/sigil-generator/`, de forma que o
   resultado seja `Data/modules/sigil-generator/module.json`.
3. Ative o módulo em **Configurar Módulos** no seu mundo e recarregue.

## Como usar

- Com uma cena ativa, clique no ícone de **chapéu de mago** 🧙 nos
  controles de **Anotações** (barra lateral esquerda do canvas), **ou**
  crie uma macro de script com:

  ```js
  game.modules.get("sigil-generator").api.open();
  ```

- Na janela que abre:
  - **Gerar outra**: sorteia uma nova runa.
  - Campo **Semente**: digite um número e clique **Aplicar** para
    recriar exatamente a mesma runa depois.
  - Edite **Nome**, **Poder** e **Descrição** livremente antes de criar.
  - **Item da runa**: marque *Criar item para o inventário*, escolha o
    **tipo do item** (a lista vem do sistema do seu mundo) e, se quiser,
    **Entregar para** um personagem de jogador — o item já cai no
    inventário dele. Sem escolher ninguém, o item fica no diretório de
    Itens para você arrastar até a ficha do personagem.
  - **Permitir que os jogadores vejam o diário e o item**: dá permissão de
    Observador (senão os jogadores não conseguem abrir o diário da runa).
  - **Criar diário e colocar baú no mapa**: gera o PNG da runa, cria a
    Entrada de Diário (e o Item, se marcado) e coloca o baú no centro da
    visão atual da cena.

Apenas o **Mestre** vê o botão nos controles e pode usar o gerador.

## Onde as coisas ficam

- Imagens PNG das runas: `Data/sigil-generator-runas/runa-<seed>.png`
- Entrada de Diário: aparece no Diretório de Diários, com uma página
  contendo a imagem, o poder e a descrição.
- Baú no mapa: um marcador de **Anotação** (Note) com ícone de baú,
  no centro da tela no momento da criação — arraste-o para onde quiser
  depois. Clicar duas vezes no baú abre a Entrada de Diário vinculada.

## Criar o item de uma runa que já existe

Para runas geradas antes (ou em qualquer momento depois), sem precisar
gerar de novo:

- Abra o diário da runa — o cabeçalho da janela ganha o botão **Criar item da runa**; **ou**
- No Diretório de Diários, clique com o botão direito no diário da
  runa → **Criar item da runa**; **ou**
- Por macro: `game.modules.get("sigil-generator").api.createItemFromJournal("<id do diário>")`.

Uma janelinha pergunta o tipo do item, para quem entregar e se os
jogadores podem ver o diário. A imagem, o poder e a descrição são
lidos do próprio diário. O botão só aparece em diários criados por este
módulo (reconhecidos pela imagem `runa-<semente>.png`).

## Como o item se liga ao diário

- O item guarda o link do diário na descrição (`@UUID[...]`) — o módulo
  preenche o campo de descrição que o sistema usar (`system.description`
  ou `system.description.value`). Se o seu sistema usar outro campo, o
  texto não aparece na descrição, mas o vínculo continua funcionando:
- Toda ficha de item de runa ganha um botão **Abrir runa** (ícone de
  chapéu de mago) no cabeçalho, que abre o diário. Isso funciona mesmo
  depois de o item ser copiado para o inventário de um personagem.
- O diário também traz de volta um link para o item.

## Por que uma Anotação e não um "item container" de verdade?

Sem um sistema de jogo específico carregado (D&D 5e, PF2e etc.), o
Foundry não tem um tipo nativo de "Item de contêiner" — cada sistema
define isso à sua maneira. A forma mais robusta e **compatível com
qualquer sistema** de "colocar a runa dentro de um baú no mapa" é usar
uma Anotação (Note) com ícone de baú, vinculada à Entrada de Diário:
clicável, arrastável, e funciona em qualquer mundo, com ou sem sistema.

Se no futuro o módulo evoluir para suportar um sistema específico
(D&D 5e, Pathfinder 2e etc.), dá para estender para criar de fato um
Token + Item do tipo contêiner com a runa dentro como item de verdade.

## Estrutura do repositório

```
sigil-generator/
  module.json
  LICENSE
  scripts/
    main.js            # hooks, controle de cena, API pública
    rng.js             # PRNG com semente
    rune-generator.js  # gerador procedural do SVG da runa
    lore-generator.js  # nome/poder/descrição gerados
    rune-app.js        # janela (ApplicationV2) de preview/edição
    create-content.js  # rasteriza SVG, cria Diário e o baú na cena
  templates/rune-app.hbs
  styles/rune-app.css
  assets/chest-icon.svg
  lang/{pt-BR,en}.json
```

## Publicando novas versões

Para que o auto-update do Foundry funcione (comparando `version` no
`module.json` com a instalada), sempre que fizer uma alteração:

1. Suba a `version` no `module.json` (ex.: `1.0.0` → `1.0.1`).
2. Faça commit/push (ou upload) das mudanças na branch `main`.
3. Opcionalmente, crie uma **Release** no GitHub com uma tag
   (ex. `v1.0.1`) e anexe um `.zip` da pasta do módulo — assim
   `download` pode apontar para esse asset em vez do `archive/main.zip`,
   o que é mais estável a longo prazo.
