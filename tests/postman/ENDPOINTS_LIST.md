# Complete API Endpoints List

This document lists all 217+ API endpoints that should be included in the Postman collection.

## Summary
- **Total Endpoints**: 217
- **Categories**: 15
- **Last Updated**: Based on current codebase analysis

## Endpoint Categories

### 1. Authentication (33 endpoints)
- POST /api/auth/register
- POST /api/auth/login-passwordless
- POST /api/auth/login
- POST /api/auth/login-backup
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/verify-totp
- POST /api/auth/backup-codes
- POST /api/auth/change-password
- PUT /api/auth/preferences
- POST /api/auth/recovery/initiate
- POST /api/auth/recovery/verify-sms
- POST /api/auth/recovery/verify-questions
- POST /api/auth/recovery/confirm-totp
- GET /api/auth/session
- POST /api/auth/register-passwordless
- POST /api/auth/verify-email
- POST /api/auth/resend-verification
- POST /api/auth/complete-totp-setup
- POST /api/auth/login-passwordless-backup
- POST /api/auth/recovery/initiate-passwordless
- POST /api/auth/recovery/verify-email-code
- POST /api/auth/recovery/reset-totp
- POST /api/auth/recovery/complete-totp-setup
- POST /api/auth/recovery-code/set
- POST /api/auth/recovery/verify-user-code
- POST /api/auth/passkey/register-options
- POST /api/auth/passkey/register-verify
- POST /api/auth/passkey/auth-options
- POST /api/auth/passkey/auth-verify
- GET /api/auth/passkey/list
- DELETE /api/auth/passkey/{credential_id}
- POST /api/auth/totp/qrcode

### 2. Topics (20 endpoints)
- GET /api/topics
- POST /api/topics
- GET /api/topics/{topic_id}
- PUT /api/topics/{topic_id}
- DELETE /api/topics/{topic_id}
- POST /api/topics/{topic_id}/join
- POST /api/topics/{topic_id}/leave
- GET /api/topics/{topic_id}/moderators
- POST /api/topics/{topic_id}/moderators
- DELETE /api/topics/{topic_id}/moderators/{moderator_id}
- POST /api/topics/{topic_id}/ban
- POST /api/topics/{topic_id}/unban
- POST /api/topics/{topic_id}/transfer-ownership
- GET /api/topics/my
- GET /api/topics/{topic_id}/anonymous-identity
- POST /api/topics/{topic_id}/anonymous-identity
- PUT /api/topics/{topic_id}/anonymous-identity
- POST /api/topics/{topic_id}/mute
- POST /api/topics/{topic_id}/unmute
- POST /api/topics/{topic_id}/invite

### 3. Messages (14 endpoints)
- GET /api/messages/topic/{topic_id}
- POST /api/messages/topic/{topic_id}
- GET /api/messages/{message_id}
- DELETE /api/messages/{message_id}
- POST /api/messages/{message_id}/report
- GET /api/messages/{message_id}/reports
- GET /api/messages/topic/{topic_id}/search
- GET /api/messages/user/{user_id}
- GET /api/messages/topic/{topic_id}/stats
- GET /api/messages/topic/{topic_id}/user/{user_id}/count
- GET /api/messages/private
- POST /api/messages/private
- GET /api/messages/private/conversations
- POST /api/messages/private/{message_id}/read

### 4. Private Messages (4 endpoints - already covered in Messages)
(Included in Messages section)

### 5. Posts (8 endpoints)
- GET /api/posts/recent
- GET /api/posts/topics/{topic_id}/posts
- POST /api/posts/topics/{topic_id}/posts
- GET /api/posts/{post_id}
- POST /api/posts/{post_id}/upvote
- POST /api/posts/{post_id}/downvote
- DELETE /api/posts/{post_id}
- POST /api/posts/{post_id}/report

### 6. Comments (8 endpoints)
- GET /api/comments/posts/{post_id}/comments
- POST /api/comments/posts/{post_id}/comments
- POST /api/comments/{comment_id}/reply
- GET /api/comments/{comment_id}
- POST /api/comments/{comment_id}/upvote
- POST /api/comments/{comment_id}/downvote
- DELETE /api/comments/{comment_id}
- POST /api/comments/{comment_id}/report

### 7. Chat Rooms (23 endpoints)
- GET /api/chat-rooms/topics/{topic_id}/conversations
- POST /api/chat-rooms/topics/{topic_id}/conversations
- GET /api/chat-rooms/{room_id}
- POST /api/chat-rooms/{room_id}/join
- POST /api/chat-rooms/{room_id}/leave
- GET /api/chat-rooms/{room_id}/messages
- POST /api/chat-rooms/{room_id}/messages
- DELETE /api/chat-rooms/{room_id}/messages/{message_id}
- GET /api/chat-rooms/{room_id}/members
- DELETE /api/chat-rooms/{room_id}
- POST /api/chat-rooms/{room_id}/moderators
- DELETE /api/chat-rooms/{room_id}/moderators/{moderator_id}
- POST /api/chat-rooms/{room_id}/ban/{user_id}
- POST /api/chat-rooms/{room_id}/unban/{user_id}
- POST /api/chat-rooms/{room_id}/kick/{user_id}
- POST /api/chat-rooms/{room_id}/mute
- POST /api/chat-rooms/{room_id}/unmute
- POST /api/chat-rooms/{room_id}/invite
- GET /api/chat-rooms/invitations
- POST /api/chat-rooms/invitations/{invitation_id}/accept
- POST /api/chat-rooms/invitations/{invitation_id}/decline
- PUT /api/chat-rooms/{room_id}/picture
- PUT /api/chat-rooms/{room_id}/background

