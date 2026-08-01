// ---------- Config ----------
// Replace with the real WhatsApp number (digits only, with country code, no + or spaces),
// e.g. "2348012345678" for a Nigerian number.
const WHATSAPP_NUMBER = "2349167875697";

// ---------- State ----------
const CHAT_STORAGE_KEY = "nivora-chat-history";
let chatHistory = [];

// ---------- Elements ----------
const messagesEl = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const imageGallery = document.getElementById("imageGallery");
const imageInput = document.getElementById("imageInput");
const generateBtn = document.getElementById("generateBtn");

const modeButtons = document.querySelectorAll(".mode-btn");
const chatView = document.getElementById("chatView");
const imageView = document.getElementById("imageView");
const newChatBtn = document.getElementById("newChatBtn");

const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const attachPreview = document.getElementById("attachPreview");
const micBtn = document.getElementById("micBtn");

let attachedImage = null; // base64 data URL, or null
let currentController = null; // AbortController for the in-flight chat request
let isTyping = false; // whether the typewriter reveal is currently animating
let skipTypewriter = false;
let lastFailedRequest = null; // { messages, image } for the retry button

// ---------- Haptics ----------
function vibrate(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (err) {}
  }
}

// ---------- Mode switching ----------
modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    chatView.classList.toggle("active", mode === "chat");
    imageView.classList.toggle("active", mode === "image");
  });
});

newChatBtn.addEventListener("click", () => {
  chatHistory = [];
  localStorage.removeItem(CHAT_STORAGE_KEY);
  window.speechSynthesis?.cancel();
  messagesEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-glow"></div>
      <h1>Nivora</h1>
      <p>Ask me anything — I'm here to help.</p>
      <div class="prompt-chips">
        <button type="button" class="prompt-chip">Explain quantum computing simply</button>
        <button type="button" class="prompt-chip">Write a short poem about the ocean</button>
        <button type="button" class="prompt-chip">Help me debug some code</button>
        <button type="button" class="prompt-chip">Give me a fun fact</button>
      </div>
    </div>`;
  wirePromptChips();
});

// ---------- Auto-resize textareas ----------
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}
chatInput.addEventListener("input", () => autoResize(chatInput));
imageInput.addEventListener("input", () => autoResize(imageInput));

// ---------- Chat ----------
function clearEmptyState(container) {
  const empty = container.querySelector(".empty-state");
  if (empty) empty.remove();
}

function saveHistory() {
  try {
    const trimmed = chatHistory.slice(-40);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    // Storage can fail (private browsing, quota, etc) — not worth blocking the chat over.
  }
}

function renderMarkdown(text) {
  if (typeof marked === "undefined" || typeof DOMPurify === "undefined") return text;
  return DOMPurify.sanitize(marked.parse(text));
}

function highlightCodeBlocks(container) {
  if (typeof hljs === "undefined") return;
  container.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });
}

function addCopyButton(actionsRow, getText) {
  const btn = document.createElement("button");
  btn.className = "icon-action-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Copy message");
  const copyIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`;
  const checkIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  btn.innerHTML = copyIcon;
  btn.addEventListener("click", () => {
    navigator.clipboard.writeText(getText()).then(() => {
      vibrate(10);
      btn.innerHTML = checkIcon;
      setTimeout(() => { btn.innerHTML = copyIcon; }, 1500);
    });
  });
  actionsRow.appendChild(btn);
}

function addSpeakButton(actionsRow, getText) {
  if (!("speechSynthesis" in window)) return;
  const btn = document.createElement("button");
  btn.className = "icon-action-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Read aloud");
  const speakIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`;
  const stopIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  btn.innerHTML = speakIcon;

  btn.addEventListener("click", () => {
    if (btn.classList.contains("speaking")) {
      window.speechSynthesis.cancel();
      btn.classList.remove("speaking");
      btn.innerHTML = speakIcon;
      return;
    }
    window.speechSynthesis.cancel();
    document.querySelectorAll(".icon-action-btn.speaking").forEach((b) => {
      b.classList.remove("speaking");
      b.innerHTML = speakIcon;
    });

    const utterance = new SpeechSynthesisUtterance(getText());
    utterance.onend = () => {
      btn.classList.remove("speaking");
      btn.innerHTML = speakIcon;
    };
    utterance.onerror = () => {
      btn.classList.remove("speaking");
      btn.innerHTML = speakIcon;
    };
    btn.classList.add("speaking");
    btn.innerHTML = stopIcon;
    window.speechSynthesis.speak(utterance);
  });

  actionsRow.appendChild(btn);
}

function addRegenerateButton(row) {
  document.querySelectorAll(".regenerate-btn").forEach((b) => b.remove());
  const btn = document.createElement("button");
  btn.className = "regenerate-btn";
  btn.type = "button";
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v6h-6"/></svg> Regenerate`;
  btn.addEventListener("click", regenerateLast);
  row.querySelector(".msg-wrap").appendChild(btn);
}

