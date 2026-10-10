# EasyDrop

## What EasyDrop Does
EasyDrop is a clean, modern, browser-to-browser file sharing application. It allows a sender to select files and generate a temporary QR code. The receiver scans the QR code on another device, reviews the file list, and approves the transfer. Files are then transferred directly between the two browsers using WebRTC peer-to-peer data channels without being permanently stored on any server.

## Technologies Used
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **Signaling**: Socket.IO
- **Peer-to-Peer**: WebRTC (Data Channels)
- **Utilities**: JSZip (for downloading received files as an archive), qrcode-generator

## Folder Structure

```text
EasyDrop/
├── server.js
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
│
├── public/
│   ├── index.html
│   │
│   ├── pages/
│   │   ├── create-transfer.html
│   │   └── session.html
│   │
│   ├── css/
│   │   ├── style.css
│   │   └── transfer.css
│   │
│   ├── js/
│   │   ├── main.js
│   │   ├── session.js
│   │   ├── qr.js
│   │   └── transfer.js
│   │
│   └── assets/
│       ├── logo.svg
│       └── icons/
│
└── server/
    ├── sessions.js
    ├── signaling.js
    └── cleanup.js
```

## File Purposes
- **`server.js`**: Main entry point for the Express server. It serves static assets from `public/` and mounts the Socket.IO signaling server.
- **`public/index.html`**: The landing page detailing features, security, and how the app works.
- **`public/pages/create-transfer.html`**: The UI for selecting files, previewing them, and generating a temporary QR code session.
- **`public/pages/session.html`**: The receiver's UI for joining a session, reviewing the sender's files, approving the transfer, and downloading the files.
- **`public/js/session.js`**: Core class (`EasyDropSession`) handling WebRTC peer connection logic, ICE candidates, file chunking, and Socket.IO signaling.
- **`public/js/transfer.js`**: UI bindings for the sender and receiver flows, linking DOM events to the `EasyDropSession` instance.
- **`server/sessions.js`**: In-memory store for active transfer sessions, including temporary tokens for authorization.
- **`server/signaling.js`**: Handles WebRTC signaling (Offer/Answer/ICE) and custom application events (accept/decline) over Socket.IO.
- **`server/cleanup.js`**: Background task that automatically expires old sessions to prevent memory leaks and ensure security.

## Installation Instructions

1. Ensure Node.js is installed.
2. Navigate to the `EasyDrop` directory.
3. Install dependencies:
   ```bash
   npm install
   ```

## Starting the Application

To start the server, run:
```bash
npm start
```
By default, the server will run on port `3000`. You can access the application by navigating to `http://localhost:3000` in your web browser.

## Environment Variables
- `PORT`: (Optional) Specifies the port the server runs on. Defaults to `3000`.
