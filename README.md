# AGRC Estética Automotiva — App de agendamento

App web instalável (PWA) para clientes agendarem serviços e para o dono aprovar tudo em um painel próprio.

- **Agendar**: qualquer visitante escolhe um ou mais serviços, o veículo, a data (seg. a sex., 08:00 ou 13:00) e confirma — sem precisar de conta.
- **Meus agendamentos**: tela do cliente, só acessível depois de criar conta e entrar. Mostra o histórico com status e permite cancelar um agendamento futuro.
- **Painel**: exclusivo do administrador (o dono). Aceita/rejeita agendamentos pendentes, conclui os confirmados e gerencia os serviços/preços.
- Dados ficam guardados no [Supabase](https://supabase.com) (banco de dados gratuito na nuvem).

## 1. Criar o projeto no Supabase (gratuito)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Escolha um nome (ex: `agrc-estetica`) e uma senha para o banco (guarde essa senha em local seguro).
3. Espere o projeto terminar de ser criado (leva 1-2 minutos).
4. No menu lateral, abra **SQL Editor** → **New query**. Rode, **nesta ordem**, os três scripts da pasta `supabase/`:
   1. [`schema.sql`](./supabase/schema.sql) — cria as tabelas de serviços e agendamentos, com os 5 serviços iniciais.
   2. [`roles.sql`](./supabase/roles.sql) — cria a tabela de perfis (papel de cada conta: cliente ou admin) e as regras de segurança.
   3. [`appointments_client_id.sql`](./supabase/appointments_client_id.sql) — vincula cada agendamento à conta do cliente que o criou.
5. No menu lateral, abra **Settings → API**. Você vai precisar de dois valores:
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

## 4. Criar as contas

- **Cliente**: qualquer pessoa cria a própria conta pela aba **Meus agendamentos** → "Ainda não tem conta? Criar conta" (nome, WhatsApp, e-mail e senha). Toda conta nasce com o papel `cliente`.
- **Administrador (você)**: crie sua conta do mesmo jeito (usando a aba "Meus agendamentos", já que não existe mais cadastro dentro do Painel), depois abra o `roles.sql`, troque `'seu-email@exemplo.com'` pelo seu e-mail e rode o `UPDATE`/`INSERT` de promoção no SQL Editor do Supabase. A partir daí, entrando com esse e-mail na aba **Painel**, você tem acesso total.
- Só quem tem `role = 'admin'` no banco consegue abrir o Painel — um cliente que tentar acessar essa aba vê uma tela de "Acesso restrito", nunca os dados de agendamento de outras pessoas.

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

- Atendimento de segunda a sexta, nos horários **08:00** e **13:00** — e um horário some da lista assim que o momento dele já passou no dia (não dá mais pra agendar "hoje às 08:00" às 20h).
- Serviços marcados como "dia todo" (ex: Polimento técnico) bloqueiam o dia inteiro quando agendados,
  e não podem ser marcados em um dia que já tenha outro horário ocupado.
- Cada serviço tem 3 preços (Pequeno / Médio / Grande) — o cliente pode marcar vários serviços no mesmo
  agendamento e o valor final soma tudo, de acordo com o porte do veículo escolhido.
- Só o administrador pode aceitar/rejeitar, concluir, cancelar ou excluir agendamentos, e editar os serviços.
- Qualquer visitante pode ver os serviços e criar um agendamento sem conta (fica marcado como "convidado" e não some em nenhuma tela de histórico). Se a pessoa estiver logada como cliente no momento do agendamento, ele automaticamente aparece em "Meus agendamentos" dela.
- Um cliente logado só enxerga e cancela os próprios agendamentos — nunca os de outra pessoa.

## Estrutura do projeto

```
src/App.jsx                        -> toda a interface e lógica do app
src/supabaseClient.js              -> conexão com o Supabase
supabase/schema.sql                -> tabelas de serviços e agendamentos
supabase/roles.sql                 -> papéis (cliente/admin) e regras de segurança
supabase/appointments_client_id.sql -> vincula agendamentos à conta do cliente
public/                            -> ícones e manifesto do PWA
```

## Próximos passos possíveis (não incluídos aqui)

- Enviar mensagem automática no WhatsApp quando um agendamento é criado/aprovado (precisa de uma integração
  como a API oficial do WhatsApp Business ou serviços como Twilio/Z-API).
- Domínio próprio (ex: `agenda.agrcestetica.com.br`) em vez do link `.vercel.app`.
- Notificações push para o dono quando chega um agendamento novo.
- Recuperação de senha ("esqueci minha senha") para clientes e admin.

