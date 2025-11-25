# Correções de Estrutura - TopicsFlow

## Estrutura Correta

**Topics** (Containers principais)
  └── **Themes** (Reddit-style - Posts e Comments)
  └── **Conversations** (Discord-style - Chat Rooms)

## Mudanças Necessárias

### Backend Models

1. ✅ **Topic** - Adicionado `theme_count` e `conversation_count`
2. ✅ **Theme** - Agora requer `topic_id` (dentro de Topic)
3. ✅ **ChatRoom** - Agora requer `topic_id` (dentro de Topic)
4. ⏳ **Post** - Já está correto (dentro de Theme)

### Backend Routes

1. ⏳ `/api/topics` - Listar Topics
2. ⏳ `/api/topics/<topic_id>/themes` - Listar Themes dentro de Topic
3. ⏳ `/api/topics/<topic_id>/conversations` - Listar Conversations dentro de Topic
4. ⏳ `/api/themes` - Atualizar para requerer `topic_id`
5. ⏳ `/api/chat-rooms` - Atualizar para requerer `topic_id`

### Frontend

1. ⏳ Sidebar com estrutura: Topics > Themes/Conversations
2. ⏳ Layout não full-screen, sidebar sempre visível
3. ⏳ Corrigir todos os ícones
4. ⏳ Abordagem Reddit para Themes
5. ⏳ Abordagem Discord para Conversations

### Testes Postman

1. ⏳ Criar testes para Topics
2. ⏳ Criar testes para Themes dentro de Topics
3. ⏳ Criar testes para Conversations dentro de Topics
4. ⏳ Criar testes para Posts dentro de Themes
5. ⏳ Criar testes para Comments dentro de Posts


