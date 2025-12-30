# Frontend Architecture

The TopicsFlow frontend is a modern **Next.js** application built with **TypeScript** and **Tailwind CSS**. It focuses on a responsive, real-time user experience.

## 🏗️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Real-time**: `socket.io-client`
- **State Management**: React Context API
- **HTTP Client**: Native `fetch` / `axios`
- **Icons**: Heroicons / FontAwesome

## 📂 Key Directories

### `pages/`
Follows Next.js file-based routing.
- `_app.tsx`: Global app wrapper (Providers, Layout).
- `index.tsx`: Landing page / Dashboard.
- `login.tsx`, `register.tsx`: Authentication pages.
- `topics/[id].tsx`: Topic detail view (Chat/Posts).
- `admin/`: Admin dashboard routes.

### `components/`
Modular UI components.
- **Layout/**: `Navbar`, `Sidebar`, `Footer`.
- **Chat/**: `MessageList`, `MessageInput`, `ChatRoomList`.
- **Topic/**: `TopicCard`, `CreateTopicModal`.
- **UI/**: Generic atomic components (`Button`, `Input`, `Modal`).

### `contexts/`
Global state management using React Context.
- `AuthContext`: Manages user login state, token storage, and user profile.
- `SocketContext`: Manages the single Socket.IO connection instance.
- `UIContext`: Handles global UI state (modals, toasts, themes).

## 🔌 State Management & Data Flow

### Authentication
1. User logs in via `login.tsx`.
2. `AuthContext` receives the user object/token.
3. Token is stored (typically HttpOnly cookie or LocalStorage).
4. `SocketContext` initializes connection using the auth credentials.

### Real-time Updates
The `SocketContext` listens for global events (`new_notification`, `online_count`) and exposes the socket instance.
Individual components (like `ChatRoom`) use `useEffect` to join specific rooms and listen for granular events (`new_message`).

**Pattern:**
```typescript
useEffect(() => {
  if (!socket) return;
  socket.emit('join_topic', { topic_id });
  
  socket.on('new_message', handleNewMessage);
  
  return () => {
    socket.off('new_message', handleNewMessage);
    socket.emit('leave_topic', { topic_id });
  };
}, [socket, topic_id]);
```

## 🎨 Styling (Tailwind CSS)

The project uses a custom Tailwind configuration (`tailwind.config.js`) to define:
- Brand colors (Primary, Secondary, Accent).
- Dark mode variants.
- Custom spacing and typography.

Styles are utility-first, keeping CSS files minimal. Global styles are in `styles/globals.css`.
