# GitHub Actions Setup para Azure Deployment

## Configurar Secrets no GitHub

Para o CI/CD funcionar, você precisa configurar os seguintes secrets no GitHub.

### 1. Acessar Configurações de Secrets

1. Vá para seu repositório no GitHub
2. Clique em **Settings** > **Secrets and variables** > **Actions**
3. Clique em **New repository secret**

### 2. Secrets Necessários

#### AZURE_CREDENTIALS

Credenciais para autenticação no Azure:

```bash
# Criar Service Principal
az ad sp create-for-rbac \
  --name "chatapp-github-actions" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group} \
  --sdk-auth

# O comando acima retorna um JSON. Copie TODO o JSON e cole no secret
```

Exemplo do JSON:
```json
{
  "clientId": "xxxx",
  "clientSecret": "xxxx",
  "subscriptionId": "xxxx",
  "tenantId": "xxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

#### AZURE_CONTAINER_REGISTRY

Nome do Azure Container Registry (sem .azurecr.io):

```bash
# Exemplo
chatappacr
```

#### AZURE_RESOURCE_GROUP

Nome do Resource Group:

```bash
# Exemplo
chatapp-rg
```

#### AZURE_APP_NAME

Nome do Container App:

```bash
# Exemplo
chatapp
```

#### ACR_USERNAME

Username do Azure Container Registry:

```bash
# Obter username
az acr credential show --name {registry-name} --query username --output tsv
```

#### ACR_PASSWORD

Password do Azure Container Registry:

```bash
# Obter password
az acr credential show --name {registry-name} --query passwords[0].value --output tsv
```

## Script Automático para Criar Secrets

Crie um arquivo `setup-github-secrets.sh`:

```bash
#!/bin/bash

# Configurar variáveis
REPO_OWNER="seu-username"
REPO_NAME="seu-repositorio"
SUBSCRIPTION_ID="sua-subscription-id"
RESOURCE_GROUP="chatapp-rg"
ACR_NAME="chatappacr"

# Obter GitHub token
echo "Crie um GitHub Personal Access Token em:"
echo "https://github.com/settings/tokens/new"
echo "Com permissão: repo (full)"
echo ""
read -p "Cole seu GitHub token: " GITHUB_TOKEN

# Criar Service Principal
echo "Criando Service Principal..."
AZURE_CREDS=$(az ad sp create-for-rbac \
  --name "chatapp-github-actions" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth)

# Obter ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# Função para criar secret
create_secret() {
  local secret_name=$1
  local secret_value=$2

  echo "Criando secret: $secret_name"

  curl -X PUT \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/$secret_name" \
    -d "{\"encrypted_value\":\"$(echo -n "$secret_value" | base64)\",\"key_id\":\"\"}"
}

# Criar todos os secrets
create_secret "AZURE_CREDENTIALS" "$AZURE_CREDS"
create_secret "AZURE_CONTAINER_REGISTRY" "$ACR_NAME"
create_secret "AZURE_RESOURCE_GROUP" "$RESOURCE_GROUP"
create_secret "AZURE_APP_NAME" "chatapp"
create_secret "ACR_USERNAME" "$ACR_USERNAME"
create_secret "ACR_PASSWORD" "$ACR_PASSWORD"

echo "✅ Secrets configurados com sucesso!"
```

## Verificar Secrets Configurados

No GitHub:
1. **Settings** > **Secrets and variables** > **Actions**
2. Você deve ver:
   - ✅ AZURE_CREDENTIALS
   - ✅ AZURE_CONTAINER_REGISTRY
   - ✅ AZURE_RESOURCE_GROUP
   - ✅ AZURE_APP_NAME
   - ✅ ACR_USERNAME
   - ✅ ACR_PASSWORD

## Testar GitHub Actions

### Método 1: Push para Branch

```bash
git add .
git commit -m "Setup Azure deployment"
git push origin azuredeployment
```

### Método 2: Manual Trigger

1. Vá para **Actions** no GitHub
2. Selecione **Deploy to Azure Container Apps**
3. Clique em **Run workflow**
4. Selecione o branch e clique em **Run workflow**

## Workflow

O workflow faz automaticamente:

1. ✅ **Checkout** do código
2. ✅ **Build** da imagem Docker
3. ✅ **Push** para Azure Container Registry
4. ✅ **Deploy** no Azure Container Apps
5. ✅ **Health Check** da aplicação
6. ✅ **Summary** com URL e detalhes

## Ver Logs do Deployment

1. Vá para **Actions** no GitHub
2. Clique no workflow em execução
3. Veja os logs de cada step

## Personalizar Workflow

### Deploy apenas em produção

Edite `.github/workflows/azure-deploy.yml`:

```yaml
on:
  push:
    branches:
      - main  # Apenas branch main
```

### Adicionar notificações

Adicione step de notificação:

```yaml
- name: Send notification
  if: success()
  run: |
    curl -X POST https://your-webhook-url \
      -H 'Content-Type: application/json' \
      -d '{"text":"✅ Deployment successful!"}'
```

### Adicionar testes

O workflow já tem um job de testes opcional. Para habilitar:

```yaml
build-and-deploy:
  needs: test  # Adicione esta linha
  runs-on: ubuntu-latest
```

## Troubleshooting

### Erro: "Authentication failed"

Verificar AZURE_CREDENTIALS:
```bash
# Recriar Service Principal
az ad sp create-for-rbac --name "chatapp-github-actions" --role contributor --scopes /subscriptions/{sub-id} --sdk-auth
```

### Erro: "ACR login failed"

Verificar credenciais:
```bash
# Obter novas credenciais
az acr credential show --name {acr-name}
```

### Erro: "Container App not found"

Verificar nome do app:
```bash
# Listar apps
az containerapp list --resource-group {rg-name} --query "[].name"
```

## Segurança

### Rotação de Secrets

Recomendado rotacionar secrets a cada 90 dias:

```bash
# Rotacionar ACR password
az acr credential renew --name {acr-name} --password-name password
```

### Service Principal com Permissões Mínimas

Ao invés de `contributor`, use permissões específicas:

```bash
az ad sp create-for-rbac \
  --name "chatapp-github-actions" \
  --role "AcrPush" \
  --scopes /subscriptions/{sub-id}/resourceGroups/{rg-name}/providers/Microsoft.ContainerRegistry/registries/{acr-name}
```

## Monitorar Deployments

### Deployment History

Ver histórico no GitHub Actions:
- **Actions** > **All workflows** > **Deploy to Azure Container Apps**

### Rollback

Para fazer rollback para uma versão anterior:

```bash
# Listar revisões
az containerapp revision list \
  --name chatapp \
  --resource-group chatapp-rg

# Ativar revisão anterior
az containerapp revision activate \
  --name chatapp \
  --resource-group chatapp-rg \
  --revision chatapp--{previous-revision}
```

## Recursos

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Azure Login Action](https://github.com/Azure/login)
- [Azure CLI Action](https://github.com/Azure/CLI)
