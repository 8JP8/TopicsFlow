# Frontend Tests

This directory contains frontend tests for the TopicsFlow application.

## Test Files

- `ChatContainer.test.tsx` - Tests for message sending, receiving, and display
- `GifPicker.test.tsx` - Tests for GIF picker component
- `NotificationCenter.test.tsx` - Tests for notification system

## Setup

To run these tests, you'll need to install testing dependencies:

```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom @types/jest
```

## Running Tests

```bash
npm test
```

## Test Coverage

### ChatContainer Tests
- ✅ Renders topic title and description
- ✅ Sends message when form is submitted
- ✅ Displays messages
- ✅ Displays GIFs in messages
- ✅ Highlights mentions in messages

### GifPicker Tests
- ✅ Renders GIF picker
- ✅ Loads trending GIFs on mount
- ✅ Searches GIFs when typing
- ✅ Calls onSelectGif when GIF is clicked

### NotificationCenter Tests
- ✅ Renders notification bell icon
- ✅ Opens notification popup when clicked
- ✅ Listens for private message events
- ✅ Listens for mention events

## Note

These tests are basic examples. You may need to:
1. Install testing dependencies
2. Configure Jest in `package.json` or `jest.config.js`
3. Set up test environment variables
4. Mock additional dependencies (socket.io-client, etc.)