function addRetryButton(row, retryFn) {
  const btn = document.createElement("button");
  btn.className = "retry-btn";
  btn.type = "button";
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v6h-6"/></svg> Retry`;
  btn.addEventListener("click", () => {
    row.remove();
    retryFn();
  });
  row.querySelector(".msg-wrap").appendChild(btn);
}

function addMessage(role, text, imageDataUrl) {
  clearEmptyState(messagesEl);
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  const imgHtml = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="attached" style="max-width:220px;border-radius:12px;display:block;margin-bottom:${text ? "8px" : "0"};" />`
    : "";
  row.innerHTML = `<div class="msg-wrap"><div class="bubble">${imgHtml}</div></div>`;
  const bubble = row.querySelector(".bubble");
  if (role === "assistant") {
    const span = document.createElement("span");
    span.className = "bubble-text";
    if (text) {
      span.innerHTML = renderMarkdown(text);
      highlightCodeBlocks(span);
    }
    bubble.appendChild(span);
    if (text) {
      const actionsRow = document.createElement("div");
      actionsRow.className = "bubble-actions";
      row.querySelector(".msg-wrap").appendChild(actionsRow);
      addCopyButton(actionsRow, () => text);
      addSpeakButton(actionsRow, () => text);
    }
  } else if (text) {
    const textNode = document.createElement("span");
    textNode.textContent = text;
    bubble.appendChild(textNode);
  }
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

async function typewriterReveal(span, fullText) {
  isTyping = true;
  skipTypewriter = false;
  const chunkSize = 3;
  let i = 0;
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (skipTypewriter) {
        span.textContent = fullText;
        clearInterval(interval);
        isTyping = false;
        resolve();
        return;
      }
      i += chunkSize;
      span.textContent = fullText.slice(0, i);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (i >= fullText.length) {
        clearInterval(interval);
        isTyping = false;
        resolve();
      }
    }, 15);
  });
  span.innerHTML = renderMarkdown(fullText);
  highlightCodeBlocks(span);
}

function addThinkingBubble() {
  clearEmptyState(messagesEl);
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  row.innerHTML = `<div class="msg-wrap"><div class="bubble thinking-bubble"><span class="thinking-label">Nivora is thinking</span><div class="thinking"><span></span><span></span><span></span></div></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function setSendingUI(sending) {
  sendBtn.innerHTML = sending
    ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  sendBtn.setAttribute("aria-label", sending ? "Stop" : "Send");
}

async function performChatRequest(messagesForRequest, imageToSend) {
  setSendingUI(true);
  currentController = new AbortController();

  const thinkingRow = addThinkingBubble();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesForRequest, image: imageToSend || undefined }),
      signal: currentController.signal,
    });
    const data = await res.json();

    thinkingRow.remove();

    if (!res.ok) {
      lastFailedRequest = { messages: messagesForRequest, image: imageToSend };
      const row = addMessage("assistant", "Something went wrong. Please try again.");
      addRetryButton(row, () => performChatRequest(messagesForRequest, imageToSend));
    } else {
      lastFailedRequest = null;
      const row = addMessage("assistant", "");
      const span = row.querySelector(".bubble-text");
      await typewriterReveal(span, data.reply);
      vibrate(12);
      const actionsRow = document.createElement("div");
      actionsRow.className = "bubble-actions";
      row.querySelector(".msg-wrap").appendChild(actionsRow);
      addCopyButton(actionsRow, () => data.reply);
      addSpeakButton(actionsRow, () => data.reply);
      addRegenerateButton(row);
      chatHistory.push({ role: "assistant", content: data.reply });
      saveHistory();
    }
  } catch (err) {
    thinkingRow.remove();
    if (err.name === "AbortError") {
      addMessage("assistant", "Stopped.");
    } else {
      lastFailedRequest = { messages: messagesForRequest, image: imageToSend };
      const row = addMessage("assistant", "Something went wrong. Please try again.");
      addRetryButton(row, () => performChatRequest(messagesForRequest, imageToSend));
    }
  } finally {
    setSendingUI(false);
    currentController = null;
  }
}

