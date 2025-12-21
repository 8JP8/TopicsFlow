
import os

file_path = r"c:\Users\JP\OneDrive - Instituto Superior de Engenharia do Porto\RINTE\TopicsFlow_App\frontend\locales\pt.json"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Indeces are 0-based.
# Line 1577 in 1-based is index 1576.
# 1577: "ticketDesc": ... } },
# Wait, let's verify index 1576 content.
# The user tool view_file said 1577 is "  },"

# We want to keep up to line 1577 (index 1576).
# Insert new content.
# Resume from line 1747 (index 1746).

pre_content = lines[:1577] # 0 to 1576 -> 1577 lines. Last line is index 1576.
post_content = lines[1746:] # 1746 is 1-based 1747.

# Verify split points
print(f"Line 1577 content: {lines[1576]}") # Should be "  },"
print(f"Line 1747 content: {lines[1746]}") # Should be "  "next": "Próximo"," or similar.

# Construct middle content
middle_content = [
    '  "heroSubtitle": "Onde as conversas fluem naturalmente. Uma plataforma de comunidade em tempo real para discussões modernas.",\n',
    '  "metaDescription": "TopicsFlow é uma plataforma de discussão moderna estilo Reddit com salas de chat em tempo real.",\n',
    '  "allRightsReserved": "Todos os direitos reservados.",\n',
    '  "learnMore": "Saber Mais",\n',
    '  "goToDashboard": "Ir para o Dashboard",\n',
    '  "discover": "Descubra a Plataforma",\n',
    '  "redefining": "Redefining Comunidades Online",\n',
    '  "redefiningDesc": "O TopicsFlow não é apenas mais um fórum. É um ecossistema coeso onde discussões estruturadas estilo Reddit encontram o imediatismo das salas de chat em tempo real. Construímos um espaço onde pode aprofundar conteúdos longos ou conviver em canais ao vivo, tudo com uma interface moderna e fluida.",\n',
    '  "everything": "Tudo o que Precisa",\n',
    '  "everythingDesc": "Explore as funcionalidades poderosas que tornam o TopicsFlow único.",\n',
    '  "takeTour": "Faça um Tour",\n',
    '  "tour": {\n',
    '    "sidebarTitle": "Barra Lateral de Navegação",\n',
    '    "sidebarDesc": "Aceda a diferentes tópicos, os seus temas e filtre discussões por tags aqui.",\n',
    '    "createTopicTitle": "Criar Tópicos",\n',
    '    "createTopicDesc": "Inicie o seu próprio tópico de discussão. Pode defini-lo como público ou apenas por convite, e até ativar publicações anónimas.",\n',
    '    "notificationsTitle": "Notificações",\n',
    '    "notificationsDesc": "Mantenha-se atualizado com menções, mensagens e convites. Pode ver todos eles no modal dedicado.",\n',
    '    "profileTitle": "O Seu Perfil",\n',
    '    "profileDesc": "Gerencie as suas configurações de conta, identidades anónimas e preferências aqui.",\n',
    '    "discussionTitle": "Área de Discussão",\n',
    '    "discussionDesc": "É aqui que a magia acontece. Selecione um tópico para ver as publicações e conversar em tempo real.",\n',
    '    "adminTitle": "Painel de Administração",\n',
    '    "adminDesc": "Aceda a ferramentas de moderação, relatórios e estatísticas da plataforma.",\n',
    '    "themeTitle": "Tema",\n',
    '    "themeDesc": "Alterne entre os modos claro e escuro para melhor conforto visual.",\n',
    '    "invitationsTitle": "Convites",\n',
    '    "invitationsDesc": "Gerencie convites para tópicos e salas de chat.",\n',
    '    "languageTitle": "Idioma",\n',
    '    "languageDesc": "Alterne entre Inglês e Português.",\n',
    '    "continueToSettings": "Configure a Sua Experiência",\n',
    '    "continueToSettingsDesc": "Clique aqui e selecione \\"Definições\\" para continuar a visita guiada e personalizar o seu perfil e preferências.",\n',
    '    "continueButton": "Continuar para Definições",\n',
    '    "settingsTabsTitle": "Navegação de Definições",\n',
    '    "settingsTabsDesc": "Navegue entre Preferências, Detalhes da conta, Definições de privacidade e Identidades anónimas.",\n',
    '    "accountTabTitle": "Definições de Conta",\n',
    '    "accountTabDesc": "Gerencie as suas informações de perfil, email e password.",\n',
    '    "privacyTabTitle": "Definições de Privacidade",\n',
    '    "privacyTabDesc": "Controle quem pode ver a sua atividade e gerencie utilizadores bloqueados.",\n',
    '    "anonymousTabTitle": "Identidades Anónimas",\n',
    '    "anonymousTabDesc": "Crie e gerencie os seus pseudónimos para diferentes tópicos.",\n',
    '    "blockedUsersTitle": "Utilizadores Bloqueados",\n',
    '    "blockedUsersDesc": "Veja e gerencie utilizadores que bloqueou.",\n',
    '    "hiddenContentTitle": "Conteúdo Oculto",\n',
    '    "hiddenContentDesc": "Gerencie tópicos e publicações que ocultou.",\n',
    '    "deleteAccountTitle": "Eliminar Conta",\n',
    '    "deleteAccountDesc": "Elimine permanentemente a sua conta e todos os dados associados.",\n',
    '    "editProfileTitle": "Editar Perfil",
    '    "editProfileDesc": "Atualize as suas informações pessoais e avatar aqui.",\n',
    '    "contentSafetyTitle": "Conteúdo e Segurança",\n',
    '    "contentSafetyDesc": "Faça a gestão de utilizadores bloqueados, itens ocultos e conteúdo seguido facilmente.",\n',
    '    "settingsCompleteTitle": "Visita Guiada Concluída",\n',
    '    "settingsCompleteDesc": "Você representa o coração da nossa comunidade. Desfrute do TopicsFlow!",\n',
    '    "searchTitle": "Pesquisar Tópicos",\n',
    '    "searchDesc": "Encontre tópicos rapidamente por nome ou descrição.",\n',
    '    "sortTitle": "Ordenar Tópicos",\n',
    '    "sortDesc": "Ordene os tópicos por atividade, popularidade ou data de criação.",\n',
    '    "tagsTitle": "Filtrar por Tags",\n',
    '    "tagsDesc": "Clique nas tags para filtrar os tópicos por categoria.",\n',
    '    "anonymousModeTitle": "Modo Anónimo",\n',
    '    "anonymousModeDesc": "Alterne o modo anónimo para participar sem revelar a sua identidade.",\n',
    '    "messagesTabTitle": "Mensagens Privadas",\n',
    '    "messagesTabDesc": "Mude para o separador de mensagens para conversar em privado com outros utilizadores.",\n',
    '    "messagesListTitle": "Conversas",\n',
    '    "messagesListDesc": "Selecione uma conversa para começar a conversar.",\n',
    '    "messageInputTitle": "Enviar Mensagem",\n',
    '    "messageInputDesc": "Digite a sua mensagem, envie GIFs ou anexe ficheiros aqui."\n',
    '  },\n'
]

# Combine
new_lines = pre_content + middle_content + post_content

# Write
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("File updated successfully.")
