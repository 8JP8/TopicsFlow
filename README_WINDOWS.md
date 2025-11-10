# 🪟 ChatApp - Guia Rápido para Windows

## 🚀 Início Rápido (3 Passos)

### 1️⃣ Primeiro Uso - Setup Inicial

**Duplo clique em:**
```
quick-setup-windows.bat
```

Isso vai automaticamente:
- ✅ Verificar Python e Docker
- ✅ Criar containers MongoDB e Redis
- ✅ Criar ambiente virtual Python
- ✅ Instalar todas as dependências
- ✅ Criar arquivo de configuração

**Duração:** ~5-10 minutos (primeira vez)

---

### 2️⃣ Iniciar o Backend

**Duplo clique em:**
```
start-backend.bat
```

Isso vai automaticamente:
- ✅ Iniciar MongoDB e Redis
- ✅ Ativar ambiente Python
- ✅ Iniciar o servidor Flask

**Backend estará em:** http://localhost:5000

---

### 3️⃣ Testar se Está Funcionando

**Duplo clique em:**
```
test-backend.bat
```

Ou abra no navegador:
- http://localhost:5000/health
- http://localhost:5000/

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:

### 1. Python 3.11+
- **Download:** https://www.python.org/downloads/
- **Importante:** Durante instalação marque ✅ **"Add Python to PATH"**

### 2. Docker Desktop
- **Download:** https://www.docker.com/products/docker-desktop/
- **Importante:** Abra o Docker Desktop e aguarde inicializar

---

## 📁 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `quick-setup-windows.bat` | Setup inicial (primeira vez) |
| `start-backend.bat` | Iniciar backend |
| `start-mongodb.bat` | Apenas iniciar MongoDB |
| `test-backend.bat` | Testar se está funcionando |
| `stop-all.bat` | Parar todos os serviços |

---

## 🎯 Uso Diário

### Iniciar tudo:
```
Duplo clique: start-backend.bat
```

### Parar tudo:
```
Duplo clique: stop-all.bat
```

Ou pressione **Ctrl+C** na janela do backend.

---

## 🐛 Problemas Comuns

### "Python não é reconhecido"
**Solução:** Reinstale Python e marque "Add Python to PATH"

### "Docker não encontrado"
**Solução:**
1. Instale Docker Desktop
2. Abra o Docker Desktop
3. Aguarde inicializar (ícone ficará verde)

### "Porta 5000 já está em uso"
**Solução:**
```powershell
# PowerShell como Administrador
netstat -ano | findstr :5000
taskkill /PID <número> /F
```

### "Scripts desabilitados no PowerShell"
**Solução:**
```powershell
# PowerShell como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📚 Documentação Completa

Para guia detalhado, veja:
- **START_BACKEND_WINDOWS.md** - Guia completo para Windows
- **START_BACKEND_MANUAL.md** - Guia geral
- **LOCAL_TESTING_GUIDE.md** - Guia de testes

---

## 🔗 URLs Importantes

Depois de iniciar:

- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health
- **API Docs:** http://localhost:5000/

---

## 💡 Dicas

1. **Sempre use os scripts `.bat`** - Eles fazem tudo automaticamente
2. **Execute `quick-setup-windows.bat` apenas uma vez** (primeira vez)
3. **Docker Desktop deve estar aberto** antes de iniciar
4. **Firewall pode pedir permissão** - aceite para localhost

---

## 📊 Estrutura de Pastas

```
RINTEP2/
├── backend/              # Código do backend
│   ├── app.py           # Aplicação principal
│   ├── config.py        # Configurações
│   └── .env             # Variáveis de ambiente (criado automaticamente)
├── frontend/            # Código do frontend
├── start-backend.bat    # ⭐ Iniciar backend
├── test-backend.bat     # ⭐ Testar backend
├── quick-setup-windows.bat  # ⭐ Setup inicial
└── stop-all.bat         # ⭐ Parar serviços
```

---

## ✅ Checklist

Antes de iniciar pela primeira vez:

- [ ] Python 3.11+ instalado
- [ ] Docker Desktop instalado e aberto
- [ ] Executou `quick-setup-windows.bat`
- [ ] Sem erros no setup

Depois do setup:

- [ ] Duplo clique em `start-backend.bat`
- [ ] Backend iniciou sem erros
- [ ] Testou com `test-backend.bat`
- [ ] Health check retorna OK

---

## 🆘 Precisa de Ajuda?

1. Veja a documentação completa: **START_BACKEND_WINDOWS.md**
2. Execute os testes: `test-backend.bat`
3. Verifique troubleshooting na documentação

---

## 🚀 Próximos Passos

Após o backend funcionar:

### Iniciar Frontend (opcional):

```powershell
cd frontend
npm install
npm run dev
```

Acessar: http://localhost:3000

### Usar Docker Compose (tudo junto):

```powershell
docker-compose up
```

---

**Pronto para começar? Execute `quick-setup-windows.bat`!** 🎉
