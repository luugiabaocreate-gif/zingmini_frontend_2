import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Nếu không đăng nhập -> redirect về index
if (!token || !currentUser) {
  window.location.href = "index.html";
}

/* Socket realtime */
const socket = io(API_URL, { transports: ["websocket", "polling"] });

/* DOM refs */
const postsContainer = document.getElementById("posts-container");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");
const postSubmit = document.getElementById("post-submit");
const emojiBtn = document.getElementById("emoji-btn");
const mediaPreview = document.getElementById("media-preview");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const toggleThemeBtn = document.getElementById("toggle-theme");

/* Theme persistence */
function applyTheme(saved) {
  const body = document.body;
  if (saved === "dark") body.classList.add("dark");
  else body.classList.remove("dark");
  if (body.classList.contains("dark")) toggleThemeBtn.textContent = "☀️";
  else toggleThemeBtn.textContent = "🌙";
}
const savedTheme = localStorage.getItem("zing_home_theme") || "light";
applyTheme(savedTheme);
toggleThemeBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const body = document.body;
  body.classList.toggle("dark");
  const mode = body.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem("zing_home_theme", mode);
  applyTheme(mode);
});

/* Decorative balloon ensure (lightweight) */
(function ensureDecor() {
  const decor = document.querySelector(".bg-decor");
  if (!decor) return;
  // add small interactive balloon if missing
  if (!document.querySelector(".balloon-interactive")) {
    const b = document.createElement("div");
    b.className = "balloon balloon-interactive";
    b.style.right = "12%";
    b.style.bottom = "18%";
    b.style.width = "64px";
    b.style.height = "82px";
    b.style.opacity = "0.95";
    b.style.animation = "floaty 9s ease-in-out infinite";
    b.style.cursor = "pointer";
    b.title = "Zing balloon";
    b.addEventListener(
      "mouseenter",
      () => (b.style.transform = "translateY(-22px) scale(1.04)")
    );
    b.addEventListener(
      "mouseleave",
      () => (b.style.transform = "translateY(0) scale(1)")
    );
    decor.appendChild(b);
  }
})();

