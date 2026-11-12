# Casamento de Lorena e Marcelo — câmera descartável digital

MVP criado exclusivamente para o casamento de **Lorena e Marcelo**.

- **Data do casamento:** 29/11/2026
- **Horário da cerimônia:** 15h
- **Revelação das fotos:** 29/11/2026 às 23h

Os convidados acessam o link ou QR Code pelo celular, tiram fotos, o navegador comprime as imagens e o Google Apps Script salva tudo diretamente em uma única pasta do Google Drive. Depois do horário configurado, a página de revelação exibe a galeria.

## O que está pronto

- Interface mobile-first em bento, tema claro (branco, laranja e fúcsia), botão de câmera fixo na barra inferior.
- Fluxo: tocar no botão → câmera do celular → prévia com confirmação → envio → volta para o início com o contador atualizado.
- Câmera do celular.
- Compressão automática para JPEG.
- Limite de 20 fotos por navegador/convidado.
- Validação do limite também no Apps Script.
- Upload direto para a pasta do casamento no Google Drive.
- Contagem regressiva para a revelação.
- Galeria após o horário configurado.
- Uso da logo oficial do evento nas páginas.
- GitHub Pages como hospedagem.
- PWA instalável ("Adicionar à tela de início"), com abertura offline.
- Fila de envio offline: sem internet, a foto fica guardada no celular e é enviada sozinha quando a conexão voltar.
- Sem cadastro, login ou lógica de múltiplos eventos.

> O limite é apropriado para uma festa privada, mas não é antifraude. Se alguém limpar o armazenamento do navegador, receberá um novo identificador.

---

## 1. Crie a pasta das fotos no Google Drive

Crie uma pasta com um nome como:

```text
Casamento Lorena e Marcelo - Fotos
```

Abra a pasta e copie o ID da URL:

```text
https://drive.google.com/drive/folders/1ABCDEF123456789
                                      ^^^^^^^^^^^^^^^
                                      este é o ID
```

Essa será a pasta final. O sistema não cria subpastas de eventos.

---

## 2. Configure o Apps Script

1. Acesse `https://script.google.com/`.
2. Crie um projeto.
3. Apague o conteúdo de `Code.gs`.
4. Cole `apps-script/Code.gs` deste projeto.
5. Altere apenas o ID da pasta:

```javascript
const CONFIG = {
  ROOT_FOLDER_ID: 'SEU_ID_AQUI',
  PHOTO_LIMIT: 20,
  PUBLIC_GALLERY: true,
  MAX_BASE64_CHARS: 4 * 1024 * 1024
};
```

### Publicação

Em **Implantar > Nova implantação**:

1. Tipo: **Aplicativo da Web**.
2. Executar como: **Você**.
3. Quem pode acessar: **Qualquer pessoa**.
4. Autorize as permissões.
5. Copie a URL terminada em `/exec`.

---

## 3. Configure o site

Edite `config.js`:

```javascript
window.REVEAL_CONFIG = {
  APP_NAME: 'Casamento de Lorena e Marcelo',
  PHOTO_LIMIT: 20,
  REVEAL_AT: '2026-11-29T23:00:00-03:00',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/SEU_ID/exec',
  MAX_IMAGE_SIDE: 1600,
  JPEG_QUALITY: 0.82
};
```

A data de revelação já está configurada para **29/11/2026 às 23h**. Você só precisa substituir a URL do Apps Script.

---

## 4. Publique no GitHub Pages

Envie para um repositório:

```text
index.html
gallery.html
styles.css
app.js
gallery.js
config.js
pwa.js
sw.js
manifest.webmanifest
assets/logo-evento.png
assets/logo-mini.png
assets/icons/
```

> **PWA:** sempre que alterar arquivos do site depois de publicado, aumente `CACHE_VERSION` em `sw.js` (ex.: `v1` → `v2`) para os celulares que já instalaram receberem a versão nova. `config.js` e as páginas HTML sempre tentam a rede primeiro.

Depois vá em **Settings > Pages > Deploy from a branch**, selecione `main` e `/ (root)`.

A URL ficará parecida com:

```text
https://SEU-USUARIO.github.io/casamento-lorena-marcelo/
```

Use essa URL para gerar o QR Code que ficará nas mesas, placas ou convites da festa.

---

## 5. Teste antes do casamento

No celular:

1. Abra o site usando 4G/5G.
2. Tire uma foto.
3. Confirme se apareceu na pasta do Drive.
4. Teste o limite de fotos.
5. Acesse a página de revelação.
6. Se quiser testar a galeria antes, mude temporariamente `REVEAL_AT` para alguns minutos no futuro.
7. Aguarde o contador zerar.
8. Verifique se a galeria carrega.
9. Teste pelo menos um iPhone e um Android.
10. Instale o app (Android: menu ⋮ > Instalar app; iPhone: Compartilhar > Adicionar à Tela de Início) e repita os testes abrindo pelo ícone.
11. Ative o modo avião, tire uma foto e envie: ela deve ficar "na fila". Desative o modo avião e confira se chega ao Drive.

---

## Estrutura

```text
reveal-festa/
├── index.html
├── gallery.html
├── styles.css
├── app.js
├── gallery.js
├── config.js
├── pwa.js
├── sw.js
├── manifest.webmanifest
├── README.md
├── assets/
│   ├── logo-evento.png
│   ├── logo-mini.png
│   └── icons/            (gerados a partir de logo-mini.png)
└── apps-script/
    └── Code.gs
```
