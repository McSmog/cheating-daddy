<img width="1299" height="424" alt="cd (1)" src="https://github.com/user-attachments/assets/b25fff4d-043d-4f38-9985-f832ae0d0f6e" />

## Recall.ai - API for desktop recording

If you’re looking for a hosted desktop recording API, consider checking out [Recall.ai](https://www.recall.ai/product/desktop-recording-sdk/?utm_source=github&utm_medium=sponsorship&utm_campaign=sohzm-cheating-daddy), an API that records Zoom, Google Meet, Microsoft Teams, in-person meetings, and more.

This project is sponsored by Recall.ai.

---

> [!NOTE]  
> Use latest MacOS and Windows version, older versions have limited support

> [!NOTE]  
> During testing it wont answer if you ask something, you need to simulate interviewer asking question, which it will answer

A real-time AI assistant that provides contextual help during video calls, interviews, presentations, and meetings using screen capture and audio analysis.

## Features

- **Live AI Assistance**: Real-time help powered by Google Gemini 2.0 Flash Live
- **Screen & Audio Capture**: Analyzes what you see and hear for contextual responses
- **Multiple Profiles**: Interview, Sales Call, Business Meeting, Presentation, Negotiation
- **Transparent Overlay**: Always-on-top window that can be positioned anywhere
- **Click-through Mode**: Make window transparent to clicks when needed
- **Cross-platform**: Works on macOS, Windows, and Linux (kinda, dont use, just for testing rn)

## Setup

1. **Get a Gemini API Key**: Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. **Install Dependencies**: `npm install`
3. **Run the App**: `npm start`

## Usage

1. Enter your Gemini API key in the main window
2. Choose your profile and language in settings
3. Click "Start Session" to begin
4. Position the window using keyboard shortcuts
5. The AI will provide real-time assistance based on your screen and what interview asks

## Keyboard Shortcuts

- **Window Movement**: `Ctrl/Cmd + Arrow Keys` - Move window
- **Click-through**: `Ctrl/Cmd + M` - Toggle mouse events
- **Close/Back**: `Ctrl/Cmd + \` - Close window or go back
- **Send Message**: `Enter` - Send text to AI

## Audio Capture

- **macOS**: [SystemAudioDump](https://github.com/Mohammed-Yasin-Mulla/Sound) for system audio
- **Windows**: Loopback audio capture
- **Linux**: Microphone input

## Requirements

- Electron-compatible OS (macOS, Windows, Linux)
- Gemini API key
- Screen recording permissions
- Microphone/audio permissions

## Local Whisper + your OpenAI-compatible API

On Windows x64 (or supported macOS), choose **Use Whisper + local model or API** on the start screen.
Under **Language model**, select **OpenAI-compatible API**, then enter:

- **API base URL**: your provider's API prefix, usually `https://host/v1`. A full `/chat/completions` URL also works.
- **API key**: your provider's key (optional for an unauthenticated local endpoint).
- **Model ID**: the exact model name accepted by that provider.

Under **Transcription**, select **Base multilingual** or **Small multilingual**, then **Russian** or **Detect automatically**.
English-only `.en` models require English. Start the session to download the checksum-verified Whisper runner and model.
This mode does **not** download or start a local language model and does not need Gemini or Groq keys.

Audio is transcribed locally after a pause. The transcript, AI customization context (including pasted résumé), and recent conversation
are sent to your API. Screenshots are sent only when requested and require an image-capable model. Hosted API usage is billed by your provider.
Use system audio only when you want to transcribe the other speaker; the existing microphone/both options remain available.

The API key uses the application's existing credentials storage, outside this repository
(`%APPDATA%/cheating-daddy-config/credentials.json` on Windows). That existing file is plaintext; do not share it or include it in bug reports.
Changing providers/models requires stopping and starting the session. Requests are serialized and cancelled when the session stops.
Linux native Whisper installation is not implemented by this change.

Run `npm test` for protocol and session tests (no API key, audio device or model download required).
