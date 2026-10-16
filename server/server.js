
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Temporary memory only: no website files or chat history are saved.
let currentWebsite = null;

app.get("/", (req, res) => {
  res.send("Obsidian AI is running!");
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractWebsiteFiles(responseText) {
  if (!responseText || !responseText.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  let text = responseText.trim();

  // Remove Markdown fences if the model unexpectedly includes them.
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let files;

  try {
    files = JSON.parse(text);
  } catch {
    console.error(
      "Gemini response was not valid JSON. Response length:",
      text.length
    );

    throw new Error(
      "Gemini returned invalid or incomplete JSON. Try a shorter prompt."
    );
  }

  if (
    !files ||
    typeof files.html !== "string" ||
    typeof files.css !== "string" ||
    typeof files.js !== "string"
  ) {
    throw new Error(
      "Gemini must return html, css and js as strings."
    );
  }

  return files;
}

// Generate a website or update the existing website.
async function generateWebsite(prompt) {
  if (!ai) {
    throw new Error(
      "Gemini API key is missing. Check your .env file."
    );
  }

  const models = [
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
  ];

  const previousWebsite = currentWebsite
    ? JSON.stringify(currentWebsite)
    : "No existing website. Create a new website.";

  const instructions = `
You are Obsidian AI, a professional UI/UX designer and website developer.

USER REQUEST:
${prompt}

EXISTING WEBSITE:
${previousWebsite}

TASK:
- If no website exists, create a complete new website.
- If a website exists, update it according to the latest request.
- Preserve existing sections and features unless the user requests changes.
- Return the complete updated HTML, CSS and JavaScript.

DESIGN REQUIREMENTS:
- Create a polished, professional, visually attractive website.
- Use a cohesive color palette and modern typography.
- Use CSS Grid and Flexbox where appropriate.
- Style navigation, buttons, links, cards and forms.
- Add appropriate spacing, shadows, rounded corners and hover effects.
- Make the website responsive on desktop, tablet and mobile.
- Avoid default browser styling where custom styling is appropriate.
- Ensure readable text and good contrast.
- Keep navigation in normal page flow; do not make it fixed or sticky
  unless the user explicitly requests it.
- Do not use React or JSX. Return a standalone HTML website.

OUTPUT REQUIREMENTS:
Return ONLY a JSON object with exactly these three string properties:
{
  "html": "complete HTML document",
  "css": "complete CSS stylesheet",
  "js": "complete JavaScript code"
}

- Put all CSS in the css property.
- Put all JavaScript in the js property.
- Escape JSON strings correctly.
- Do not include Markdown fences or explanations.
- Keep the response complete but reasonably concise.
`;

  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `Trying ${model}, attempt ${attempt}...`
        );

        const response = await ai.models.generateContent({
          model,
          contents: instructions,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 16384,
          },
        });

        const files = extractWebsiteFiles(response.text);

        console.log("Website code generated successfully.");
        return files;
      } catch (error) {
        lastError = error;

        console.error(
          `${model}, attempt ${attempt} failed:`,
          error.message || error
        );

        const message = String(error.message || error);

        const retryable =
          /503|502|500|429|overloaded|unavailable|timeout|rate.?limit/i
            .test(message);

        // Invalid JSON usually means the response was truncated or malformed.
        const invalidJson =
          /invalid or incomplete JSON/i.test(message);

        if (attempt < 2 && (retryable || invalidJson)) {
          await sleep(2000);
          continue;
        }

        // Try the next model if this model fails.
        break;
      }
    }
  }

  throw new Error(
    lastError?.message || "Website generation failed."
  );
}

// Chat endpoint: create or modify the website.
app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Please enter a prompt.",
      });
    }

    console.log("Generating or updating website...");

    const updatedWebsite = await generateWebsite(prompt.trim());

    // Replace the current website only after successful generation.
    currentWebsite = updatedWebsite;

    res.set("Cache-Control", "no-store");

    return res.json({
      message: "Website generated or updated successfully!",
      previewUrl: `http://localhost:${PORT}/preview`,
    });
  } catch (error) {
    console.error("Website generation error:", error);

    return res.status(500).json({
      error: error.message || "Website generation failed.",
    });
  }
});

// Return generated source code for the frontend Code view.
app.get("/api/code", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res.status(404).json({
      error: "Generate a website first.",
    });
  }

  return res.json({
    html: currentWebsite.html,
    css: currentWebsite.css,
    js: currentWebsite.js,
  });
});

// Clear the temporary website.
app.post("/api/reset", (req, res) => {
  currentWebsite = null;

  return res.json({
    message: "Temporary website cleared.",
  });
});

// Display the website with its current CSS and JavaScript.
app.get("/preview", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res.status(404).send(
      "<h2>No website yet</h2><p>Return to Obsidian AI and enter a prompt.</p>"
    );
  }

  let html = currentWebsite.html;

  const cssLink =
    '<link rel="stylesheet" href="/preview-files/style.css?v=' +
    Date.now() +
    '">';

  const jsScript =
    '<script src="/preview-files/script.js?v=' +
    Date.now() +
    '" defer></script>';

  // Remove existing stylesheet links.
  html = html.replace(
    /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/gi,
    ""
  );

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${cssLink}\n</head>`);
  } else {
    html = `${cssLink}\n${html}`;
  }

  // Remove existing external script tags.
  html = html.replace(
    /<script\b(?=[^>]*\bsrc=["'][^"']*["'])[^>]*>\s*<\/script>/gi,
    ""
  );

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${jsScript}\n</body>`);
  } else {
    html += `\n${jsScript}`;
  }

  return res.type("html").send(html);
});

// Serve the current CSS from memory.
app.get("/preview-files/style.css", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res.status(404).send("No website generated.");
  }

  // Prevent common navigation elements from being fixed or sticky
  // unless the generated page uses more specific inline styling.
  const scrollingFix = `
    header,
    nav,
    .navbar,
    .navigation,
    .site-header,
    .main-header {
      position: static !important;
      top: auto !important;
    }
  `;

  return res
    .type("text/css")
    .send(currentWebsite.css + "\n" + scrollingFix);
});

// Serve the current JavaScript from memory.
app.get("/preview-files/script.js", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res.status(404).send("No website generated.");
  }

  return res
    .type("application/javascript")
    .send(currentWebsite.js);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
