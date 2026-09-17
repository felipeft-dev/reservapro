# Configuração do ReservaPro (Firebase — plano gratuito)

Este sistema usa o **Firebase Firestore** (banco de dados em nuvem, tempo real). O login
do Painel do Proprietário é feito de forma simples, com usuário e senha definidos direto
no `script.js` (sem precisar do Firebase Authentication). O plano gratuito (Spark) do
Firebase é suficiente para a maioria dos pequenos negócios.

## 1. Criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"**, dê um nome (ex: `reservapro-minhaempresa`) e conclua a criação.

## 2. Criar o banco de dados Firestore

1. No menu lateral, vá em **Compilação → Firestore Database**.
2. Clique em **"Criar banco de dados"**.
3. Escolha a localização mais próxima (ex: `southamerica-east1` para o Brasil).
4. Inicie em **modo de produção** (vamos configurar as regras no passo 5).

## 3. Definir o usuário e senha do login (versão simples)

Esta versão **não usa** o Firebase Authentication — o login do Painel do
Proprietário é feito por um usuário e senha fixos escritos direto no
`script.js`. É bem mais simples de configurar (não precisa mexer em
Authentication nem em chaves de API), mas é importante entender a diferença:

> ⚠️ **O que essa proteção cobre e o que não cobre:** o login impede que
> alguém sem a senha *veja e use a tela* do Painel do Proprietário. Mas como
> não existe mais um usuário autenticado de verdade no Firebase, as regras do
> Firestore (passo 5) precisam ficar abertas para leitura/escrita — ou seja,
> alguém que soubesse o endereço do seu banco de dados e tivesse conhecimento
> técnico poderia, em teoria, ler ou alterar os dados diretamente, sem passar
> pela senha do site. Para a grande maioria dos pequenos negócios esse risco é
> baixo (o banco não é anunciado nem indexado publicamente), mas se um dia
> quiser a segurança completa, dá pra voltar para o Firebase Authentication.

Para configurar, abra o `script.js` e altere estas duas linhas (procure por
`AUTENTICAÇÃO DO ADMIN`):

```js
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "troque-esta-senha";
```

Troque pelos valores que o proprietário vai usar para entrar no painel.

## 4. Pegar as chaves do projeto e colar no `script.js`

1. No menu lateral, clique na engrenagem ⚙️ → **"Configurações do projeto"**.
2. Role até **"Seus apps"** e clique no ícone **`</>`** (Web) para registrar um app.
3. Dê um apelido (ex: `reservapro-web`) e clique em **"Registrar app"**. Você **não**
   precisa do Firebase Hosting.
4. Copie o objeto `firebaseConfig` que aparece na tela. Ele se parece com isto:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "reservapro-minhaempresa.firebaseapp.com",
  projectId: "reservapro-minhaempresa",
  storageBucket: "reservapro-minhaempresa.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

5. Abra o arquivo **`script.js`** deste projeto e substitua o objeto `firebaseConfig`
   no topo do arquivo pelos valores que você copiou.

## 5. Configurar as regras de segurança do Firestore

1. No Firestore, vá na aba **"Regras"**.
2. Apague o conteúdo e cole exatamente isto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Sem Firebase Authentication, não existe "usuário logado" que o
    // Firestore reconheça — a proteção do painel é só a senha na tela
    // (script.js). Por isso a leitura e a escrita ficam abertas aqui.
    match /servicos/{servicoId} {
      allow read, write: if true;
    }

    match /horarios_liberados/{data} {
      allow read, write: if true;
    }

    match /agendamentos/{agendamentoId} {
      allow read, write: if true;
    }
  }
}
```

3. Clique em **"Publicar"**.

> **Nota de segurança:** com essas regras, o banco de dados em si fica
> acessível para quem souber o `projectId` e mexer diretamente com o SDK do
> Firebase (bem mais trabalhoso que só usar o site, mas tecnicamente possível).
> A senha do `script.js` protege o uso normal do painel pelo navegador. Se no
> futuro quiser fechar essa brecha por completo, o caminho é voltar a usar o
> Firebase Authentication (como na versão anterior deste guia) com regras
> baseadas em `request.auth != null`.

## 6. Cadastrar os primeiros serviços

Depois de configurar tudo, abra o site → **Painel do Proprietário** → faça login →
use o formulário **"Gerenciar Serviços"** para cadastrar o catálogo (nome, preço,
duração). Eles aparecem automaticamente no site do cliente, em tempo real.

## 7. Liberar horários para os clientes

No mesmo painel, em **"Gerenciar Horários"**, escolha uma data e clique nos
horários sugeridos para abri-los (ficam verdes = livres). Você também pode
adicionar um horário customizado no campo abaixo da grade. Assim que um cliente
reserva, o horário fica vermelho ("Reservado") automaticamente para todo mundo,
em tempo real.

## 8. Publicar o site (GitHub Pages, Vercel ou Netlify)

Como o `script.js` já está usando módulos ES (`type="module"`) e carregando o
SDK do Firebase via CDN, basta subir os 3 arquivos (`index.html`, `style.css`,
`script.js`) para qualquer um destes serviços — não é necessário nenhum passo
de build:

- **GitHub Pages:** crie um repositório, suba os arquivos na raiz, ative o Pages
  em Settings → Pages, apontando para a branch principal.
- **Vercel / Netlify:** arraste a pasta com os 3 arquivos direto no painel
  ("Deploy" / "Add new site → Deploy manually").

## 9. Editar o número de WhatsApp

No `script.js`, altere a constante `COMPANY_WHATSAPP` para o número real do
estabelecimento, no formato `55` + DDD + número, sem espaços ou símbolos
(ex: `"5567991234567"`).

---

### Resumo do modelo de dados criado no Firestore

- **`servicos`** — cada documento é um serviço: `{ nome, preco, duracao }`
- **`horarios_liberados`** — um documento por data (`YYYY-MM-DD`), com um mapa
  `horarios: { "09:00": "livre", "09:30": "reservado" }`
- **`agendamentos`** — cada documento é uma reserva confirmada, com os dados do
  cliente, serviço, data e hora.
