# Publicando as Edge Functions no Supabase auto-hospedado

O erro:

```
InvalidWorkerCreation: worker boot error: failed to bootstrap runtime:
could not find an appropriate entrypoint
```

significa que o container `supabase-edge-functions` **não encontrou o arquivo
`index.ts` da função** — ou seja, a função ainda não foi publicada no servidor.

## Opção A — Supabase CLI (recomendado)

Na máquina onde está o código do projeto:

```bash
# 1. Autentique no seu servidor (não precisa de login na nuvem)
export SUPABASE_ACCESS_TOKEN=""   # não é usado no self-hosted

# 2. Publique apontando para a sua instância
supabase functions deploy send-test-email \
  --project-ref default \
  --no-verify-jwt
```

> Em muitas instalações self-hosted o `functions deploy` do CLI não funciona.
> Nesse caso use a Opção B, que é o método oficial do docker-compose.

## Opção B — Copiar os arquivos para o volume (docker-compose)

O stack self-hosted monta a pasta `volumes/functions` dentro do container.
A estrutura esperada é `volumes/functions/<nome-da-funcao>/index.ts`.

```bash
# No servidor, dentro da pasta do docker-compose do Supabase:
mkdir -p volumes/functions/send-test-email

# Copie o arquivo index.ts do projeto para lá
scp supabase/functions/send-test-email/index.ts \
    usuario@servidor:/caminho/supabase/docker/volumes/functions/send-test-email/index.ts

# Reinicie o runtime de funções
docker compose restart functions
# (em algumas versões o serviço se chama edge-functions)
docker compose restart edge-functions
```

Verifique os logs:

```bash
docker compose logs -f functions
```

## Testando manualmente

```bash
curl -i -X POST \
  "https://supabase.vps10409.panel.icontainer.cloud/functions/v1/send-test-email" \
  -H "Authorization: Bearer <ACCESS_TOKEN_DO_USUARIO_LOGADO>" \
  -H "Content-Type: application/json" \
  -d '{"destinatario":"voce@exemplo.com"}'
```

Retorno esperado: `{"ok":true}`.

## Observações

- A função usa as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
  `SUPABASE_SERVICE_ROLE_KEY`, que já são injetadas pelo docker-compose padrão.
- O envio usa o SMTP gravado na tabela `app_email_settings`
  (Configurações → E-mail), e não variáveis de ambiente.
- Se o container não tiver acesso à internet na porta SMTP, o envio falha com
  timeout de conexão — libere a saída para o host/porta do seu provedor.
