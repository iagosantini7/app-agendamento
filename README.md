# AGRC Estética Automotiva — App de agendamento

App web instalável (PWA) para clientes agendarem serviços e para o dono aprovar tudo em um painel próprio.

- Cliente: escolhe um ou mais serviços, o veículo, a data (seg. a sex., 08:00 ou 13:00) e confirma.
- Dono: faz login próprio e vê/aprova/recusa cada agendamento, além de gerenciar os serviços e preços.
- Dados ficam guardados no [Supabase](https://supabase.com) (banco de dados gratuito na nuvem).

## 1. Criar o projeto no Supabase (gratuito)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Escolha um nome (ex: `agrc-estetica`) e uma senha para o banco (guarde essa senha em local seguro).
3. Espere o projeto terminar de ser criado (leva 1-2 minutos).
4. No menu lateral, abra **SQL Editor** → **New query**.
5. Copie todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) deste projeto, cole no editor e clique em **Run**.
   Isso cria as tabelas de serviços e agendamentos, já com os 5 serviços iniciais cadastrados.
6. No menu lateral, abra **Settings → API**. Você vai precisar de dois valores:
   - **Project URL**
   - **anon public key**

## 2. Configurar o app com essas chaves

1. Na raiz do projeto, copie o arquivo `.env.example` para um novo arquivo chamado `.env`.
2. Cole a URL e a chave que você pegou no passo anterior:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
   ```

## 3. Rodar localmente (opcional, para testar antes de publicar)

```bash
npm install
npm run dev
```
Abra o link que aparecer no terminal (geralmente `http://localhost:5173`).

## 4. Criar a conta do dono

1. No app, vá até a aba **Painel**.
2. Clique em **Primeiro acesso? Criar conta**, informe um e-mail e uma senha (mínimo 6 caracteres).
3. Dependendo da configuração padrão do Supabase, ele pode pedir para confirmar o e-mail antes do primeiro login —
   se isso acontecer, você recebe um e-mail de confirmação no endereço usado no cadastro.
4. Depois disso, é só usar **Entrar** com esse e-mail e senha sempre que precisar acessar o painel.
   (Você pode criar quantas contas quiser — todas elas viram "administradores" do painel.)

## 5. Publicar o app (para o link funcionar fora do seu computador)

A forma mais simples e gratuita é usar a [Vercel](https://vercel.com):

1. Crie uma conta gratuita em https://vercel.com (dá para entrar direto com GitHub).
2. Suba este projeto para um repositório no GitHub (crie um repositório novo e faça upload de todos os arquivos,
   ou use `git init`, `git add .`, `git commit`, `git push` se já souber usar Git).
3. Na Vercel, clique em **Add New → Project**, escolha esse repositório.
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = a URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` = a chave anônima do seu projeto Supabase
5. Clique em **Deploy**. Em cerca de 1 minuto você recebe um link público, por exemplo
   `https://agrc-estetica.vercel.app`.

Esse é o link que você compartilha com os clientes.

## 6. "Instalar" no celular (sem loja de app)

- **Android (Chrome):** abrir o link → menu (⋮) → **Adicionar à tela inicial**.
- **iPhone (Safari):** abrir o link → botão de compartilhar → **Adicionar à Tela de Início**.

O app abre em tela cheia, com ícone próprio, como se fosse baixado de uma loja.

## Sobre as regras de negócio já configuradas

- Atendimento de segunda a sexta, nos horários **08:00** e **13:00**.
- Serviços marcados como "dia todo" (ex: Polimento técnico) bloqueiam o dia inteiro quando agendados,
  e não podem ser marcados em um dia que já tenha outro horário ocupado.
- Cada serviço tem 3 preços (Pequeno / Médio / Grande) — o cliente pode marcar vários serviços no mesmo
  agendamento e o valor final soma tudo, de acordo com o porte do veículo escolhido.
- Só quem faz login no painel pode aprovar, concluir, cancelar ou excluir agendamentos, e editar os serviços.
  Qualquer pessoa com o link pode ver os serviços e criar um novo agendamento (sem precisar de login).

## Estrutura do projeto

```
src/App.jsx            -> toda a interface e lógica do app
src/supabaseClient.js  -> conexão com o Supabase
supabase/schema.sql    -> script para criar as tabelas e regras de segurança
public/                -> ícones e manifesto do PWA
```

## Próximos passos possíveis (não incluídos aqui)

- Enviar mensagem automática no WhatsApp quando um agendamento é criado/aprovado (precisa de uma integração
  como a API oficial do WhatsApp Business ou serviços como Twilio/Z-API).
- Domínio próprio (ex: `agenda.agrcestetica.com.br`) em vez do link `.vercel.app`.
- Notificações push para o dono quando chega um agendamento novo.
