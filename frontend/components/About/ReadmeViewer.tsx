import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronDown, ChevronUp, Github, FileText } from 'lucide-react';

const ReadmeViewer: React.FC = () => {
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);

    const readmeContent = `# TopicsFlow - Reddit-Style Discussion Platform

A comprehensive Reddit-style discussion platform with authenticator-based authentication, real-time messaging, theme management, posts and comments system, chat rooms, moderation system, anonymous mode, and PWA capabilities.

## Features

### 🔐 Security & Authentication
- **TOTP-based 2FA** with Google/Microsoft Authenticator compatibility
- **Account Recovery** via SMS verification and security questions
- **Backup Codes** for account access when authenticator is unavailable
- **Secure Session Management** with proper encryption
- **Multi-identifier Banning** (IP, email, phone) for moderators

### 💬 Real-time Chat
- **WebSocket Communication** via Socket.IO
- **Topic-based Chat Rooms** with unlimited participants
- **Chatroom Customization**: Upload profile pictures and background images
- **Anonymous Mode** with per-topic fake usernames
- **Private Messaging** between users with "Delete for me" functionality
- **Message Types**: Text, emojis, GIFs (Tenor integration), images, videos, files
- **File Attachments**: Images and videos stored externally with deduplication (local filesystem or Azure Blob Storage)
- **Media Viewing**: Full-screen image viewer and enhanced video player with download/share options
- **Typing Indicators** and user presence
- **Content Filtering**: Links blocked, profanity filtered
- **Message Management**: Delete messages with reason (for owners/moderators), report messages

### 📝 Topic Management
- **Public Topics** that anyone can join
- **Topic Creation** with titles, descriptions, and tags
- **Topic Sorting**: By activity, member count, or creation date
- **Search & Filtering**: By name, tags, or content
- **Topic Ownership**: Creator has full control and moderation powers

### 🛡️ Moderation System
- **Multi-level Permissions**: Owner (3) → Moderator (2) → User (1)
- **Comprehensive Reporting System**: Report users, messages, posts, comments, chatrooms, chatroom backgrounds, and chatroom pictures
- **Context-Aware Reports**: Attach message history, owner/moderator information for admin analysis
- **Moderation Actions**: Delete messages (with reason for owners), ban users, timeout users, warn users
- **Ban Management**: Temporary and permanent bans with detailed reasons
- **Report Review Interface** for moderators and owners with predefined warnings
- **Content Management**: Silence/hide topics, posts, and chats per user

### 🎨 User Experience
- **Dark/Light Themes** with smooth transitions and harmonized blue/purple color scheme
- **Internationalization**: Full English and Portuguese support with comprehensive translations
- **PWA Support**: Install on any device with native browser install prompts and notifications
- **Responsive Design**: Mobile, tablet, and desktop optimized
- **Real-time Notifications**: For messages, mentions, and reports
- **Hidden Items Management**: Organize hidden private messages, publications, chatrooms, and topics with category separators
- **User Profile Pictures**: Upload, update, and delete profile pictures (stored as binary in database)
- **Chatroom Visuals**: Custom profile pictures and background images with dimming overlay
- **Media Handling**: Secure file storage with encryption keys, deduplication, and Azure Blob Storage support

## Technology Stack

### Backend
- **Flask** (Python web framework)
- **Flask-SocketIO** (real-time WebSocket communication)
- **MongoDB** (NoSQL database)
- **PyOTP** (TOTP authentication)
- **Redis** (session storage and caching)

### Frontend
- **Next.js** with TypeScript
- **Socket.IO Client** (real-time communication)
- **Tailwind CSS** (styling with theme variables)
- **React Hot Toast** (notifications)
- **PWA** capabilities with service workers and native install prompts
- **Image Viewer Modal**: Full-screen image viewing with download controls
- **Enhanced Video Player**: Fullscreen support, download, and right-click context menu
- **Context Menus**: Right-click menus for posts, messages, chatrooms, and users

### Infrastructure
- **Docker** with multi-stage builds
- **Docker Compose** for orchestration
- **Nginx** reverse proxy (production)
- **Environment-based configuration**

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- Git

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd RINTEP2
   \`\`\`

2. **Start the application**
   \`\`\`bash
   ./START.sh
   \`\`\`

   This will:
   - Check prerequisites
   - Set up environment variables
   - Create necessary directories
   - Start all services (MongoDB, Redis, Backend, Frontend)
   - Wait for services to be healthy

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MongoDB: localhost:27017
   - Redis: localhost:6379

### Manual Setup (Alternative)

If you prefer to set up manually:

1. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

2. **Start services with Docker Compose**
   \`\`\`bash
   docker-compose up --build
   \`\`\`

3. **Or run locally for development**

   **Backend:**
   \`\`\`bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   pip install -r requirements.txt
   python app.py
   \`\`\`

   **Frontend:**
   \`\`\`bash
   cd frontend
   npm install
   npm run dev
   \`\`\`
`;

    return (
        <div className="max-w-6xl mx-auto mb-20 p-8 bg-slate-800/30 rounded-[3rem] border border-slate-700/50 backdrop-blur-sm relative overflow-hidden">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Project Documentation</h2>
                            <p className="text-slate-400 text-sm">Read the latest documentation directly from GitHub</p>
                        </div>
                    </div>

                    <a
                        href="https://github.com/8JP8/TopicsFlow"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl flex items-center gap-2 transition-all group"
                    >
                        <Github className="w-5 h-5 text-slate-300 group-hover:text-white" />
                        <span className="text-slate-300 group-hover:text-white font-medium">View on GitHub</span>
                    </a>
                </div>

                <div
                    className={`
                        prose prose-invert max-w-none 
                        prose-headings:text-slate-200 prose-headings:font-bold prose-headings:scroll-mt-24
                        prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-800
                        prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-blue-200
                        prose-h3:text-xl prose-h3:mt-8 prose-h3:text-cyan-200
                        prose-p:text-slate-400 prose-p:leading-relaxed
                        prose-li:text-slate-400
                        prose-code:text-blue-300 prose-code:bg-slate-900/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl
                        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-slate-200
                        prose-table:border-collapse prose-th:text-left prose-th:p-4 prose-th:bg-slate-800/50 prose-td:p-4 prose-td:border-b prose-td:border-slate-800
                        transition-all duration-700 ease-in-out relative
                        ${isExpanded ? 'active' : 'max-h-[500px] overflow-hidden mask-bottom'}
                    `}
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {readmeContent}
                    </ReactMarkdown>

                    {/* Fade overlay when collapsed */}
                    {!isExpanded && (
                        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
                    )}
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 rounded-full font-medium transition-all group border border-blue-600/20 hover:border-blue-500/30"
                    >
                        {isExpanded ? (
                            <>
                                <span>Show Less</span>
                                <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                            </>
                        ) : (
                            <>
                                <span>Read Full Documentation</span>
                                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReadmeViewer;
