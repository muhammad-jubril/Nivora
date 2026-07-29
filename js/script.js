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
  messagesEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-glow"></div>
      <h1>Nivora</h1>
      <p>Ask me anything — I'm here to help.</p>
    </div>`;
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
    // Cap what we store so localStorage doesn't grow unbounded over time.
    const trimmed = chatHistory.slice(-40);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    // Storage can fail (private browsing, quota, etc) — not worth blocking the chat over.
  }
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
  if (text) {
    const textNode = document.createElement("span");
    textNode.textContent = text;
    bubble.appendChild(textNode);
  }
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
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

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text && !attachedImage) return;

  const imageToSend = attachedImage;
  chatInput.value = "";
  autoResize(chatInput);
  clearAttachment();
  sendBtn.disabled = true;

  addMessage("user", text, imageToSend);
  chatHistory.push({ role: "user", content: text || "(sent an image)" });
  saveHistory();

  const thinkingRow = addThinkingBubble();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory, image: imageToSend || undefined }),
    });
    const data = await res.json();

    thinkingRow.remove();

    if (!res.ok) {
      addMessage("assistant", "Something went wrong. Please try again.");
    } else {
      addMessage("assistant", data.reply);
      chatHistory.push({ role: "assistant", content: data.reply });
      saveHistory();
    }
  } catch (err) {
    thinkingRow.remove();
    addMessage("assistant", "Couldn't reach the server. Is it running?");
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

// ---------- Image generation ----------
function addImageCard(prompt) {
  clearEmptyState(imageGallery);
  const card = document.createElement("div");
  card.className = "image-card loading";
  card.innerHTML = `<div class="thinking"><span></span><span></span><span></span></div>`;
  imageGallery.prepend(card);
  imageGallery.scrollTop = 0;
  return card;
}

async function generateImage() {
  const prompt = imageInput.value.trim();
  if (!prompt) return;

  imageInput.value = "";
  autoResize(imageInput);
  generateBtn.disabled = true;

  const card = addImageCard(prompt);

  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    card.classList.remove("loading");

    if (!res.ok) {
      card.innerHTML = `<div class="caption">Error: ${data.error || "image generation failed."}</div>`;
    } else {
      const src = data.b64 ? `data:image/png;base64,${data.b64}` : data.url;
      card.innerHTML = `<img src="${src}" alt="${prompt}" /><div class="caption">${prompt}</div>`;
    }
  } catch (err) {
    card.classList.remove("loading");
    card.innerHTML = `<div class="caption">Couldn't reach the server. Is it running?</div>`;
  } finally {
    generateBtn.disabled = false;
  }
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

// Close the drawer after picking a mode, so it doesn't stay open over the content
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

// Restore saved preference (defaults to dark)
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
          addMessage("assistant", "Couldn't reach the server. Is it running?");
        } finally {
          chatInput.placeholder = "Message Nivora...";
          micBtn.disabled = false;
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.start();
    micBtn.classList.add("recording");
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
