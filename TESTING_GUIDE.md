# Quick Testing Guide

## 🚀 Setup (5 minutes)

```bash
# 1. Migrate database
python migrate_database.py migrate

# 2. Make admin user  
python make_admin.py JP8

# 3. Restart backend
cd backend
python app.py

# 4. Access app
http://localhost:3000
```

## ✅ Test Scenarios

### Scenario 1: Admin Controls (2 min)
1. Login as admin
2. Look for shield icon (🛡️) in top bar
3. Click shield → Dropdown opens
4. Should see:
   - Stats grid (4 boxes)
   - "Manage Reports" button
   - "Manage Tickets" button
5. Click "Manage Reports" → Modal opens
6. Close and click "Manage Tickets" → Modal opens
7. ✅ PASS if all modals open correctly

### Scenario 2: Clickable Usernames (2 min)
1. Go to any chat room
2. Find any message
3. Click on the username
4. User banner should appear showing:
   - User avatar
   - Username
   - Join date
   - Buttons: View Profile, Send Message, Report, Block
5. Click "View Profile" → Should navigate
6. ✅ PASS if banner appears and buttons work

### Scenario 3: Clickable Avatars (1 min)
1. In chat room
2. Click on user avatar (circle on left)
3. User banner appears
4. Same as Scenario 2
5. ✅ PASS if banner appears

### Scenario 4: Right-Click Menu (2 min)
1. In chat room
2. Right-click on username
3. Context menu appears with:
   - Send Message
   - Report User
   - Block User
4. Try each option
5. ✅ PASS if all options work

### Scenario 5: Report User (2 min)
1. Right-click username
2. Click "Report User"
3. Report dialog opens
4. Fill reason (10+ chars)
5. Submit
6. Should see success toast
7. As admin: Check reports in admin dashboard
8. ✅ PASS if report appears in admin dashboard

### Scenario 6: Block User (1 min)
1. Right-click username
2. Click "Block User"
3. Should see success toast
4. User is now blocked
5. ✅ PASS if user is blocked

### Scenario 7: @ Mentions (1 min)
1. In chat, hover over any @ mention
2. Tooltip appears
3. Right-click @ mention
4. Context menu appears
5. ✅ PASS if menu works

### Scenario 8: Anonymous Mode (2 min)
1. In chat room
2. Enable "Use Anonymous" toggle
3. Set anonymous name (e.g., "Anonymous123")
4. Send message
5. Message shows with anonymous name
6. "Anonymous" badge visible
7. Try clicking anonymous name → Nothing happens (correct)
8. ✅ PASS if anonymous mode works

### Scenario 9: Ticket Creation (2 min)
1. Click profile menu (top right)
2. Should see "Open Ticket" option
3. Click it
4. Modal opens with form
5. Fill:
   - Category: Bug
   - Subject: "Test ticket"
   - Description: "Testing ticket system"
6. Submit
7. Should see success toast
8. Click profile menu → "My Tickets"
9. Should see your ticket
10. ✅ PASS if ticket appears

### Scenario 10: Admin Ticket Management (2 min)
1. As admin, click shield icon
2. Click "Manage Tickets"
3. Should see all tickets
4. Click on a ticket
5. Should see details
6. Add admin response
7. Update status
8. Save
9. ✅ PASS if ticket is updated

## 🐛 Common Issues

### Issue: Admin button not showing
**Fix**: 
```bash
python make_admin.py --list
# Make sure is_admin: true
```

### Issue: Usernames not clickable
**Fix**: Hard refresh browser (Ctrl+Shift+R)

### Issue: Context menu not appearing
**Fix**: Check console for errors, make sure UserContextMenu.tsx exists

### Issue: Report dialog not opening
**Fix**: Check that ReportUserDialog.tsx exists in components/Reports/

### Issue: Translations missing
**Fix**: Add translations from TRANSLATION_ADDITIONS.md

## 📊 Test Results Template

Copy this and fill out:

```
Test Date: _______________
Tester: _______________

[ ] Scenario 1: Admin Controls - PASS / FAIL
[ ] Scenario 2: Clickable Usernames - PASS / FAIL
[ ] Scenario 3: Clickable Avatars - PASS / FAIL
[ ] Scenario 4: Right-Click Menu - PASS / FAIL
[ ] Scenario 5: Report User - PASS / FAIL
[ ] Scenario 6: Block User - PASS / FAIL
[ ] Scenario 7: @ Mentions - PASS / FAIL
[ ] Scenario 8: Anonymous Mode - PASS / FAIL
[ ] Scenario 9: Ticket Creation - PASS / FAIL
[ ] Scenario 10: Admin Ticket Management - PASS / FAIL

Issues Found:
1. _________________________
2. _________________________
3. _________________________

Overall Status: PASS / FAIL
```

## 🎯 Quick Commands

```bash
# Check status
python migrate_database.py status

# List users
python make_admin.py --list

# Check backend syntax
compile_check.bat

# Start backend
cd backend && python app.py

# Start frontend
cd frontend && npm run dev
```

## ✅ All Tests Passed?

If all scenarios pass:
1. System is ready for production
2. All features working correctly
3. Safe to deploy

If any scenario fails:
1. Note which scenario
2. Check console for errors
3. Check FINAL_CHANGES_SUMMARY.md for details
4. Re-test after fixing

---

**Estimated Testing Time**: 20 minutes  
**Required**: Admin user, running backend/frontend  
**Goal**: Verify all implemented features work correctly