async function regenerateLast() {
  if (currentController || isTyping) return;
  if (chatHistory.length && chatHistory[chatHistory.length - 1].role === "assistant") {
    chatHistory.pop();
    saveHistory();
  }
  document.querySelectorAll(".regenerate-btn").forEach((b) => b.remove());
  const rows = messagesEl.querySelectorAll(".msg-row.assistant");
  if (rows.length) rows[rows.length - 1].remove();

  await performChatRequest(chatHistory, null);
}

async function sendChat() {
  if (currentController || isTyping) return;

  const text = chatInput.value.trim();
  if (!text && !attachedImage) return;

  const imageToSend = attachedImage;
  chatInput.value = "";
  autoResize(chatInput);
  clearAttachment();
  vibrate(10);

  addMessage("user", text, imageToSend);
  chatHistory.push({ role: "user", content: text || "(sent an image)" });
  saveHistory();

  await performChatRequest(chatHistory, imageToSend);
}

function handleSendButtonClick() {
  if (currentController) {
    currentController.abort();
    return;
  }
  if (isTyping) {
    skipTypewriter = true;
    return;
  }
  sendChat();
}

sendBtn.addEventListener("click", handleSendButtonClick);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

// ---------- Prompt chips ----------
function wirePromptChips() {
  document.querySelectorAll(".prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chatInput.value = chip.textContent;
      autoResize(chatInput);
      sendChat();
    });
  });
}
wirePromptChips();

// ---------- Image generation ----------
function addImageCard() {
  clearEmptyState(imageGallery);
  const card = document.createElement("div");
  card.className = "image-card loading";
  card.innerHTML = `<div class="thinking"><span></span><span></span><span></span></div>`;
  imageGallery.prepend(card);
  imageGallery.scrollTop = 0;
  return card;
}

function renderImageResult(card, src, prompt, retryFn) {
  card.innerHTML = `
    <img src="${src}" alt="${prompt}" />
    <div class="caption">
      <span>${prompt}</span>
      <button class="download-btn" type="button" aria-label="Download image">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
      </button>
    </div>`;
  card.querySelector(".download-btn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = "nivora-image.png";
    a.click();
    vibrate(10);
  });
}

function renderImageError(card, message, retryFn) {
  card.innerHTML = `<div class="caption"><span>${message}</span></div>`;
  const retryBtn = document.createElement("button");
  retryBtn.className = "retry-btn";
  retryBtn.type = "button";
  retryBtn.style.margin = "0 12px 12px";
  retryBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v6h-6"/></svg> Retry`;
  retryBtn.addEventListener("click", () => {
    card.remove();
    retryFn();
  });
  card.appendChild(retryBtn);
}

async function requestImage(prompt, card) {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    card.classList.remove("loading");

    if (!res.ok) {
      renderImageError(card, data.error || "Image generation failed.", () => {
        const newCard = addImageCard();
        requestImage(prompt, newCard);
      });
    } else {
      const src = data.b64 ? `data:image/png;base64,${data.b64}` : data.url;
      renderImageResult(card, src, prompt);
      vibrate(12);
    }
  } catch (err) {
    card.classList.remove("loading");
    renderImageError(card, "Something went wrong. Please try again.", () => {
      const newCard = addImageCard();
      requestImage(prompt, newCard);
    });
  }
}

