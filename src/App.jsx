
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [error, setError] = useState("");

  const [activeView, setActiveView] = useState("preview");
  const [activeCodeTab, setActiveCodeTab] = useState("html");
  const [codeFiles, setCodeFiles] = useState({
    html: "",
    css: "",
    js: "",
  });
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function loadCode() {
    setActiveView("code");
    setCodeLoading(true);
    setCodeError("");
    setCopyMessage("");

    try {
      const response = await fetch(`${API}/api/code`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load website code.");
      }

      setCodeFiles({
        html: data.html || "",
        css: data.css || "",
        js: data.js || "",
      });
    } catch (err) {
      setCodeError(
        err.message || "Could not connect to the backend."
      );
    } finally {
      setCodeLoading(false);
    }
  }

  async function copyCode() {
    const code = codeFiles[activeCodeTab];

    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage("Code copied!");
    } catch {
      setCopyMessage(
        "Copy was blocked by your browser. Select the code and copy it manually."
      );
    }

    setTimeout(() => setCopyMessage(""), 2500);
  }

  async function sendPrompt(text = prompt) {
    const request = text.trim();

    if (!request || loading) return;

    const hadWebsite = hasWebsite;

    setPrompt("");
    setError("");
    setMessages((previous) => [
      ...previous,
      { role: "user", text: request },
    ]);
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: request }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Website generation failed.");
      }

      setHasWebsite(true);
      setPreviewVersion(Date.now());

      // Refresh the code automatically after each successful change.
      setCodeFiles({
        html: "",
        css: "",
        js: "",
      });
      setCodeError("");
      setCopyMessage("");

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: hadWebsite
            ? "I've updated your website. Check the preview on the right. You can also open Code to view the HTML, CSS, and JavaScript."
            : "Your website is ready! Check the live preview or open Code to view the generated HTML, CSS, and JavaScript.",
        },
      ]);

      // Keep the current view if the user was viewing code.
      if (activeView === "code") {
        await loadCode();
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: "I couldn't finish that request. Please check the error below and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function startNewWebsite() {
    if (loading) return;

    try {
      await fetch(`${API}/api/reset`, {
        method: "POST",
      });
    } catch {
      setError("Could not contact the backend. Is it running?");
      return;
    }

    setMessages([]);
    setPrompt("");
    setHasWebsite(false);
    setPreviewVersion(0);
    setError("");
    setActiveView("preview");
    setActiveCodeTab("html");
    setCodeFiles({ html: "", css: "", js: "" });
    setCodeError("");
    setCopyMessage("");
  }

  const previewUrl = hasWebsite
    ? `${API}/preview?v=${previewVersion}`
    : "";

  const codeTabLabels = {
    html: "HTML",
    css: "CSS",
    js: "JavaScript",
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">O</div>
          <div>
            <h1>Obsidian AI</h1>
            <p>AI website builder</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="session-label">
            <span className="status-dot" />
            Temporary session
          </span>

          <button
            className="new-button"
            onClick={startNewWebsite}
            disabled={loading}
          >
            + New website
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="chat-panel">
          <div className="panel-title">
            <div>
              <h2>Website assistant</h2>
              <p>Describe an idea or ask for a change.</p>
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="welcome">
                <div className="welcome-icon">✳</div>
                <h2>What shall we build?</h2>
                <p>
                  Describe your website. I'll build it and show
                  you the result on the right.
                </p>

                <div className="suggestions">
                  <button
                    onClick={() =>
                      sendPrompt(
                        "Create a modern portfolio website with a dark theme, project cards, an about section, and a contact form."
                      )
                    }
                  >
                    <span>✦</span>
                    Create a portfolio
                  </button>

                  <button
                    onClick={() =>
                      sendPrompt(
                        "Create a modern landing page for a technology startup with a hero section, features, pricing cards, and a call-to-action."
                      )
                    }
                  >
                    <span>◈</span>
                    Build a landing page
                  </button>

                  <button
                    onClick={() =>
                      sendPrompt(
                        "Create a stylish online store homepage with product cards, categories, and a shopping button."
                      )
                    }
                  >
                    <span>▦</span>
                    Design an online store
                  </button>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                className={`message ${
                  message.role === "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
                key={`${index}-${message.role}`}
              >
                {message.role === "assistant" && (
                  <div className="assistant-avatar">O</div>
                )}

                <div className="message-content">
                  <span className="message-author">
                    {message.role === "user" ? "You" : "Obsidian AI"}
                  </span>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="message assistant-message">
                <div className="assistant-avatar">O</div>
                <div className="message-content">
                  <span className="message-author">Obsidian AI</span>
                  <p className="typing">
                    Working on your website
                    <span>.</span><span>.</span><span>.</span>
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="error-box">
              <strong>Something went wrong</strong>
              <p>{error}</p>
            </div>
          )}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendPrompt();
            }}
          >
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  sendPrompt();
                }
              }}
              placeholder={
                hasWebsite
                  ? "Ask for a change, e.g. make the background blue..."
                  : "Describe the website you want to create..."
              }
              rows={3}
              disabled={loading}
            />

            <div className="composer-footer">
              <span>Enter to send · Shift + Enter for a new line</span>

              <button
                className="send-button"
                type="submit"
                disabled={loading || !prompt.trim()}
                aria-label="Send prompt"
              >
                {loading ? "…" : "↑"}
              </button>
            </div>
          </form>

          <p className="privacy-note">
            Temporary session · Chat and website are not saved to a database
          </p>
        </aside>

        <section className="preview-panel">
          <div className="preview-toolbar">
            <div className="preview-heading">
              <span className="preview-live-dot" />
              <div>
                <h2>
                  {activeView === "preview"
                    ? "Live preview"
                    : "Website code"}
                </h2>
                <p>
                  {activeView === "preview"
                    ? hasWebsite
                      ? "Your latest website version"
                      : "Your website will appear here"
                    : "View and copy your generated source code"}
                </p>
              </div>
            </div>

            <div className="preview-actions">
              {hasWebsite && (
                <>
                  <button
                    className="icon-button"
                    title="Refresh preview"
                    onClick={() => {
                      setPreviewVersion(Date.now());
                      if (activeView === "code") {
                        loadCode();
                      }
                    }}
                  >
                    ↻
                  </button>

                  <button
                    className="open-button"
                    onClick={() => {
                      if (activeView === "code") {
                        setActiveView("preview");
                      } else {
                        loadCode();
                      }
                    }}
                  >
                    {activeView === "code" ? "Preview" : "</> Code"}
                  </button>

                  <a
                    className="open-button"
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in new tab ↗
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="preview-canvas">
            {hasWebsite ? (
              activeView === "preview" ? (
                <iframe
                  key={previewVersion}
                  src={previewUrl}
                  title="Generated website"
                  className="website-frame"
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    background: "#111116",
                    color: "#e7e7f0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 16px",
                      borderBottom: "1px solid #34313f",
                      flexWrap: "wrap",
                    }}
                  >
                    {Object.entries(codeTabLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setActiveCodeTab(key);
                          setCopyMessage("");
                        }}
                        style={{
                          border: "1px solid",
                          borderColor:
                            activeCodeTab === key ? "#9b76ff" : "#34313f",
                          background:
                            activeCodeTab === key ? "#34264e" : "#1b1a22",
                          color: "#f1edff",
                          borderRadius: "8px",
                          padding: "8px 14px",
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}

                    <button
                      onClick={copyCode}
                      disabled={codeLoading || !codeFiles[activeCodeTab]}
                      style={{
                        marginLeft: "auto",
                        border: "1px solid #51416e",
                        background: "#6f45cf",
                        color: "white",
                        borderRadius: "8px",
                        padding: "8px 14px",
                        cursor: "pointer",
                        opacity: codeLoading ? 0.6 : 1,
                      }}
                    >
                      Copy code
                    </button>
                  </div>

                  {copyMessage && (
                    <p
                      role="status"
                      style={{
                        margin: "8px 16px 0",
                        color: "#bda5ff",
                        fontSize: "13px",
                      }}
                    >
                      {copyMessage}
                    </p>
                  )}

                  {codeError && (
                    <p
                      style={{
                        margin: "16px",
                        color: "#ff9292",
                      }}
                    >
                      {codeError}
                    </p>
                  )}

                  {codeLoading ? (
                    <p style={{ padding: "20px", color: "#b9b3ca" }}>
                      Loading generated code...
                    </p>
                  ) : (
                    <pre
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: "auto",
                        margin: 0,
                        padding: "20px",
                        fontSize: "13px",
                        lineHeight: 1.65,
                        tabSize: 2,
                        whiteSpace: "pre",
                        color: "#e0d9f4",
                        fontFamily:
                          'Consolas, "Courier New", monospace',
                      }}
                    >
                      <code>
                        {codeFiles[activeCodeTab] ||
                          "No code available. Try refreshing the code view."}
                      </code>
                    </pre>
                  )}
                </div>
              )
            ) : (
              <div className="preview-empty">
                <div className="browser-art">
                  <div className="browser-bar">
                    <span />
                    <span />
                    <span />
                    <div />
                  </div>
                  <div className="browser-body">
                    <div className="art-line wide" />
                    <div className="art-line medium" />
                    <div className="art-button" />
                    <div className="art-cards">
                      <div />
                      <div />
                      <div />
                    </div>
                  </div>
                </div>

                <h2>Your ideas, brought to life.</h2>
                <p>
                  Send your first prompt in the chat to generate
                  your website here.
                </p>
              </div>
            )}
          </div>

          <div className="preview-footer">
            <span>
              <span className="status-dot" />
              {hasWebsite
                ? activeView === "preview"
                  ? "Preview updated"
                  : "Source code"
                : "Waiting for your prompt"}
            </span>
            <span>Obsidian AI Builder</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