### 8. Users (44 endpoints)
- GET /api/users/profile
- PUT /api/users/profile
- GET /api/users/topics
- GET /api/users/anonymous-identities
- DELETE /api/users/anonymous-identities/{topic_id}
- GET /api/users/private-messages/conversations
- GET /api/users/private-messages/{user_id}
- GET /api/users/private-messages/unread-count
- POST /api/users/private-messages/{user_id}/read
- POST /api/users/private-messages/{user_id}/mute
- POST /api/users/private-messages/{message_id}/delete-for-me
- POST /api/users/private-messages/{message_id}/restore-for-me
- GET /api/users/private-messages/deleted
- DELETE /api/users/private-messages/{user_id}
- GET /api/users/friends
- GET /api/users/friends/requests
- POST /api/users/friends/request
- POST /api/users/friends/request/{request_id}/accept
- POST /api/users/friends/request/{request_id}/reject
- POST /api/users/friends/request/{request_id}/cancel
- DELETE /api/users/friends/{friend_id}
- GET /api/users/search
- GET /api/users/search-for-mention
- GET /api/users/stats
- GET /api/users/online
- POST /api/users/check-username
- POST /api/users/check-email
- POST /api/users/topics/{topic_id}/mute
- POST /api/users/topics/{topic_id}/unmute
- POST /api/users/chat-rooms/{chat_room_id}/mute
- POST /api/users/chat-rooms/{chat_room_id}/unmute
- POST /api/users/posts/{post_id}/mute
- POST /api/users/posts/{post_id}/unmute
- POST /api/users/chats/{chat_id}/mute
- POST /api/users/chats/{chat_id}/unmute
- POST /api/users/{user_id}/block
- DELETE /api/users/{user_id}/unblock
- POST /api/users/{user_id}/unblock
- GET /api/users/blocked
- GET /api/users/username/{username}
- GET /api/users/{user_id}
- POST /api/users/dismiss-warning
- POST /api/users/clear-warning
- POST /api/users/{user_id}/report-profile-image

### 9. Friends (10 endpoints)
- POST /api/friends/requests/send
- POST /api/friends/requests/{request_id}/accept
- POST /api/friends/requests/{request_id}/reject
- DELETE /api/friends/requests/{request_id}/cancel
- GET /api/friends/requests/pending
- GET /api/friends/requests/sent
- GET /api/friends
- DELETE /api/friends/{friend_id}
- GET /api/friends/check/{user_id}
- GET /api/friends/count

### 10. Reports (11 endpoints)
- POST /api/reports
- GET /api/reports/my-reports
- GET /api/reports
- GET /api/reports/{report_id}
- POST /api/reports/{report_id}/review
- POST /api/reports/{report_id}/dismiss
- POST /api/reports/{report_id}/escalate
- GET /api/reports/statistics
- GET /api/reports/recent
- GET /api/reports/my
- DELETE /api/reports/{report_id}

### 11. Tickets (7 endpoints)
- POST /api/tickets
- GET /api/tickets/my-tickets
- GET /api/tickets/my
- GET /api/tickets/{ticket_id}
- PUT /api/tickets/{ticket_id}
- DELETE /api/tickets/{ticket_id}
- GET /api/tickets/categories

### 12. GIFs (6 endpoints)
- GET /api/gifs/search
- GET /api/gifs/trending
- GET /api/gifs/popular
- GET /api/gifs/recent
- GET /api/gifs/categories
- POST /api/gifs/register-share

### 13. Content Settings (10 endpoints)
- POST /api/content-settings/topics/{topic_id}/silence
- POST /api/content-settings/topics/{topic_id}/unsilence
- POST /api/content-settings/topics/{topic_id}/hide
- POST /api/content-settings/topics/{topic_id}/unhide
- POST /api/content-settings/posts/{post_id}/silence
- POST /api/content-settings/posts/{post_id}/unsilence
- POST /api/content-settings/posts/{post_id}/hide
- POST /api/content-settings/posts/{post_id}/unhide
- GET /api/content-settings/hidden-items
- GET /api/content-settings/silenced-items

### 14. Admin (21 endpoints)
- GET /api/admin/reports
- POST /api/admin/reports/{report_id}/dismiss
- POST /api/admin/reports/{report_id}/action
- POST /api/admin/reports/{report_id}/reopen
- GET /api/admin/tickets
- PUT /api/admin/tickets/{ticket_id}
- POST /api/admin/users/{user_id}/ban
- POST /api/admin/users/{user_id}/unban
- GET /api/admin/users/banned
- GET /api/admin/users/{user_id}/messages
- GET /api/admin/deleted-messages
- POST /api/admin/deleted-messages/{message_id}/permanent-delete
- POST /api/admin/deleted-messages/cleanup-expired
- GET /api/admin/pending-deletions
- POST /api/admin/topics/{topic_id}/approve-deletion
- POST /api/admin/topics/{topic_id}/reject-deletion
- POST /api/admin/posts/{post_id}/approve-deletion
- POST /api/admin/posts/{post_id}/reject-deletion
- POST /api/admin/chatrooms/{room_id}/approve-deletion
- POST /api/admin/chatrooms/{room_id}/reject-deletion
- GET /api/admin/stats

### 15. Attachments (2 endpoints)
- GET /api/attachments/{file_id}
- GET /api/attachments/{file_id}/info

## Total: 217 endpoints

All endpoints should be included in the Postman collection with:
- Proper HTTP methods
- Correct paths with path variables
- Request bodies for POST/PUT/PATCH where applicable
- Query parameters where applicable
- Basic test scripts
- Descriptions