/* Safe fetch JSON */
async function safeFetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`Server lỗi ${res.status}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("Không phải JSON:", text);
      throw new Error("Phản hồi không hợp lệ từ server");
    }
  } catch (err) {
    throw err;
  }
}

/* Load posts with graceful handling + staggered animation */
async function loadPosts() {
  postsContainer.innerHTML =
    "<p style='text-align:center;color:#888;padding:14px'>Đang tải bài viết...</p>";
  try {
    const posts = await safeFetchJson(`${API_URL}/api/posts`);
    if (!Array.isArray(posts) || posts.length === 0) {
      postsContainer.innerHTML =
        "<p style='text-align:center;color:#666;padding:14px'>Chưa có bài viết nào.</p>";
      return;
    }
    postsContainer.innerHTML = "";
    posts.forEach((post, idx) => {
      const node = renderPost(post, idx);
      if (node) postsContainer.appendChild(node);
      setTimeout(() => node?.classList.add("loaded"), 80 * idx + 120);
    });
  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
    postsContainer.innerHTML =
      "<p style='color:red;text-align:center;padding:14px'>Không tải được bài viết — thử lại sau.</p>";
  }
}
loadPosts();

/* Render post -> returns DOM node */
function renderPost(post = {}, idx = 0) {
  // fallback user
  if (!post.user) post.user = { name: post.authorName || "Ẩn danh" };
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  const card = document.createElement("div");
  card.className = "post-card";
  card.innerHTML = `
    <div class="post-header">
      <img src="https://i.pravatar.cc/40?img=${Math.floor(
        Math.random() * 70
      )}" class="avatar" alt="avatar">
      <div style="display:flex;flex-direction:column;">
        <span class="username" style="font-weight:bold;color:#007755;">${escapeHtml(
          post.user.name
        )}</span>
        <span class="time" style="font-size:.85rem;color:#666">${time}</span>
      </div>
    </div>
    <div class="post-content">
      <p>${escapeHtml(post.content || "")}</p>
      ${post.image ? `${renderMediaHtml(post.image)}` : ""}
    </div>
    <div class="post-actions">
      <button data-id="${post._id || ""}" class="like-btn btn">👍 Like</button>
      <button data-id="${
        post._id || ""
      }" class="comment-btn btn">💬 Comment</button>
    </div>
  `;
  // handlers
  card.querySelector(".like-btn")?.addEventListener("click", (e) => {
    e.target.textContent = "💖 Đã thích";
    socket.emit("like", { user: currentUser.name, postId: post._id });
    setTimeout(() => (e.target.textContent = "👍 Like"), 1200);
  });
  card.querySelector(".comment-btn")?.addEventListener("click", async () => {
    const text = prompt("Nhập bình luận:");
    if (text) {
      socket.emit("comment", {
        user: currentUser.name,
        postId: post._id,
        text,
      });
    }
  });
  return card;
}

/* helper to render media html (image or video) */
function renderMediaHtml(path) {
  // path might be full URL or relative. If it begins with http/https use as is.
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  // determine extension
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext)) {
    return `<video controls src="${url}" style="width:100%;border-radius:10px;margin-top:8px"></video>`;
  }
  // default image
  return `<img src="${url}" alt="post image" style="width:100%;border-radius:10px;margin-top:8px">`;
}

/* emoji button simple insert */
emojiBtn.addEventListener("click", (e) => {
  const emoji = "😊";
  insertAtCursor(postContent, emoji);
  postContent.focus();
});
function insertAtCursor(el, text) {
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  const value = el.value || "";
  el.value = value.slice(0, start) + text + value.slice(end);
  // move cursor
  const pos = start + text.length;
  el.selectionStart = el.selectionEnd = pos;
}

/* preview selected image or video */
postImage.addEventListener("change", (e) => {
  const file = e.target.files[0];
  mediaPreview.innerHTML = "";
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.src = fr.result;
      v.controls = true;
      v.style.maxWidth = "160px";
      v.style.borderRadius = "10px";
      mediaPreview.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = fr.result;
      img.style.maxWidth = "160px";
      img.style.borderRadius = "10px";
      mediaPreview.appendChild(img);
    }
  };
  fr.readAsDataURL(file);
});

/* Submit new post (text + file) */
postSubmit.addEventListener("click", async () => {
  const content = postContent.value.trim();
  if (!content && !postImage.files[0])
    return alert("Nhập nội dung hoặc chọn ảnh!");
  const formData = new FormData();
  formData.append("content", content);
  if (postImage.files[0]) formData.append("image", postImage.files[0]);
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      throw new Error("Đăng bài thất bại");
    }
    const newPost = await res.json();
    // render on top
    const node = renderPost(newPost);
    postsContainer.prepend(node);
    setTimeout(() => node.classList.add("loaded"), 60);
    // reset
    postContent.value = "";
    postImage.value = "";
    mediaPreview.innerHTML = "";
  } catch (err) {
    console.error(err);
    alert("Không thể đăng bài. Vui lòng thử lại!");
  }
});

/* Chat functions */
function addChatMessage(user, text, ts) {
  const div = document.createElement("div");
  div.className = "message";
  const time = new Date(ts || Date.now()).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  div.innerHTML = `<strong style="color:#007755;">${escapeHtml(
    user
  )}:</strong> ${escapeHtml(
    text
  )} <span style="font-size:.75rem;color:#666;margin-left:6px">${time}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  div.animate(
    [
      { boxShadow: "0 0 0 rgba(0,0,0,0)" },
      { boxShadow: "0 8px 18px rgba(0,150,255,0.12)" },
    ],
    { duration: 700 }
  );
}

chatSend.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat", { user: currentUser.name, text });
  addChatMessage(currentUser.name, text, Date.now());
  chatInput.value = "";
});

/* socket listeners */
socket.on("chat", (msg) => addChatMessage(msg.user, msg.text, msg.ts));
socket.on("like", (data) =>
  console.log(`💖 ${data.user} liked ${data.postId}`)
);
socket.on("comment", (data) =>
  console.log(`💬 ${data.user} commented ${data.postId}`)
);

/* small utilities */
function escapeHtml(unsafe = "") {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* fallback: load-in animations on load if anything present */
window.addEventListener("load", () => {
  document.querySelectorAll(".post-card").forEach((el, i) => {
    setTimeout(() => el.classList.add("loaded"), i * 70 + 120);
  });
});
