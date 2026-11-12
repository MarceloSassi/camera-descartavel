# Como resetar o limite de fotos

O limite de **20 fotos por convidado** é controlado em dois lugares:

| Onde | O que guarda | Efeito |
|---|---|---|
| **No celular** (armazenamento do navegador) | Contador exibido na tela + identificação do convidado | O botão da câmera trava ao chegar a 0 |
| **No Apps Script** (Propriedades do script) | Quantas fotos cada identificação já enviou | O servidor recusa envios acima do limite |

---

## 1. Resetar um celular (caso mais comum, durante testes)

Apague **os dados do site** no celular. Isso zera o contador e cria uma **nova identificação de convidado**. Para o Apps Script, esse celular passa a ser outra pessoa, então o limite no servidor também recomeça. Não precisa mexer no Apps Script.

### iPhone

- **Site aberto no Safari:** Ajustes → Apps → Safari → Avançado → Dados de Sites → procure `github.io` → apague.
  (Em iOS mais antigos: Ajustes → Safari → Avançado → Dados de Sites.)
- **App instalado na tela de início:** ele guarda os dados separado do Safari. Segure o ícone → **Remover App** e instale de novo.

### Android (Chrome)

- **Site aberto no Chrome:** abra o site → toque no ícone à esquerda do endereço → **Configurações do site** → **Limpar e redefinir**.
- **App instalado:** segure o ícone → **Informações do app** → **Armazenamento** → **Limpar dados**.

> ⚠️ Fotos que estejam **na fila esperando internet** são perdidas ao limpar os dados. Confira se o contador não mostra "na fila" antes de limpar.

---

## 2. Zerar todas as contagens no servidor

Faça isso antes do casamento, para apagar as contagens dos testes.

### Opção A: pela tela de configurações

1. Abra o projeto em [script.google.com](https://script.google.com).
2. Vá em **⚙️ Configurações do projeto → Propriedades do script**.
3. Apague as linhas que começam com `lorena-marcelo:`. Cada uma é um celular que já enviou fotos.

### Opção B: com a função `resetarLimites` (melhor quando são muitas)

A função já está no fim de [`apps-script/Code.gs`](apps-script/Code.gs). Se o seu Apps Script foi colado antes dela existir, copie e cole a função no final do `Code.gs` do editor:

```javascript
function resetarLimites() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  let total = 0;
  Object.keys(all).forEach(function (key) {
    if (key.indexOf('lorena-marcelo:') === 0) {
      props.deleteProperty(key);
      total++;
    }
  });
  Logger.log(total + ' contagem(ns) zerada(s).');
}
```

Depois:

1. No topo do editor, selecione a função **`resetarLimites`**.
2. Clique em **Executar**.
3. O **Registro de execução** mostra quantas contagens foram zeradas.

A função só roda quando você a executa pelo editor. Ninguém consegue chamá-la pelo site, e não é preciso publicar uma nova versão.

> ℹ️ Zerar o servidor **não** zera o contador que aparece no celular. Para recomeçar um aparelho do zero, apague os dados do site (seção 1).

---

## 3. Checklist antes do casamento

- [ ] Rodar `resetarLimites` no Apps Script.
- [ ] Apagar as fotos de teste da pasta do Google Drive.
- [ ] Apagar os dados do site nos celulares usados para testar (seção 1).
- [ ] Conferir se `REVEAL_AT` em `config.js` está em `2026-11-29T23:00:00-03:00`.
- [ ] Abrir o site num celular "limpo" e confirmar que aparecem **20 fotos restantes**.

---

## Mudar o limite (ex.: de 20 para 30)

Altere o número **nos dois lugares**:

1. `config.js` → `PHOTO_LIMIT: 30`, depois aumente `CACHE_VERSION` em `sw.js`, faça commit e push.
2. Apps Script → `CONFIG.PHOTO_LIMIT: 30` → **Implantar → Gerenciar implantações → ✏️ Editar → Nova versão → Implantar**.

Quem já tirou fotos mantém as que usou. Por exemplo, um convidado que usou 20 passa a ter mais 10.
