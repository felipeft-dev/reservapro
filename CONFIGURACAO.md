# Configuração do ReservaPro (Firebase — plano gratuito)

Este sistema usa o **Firebase Firestore** (banco de dados em nuvem, tempo real) e o
**Firebase Authentication** (login do proprietário). O plano gratuito (Spark) é suficiente
para a maioria dos pequenos negócios.

## 1. Criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"**, dê um nome (ex: `reservapro-minhaempresa`) e conclua a criação.

## 2. Criar o banco de dados Firestore

1. No menu lateral, vá em **Compilação → Firestore Database**.
2. Clique em **"Criar banco de dados"**.
3. Escolha a localização mais próxima (ex: `southamerica-east1` para o Brasil).
4. Inicie em **modo de produção** (vamos configurar as regras no passo 5).

## 3. Ativar o login do proprietário (Authentication)

1. No menu lateral, vá em **Compilação → Authentication**.
2. Clique em **"Começar"**.
3. Ative o provedor **"E-mail/senha"**.
4. Na aba **"Users"**, clique em **"Add user"** e crie o e-mail e senha que o
   proprietário vai usar para entrar no Painel do Proprietário. Guarde essas
   credenciais — é o login do site.

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

    // Serviços: qualquer visitante pode ler; só o admin logado pode criar/editar/remover
    match /servicos/{servicoId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Grade de horários: leitura pública (cliente vê o que está aberto).
    // Criar/remover a grade: só admin.
    // Atualizar: admin pode tudo; o cliente só pode alterar o campo "horarios"
    // (é isso que acontece quando ele reserva um horário pelo site).
    match /horarios_liberados/{data} {
      allow read: if true;
      allow create, delete: if request.auth != null;
      allow update: if request.auth != null ||
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['horarios']);
    }

    // Agendamentos: qualquer cliente pode criar uma reserva.
    // Ler a lista completa, editar ou cancelar: só o admin logado.
    match /agendamentos/{agendamentoId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

3. Clique em **"Publicar"**.

> **Nota de segurança:** essas regras já impedem que um estranho leia a lista de
> clientes ou mexa no catálogo de serviços sem estar logado como admin. Para um
> negócio maior, recomenda-se evoluir para Cloud Functions para validar cada
> reserva no servidor — mas para a maioria dos pequenos negócios essas regras
> são suficientes.

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
