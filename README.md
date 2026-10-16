
# Obsidian AI – AI-Powered Website Builder

Obsidian AI is a web application that helps users generate and modify websites using natural-language prompts. It uses Google's Gemini API to generate website code and provides a chat-based interface for iterative editing.

## Features

- Generate website code from natural-language prompts
- Edit and refine generated websites through chat
- Preview generated websites
- View generated HTML, CSS, and JavaScript source code
- React-based user interface
- Node.js and Express.js backend

## Technologies Used

**Frontend**
- React.js
- Vite
- HTML5
- CSS3
- JavaScript

**Backend**
- Node.js
- Express.js

**API and Tools**
- Google Gemini API
- CORS
- dotenv

## Project Structure

```text
obsidian-ai/
├── generated-website/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── public/
├── server/
│   └── server.js
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

## Getting Started

### Prerequisites

- Node.js and npm
- A Google Gemini API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/dyaswanth2007-afk/obsidian-ai.git
   ```

2. Open the project folder:

   ```bash
   cd obsidian-ai
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure your environment variables in a local `.env` file using the variable names expected by the backend. Never commit API keys or secrets to GitHub.

5. Start the frontend using the available npm script:

   ```bash
   npm run dev
   ```

6. Start the backend using the command configured for the server in `package.json`.

## Current Implementation

This project is a working prototype for AI-assisted website generation. Generated website data is stored in temporary server memory and is not persisted in a database.

## Author

**Yaswanth Dasari**

- GitHub: [dyaswanth2007-afk](https://github.com/dyaswanth2007-afk)

## License

No license has been specified yet.
