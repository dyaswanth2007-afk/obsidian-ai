
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Temporary memory only. Generated websites are not persisted.
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

  // Remove Markdown code fences if present.
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
    throw new Error("Gemini must return html, css and js as strings.");
  }

  return files;
}

// Generate a new website or update the existing website.
async function generateWebsite(prompt) {
  if (!ai) {
    throw new Error("Gemini API key is missing. Check your .env file.");
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
- Create a new website if no website exists.
- Otherwise update the existing website according to the latest request.
- Preserve existing sections unless the user requests changes.
- Return the complete updated HTML, CSS and JavaScript.

DESIGN REQUIREMENTS:
- Create a polished, professional and attractive website.
- Use a cohesive color palette and modern typography.
- Use CSS Grid and Flexbox where appropriate.
- Style navigation, buttons, links, cards and forms.
- Make the website responsive on desktop, tablet and mobile.
- Ensure readable text and good contrast.
- Do not use React or JSX.
- Return a standalone HTML website.

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
        console.log(`Trying ${model}, attempt ${attempt}...`);

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
          /503|502|500|429|overloaded|unavailable|timeout|rate.?limit/i.test(
            message
          );

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

  throw new Error(lastError?.message || "Website generation failed.");
}

// Create or update a website.
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

    // Update memory only after successful generation.
    currentWebsite = updatedWebsite;

    res.set("Cache-Control", "no-store");

    return res.json({
      message: "Website generated or updated successfully!",
      previewUrl: "/preview",
    });
  } catch (error) {
    console.error("Website generation error:", error);

    return res.status(500).json({
      error: error.message || "Website generation failed.",
    });
  }
});

// Return generated source code for the Code view.
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

// Display the generated website.
app.get("/preview", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res
      .status(404)
      .send(
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

// Serve generated CSS.
app.get("/preview-files/style.css", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res.status(404).send("No website generated.");
  }

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

// Serve generated JavaScript.
app.get("/preview-files/script.js", (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!currentWebsite) {
    return res.status(404).send("No website generated.");
  }

  return res
    .type("application/javascript")
    .send(currentWebsite.js);
});

// Start the server on the hosting platform's assigned port.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
