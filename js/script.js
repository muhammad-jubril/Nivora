// ---------- Config ----------
// Replace with the real WhatsApp number (digits only, with country code, no + or spaces),
// e.g. "2348012345678" for a Nigerian number.
const WHATSAPP_NUMBER = "2349167875697";

// ---------- State ----------
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
  messagesEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-glow"></div>
      <h1>Nova</h1>
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

function addMessage(role, text) {
  clearEmptyState(messagesEl);
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  row.innerHTML = `<div class="msg-wrap"><div class="bubble"></div></div>`;
  row.querySelector(".bubble").textContent = text;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function addThinkingBubble() {
  clearEmptyState(messagesEl);
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  row.innerHTML = `<div class="msg-wrap"><div class="bubble"><div class="thinking"><span></span><span></span><span></span></div></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  autoResize(chatInput);
  sendBtn.disabled = true;

  addMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  const thinkingRow = addThinkingBubble();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory }),
    });
    const data = await res.json();

    thinkingRow.remove();

    if (!res.ok) {
      addMessage("assistant", `Error: ${data.error || "something went wrong."}`);
    } else {
      addMessage("assistant", data.reply);
      chatHistory.push({ role: "assistant", content: data.reply });
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
  localStorage.setItem("nova-theme", pref);
  applyTheme(pref);
}

themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme));
});

systemMedia.addEventListener("change", () => {
  const current = localStorage.getItem("nova-theme") || "dark";
  if (current === "system") applyTheme("system");
});

// Restore saved preference (defaults to dark)
setTheme(localStorage.getItem("nova-theme") || "dark");

// ---------- Report a bug ----------
document.getElementById("reportBugBtn").addEventListener("click", () => {
  const message = encodeURIComponent("Hi, I found a bug in Nova:");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
});