async function generateImage() {
  const prompt = imageInput.value.trim();
  if (!prompt) return;

  imageInput.value = "";
  autoResize(imageInput);
  generateBtn.disabled = true;
  vibrate(10);

  const card = addImageCard();
  await requestImage(prompt, card);
  generateBtn.disabled = false;
}

generateBtn.addEventListener("click", generateImage);
imageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    generateImage();
  }
});

// ---------- Sidebar drawer ----------
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const openSidebarBtn = document.getElementById("openSidebarBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");

function openSidebar() {
  sidebar.classList.add("open");
  backdrop.classList.add("visible");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("visible");
}

openSidebarBtn.addEventListener("click", openSidebar);
closeSidebarBtn.addEventListener("click", closeSidebar);
backdrop.addEventListener("click", closeSidebar);

modeButtons.forEach((btn) => btn.addEventListener("click", closeSidebar));
newChatBtn.addEventListener("click", closeSidebar);

// ---------- Theme switching ----------
const themeButtons = document.querySelectorAll(".theme-btn");
const systemMedia = window.matchMedia("(prefers-color-scheme: light)");

function applyTheme(pref) {
  const resolved = pref === "system" ? (systemMedia.matches ? "light" : "dark") : pref;
  document.body.setAttribute("data-theme", resolved);
  themeButtons.forEach((b) => b.classList.toggle("active", b.dataset.theme === pref));
}

function setTheme(pref) {
  localStorage.setItem("nivora-theme", pref);
  applyTheme(pref);
}

themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme));
});

systemMedia.addEventListener("change", () => {
  const current = localStorage.getItem("nivora-theme") || "dark";
  if (current === "system") applyTheme("system");
});

setTheme(localStorage.getItem("nivora-theme") || "dark");

// ---------- Report a bug ----------
document.getElementById("reportBugBtn").addEventListener("click", () => {
  const message = encodeURIComponent("Hi, I found a bug in Nivora:");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
});

// ---------- Image attachment ----------
function clearAttachment() {
  attachedImage = null;
  attachPreview.innerHTML = "";
  fileInput.value = "";
}

function setAttachment(dataUrl) {
  attachedImage = dataUrl;
  attachPreview.innerHTML = `
    <div class="attach-thumb">
      <img src="${dataUrl}" alt="attached" />
      <button type="button" aria-label="Remove image">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
  attachPreview.querySelector("button").addEventListener("click", clearAttachment);
}

attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => setAttachment(reader.result);
  reader.readAsDataURL(file);
});

// ---------- Voice notes ----------
let mediaRecorder = null;
let recordedChunks = [];

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      micBtn.classList.remove("recording");

      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = async () => {
        chatInput.placeholder = "Transcribing voice note...";
        micBtn.disabled = true;
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: reader.result }),
          });
          const data = await res.json();
          if (res.ok && data.text) {
            chatInput.value = (chatInput.value ? chatInput.value + " " : "") + data.text;
            autoResize(chatInput);
          } else if (!res.ok) {
            addMessage("assistant", "Something went wrong. Please try again.");
          }
        } catch (err) {
          addMessage("assistant", "Something went wrong. Please try again.");
        } finally {
          chatInput.placeholder = "Message Nivora...";
          micBtn.disabled = false;
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.start();
    micBtn.classList.add("recording");
    vibrate(10);
  } catch (err) {
    addMessage("assistant", "Couldn't access the microphone — check your browser permissions.");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

micBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    stopRecording();
  } else {
    startRecording();
  }
});

// ---------- PWA service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// ---------- Splash screen ----------
window.addEventListener("load", () => {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 450);
  }, 900);
});

// ---------- Restore chat history on load ----------
(function restoreHistory() {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    chatHistory = parsed;
    clearEmptyState(messagesEl);
    parsed.forEach((m) => {
      addMessage(m.role === "assistant" ? "assistant" : "user", m.content);
    });
  } catch (err) {
    // Corrupted or inaccessible storage — just start fresh.
  }
})();
