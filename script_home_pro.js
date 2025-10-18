import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!token || !currentUser) window.location.href = "index.html";

// ================= SOCKET.IO =================
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// ================= FEED =================
const feed = document.querySelector(".feed");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");
const postSubmit = document.getElementById("post-submit");

async function loadPosts() {
  const res = await fetch(`${API_URL}/api/posts`);
  const posts = await res.json();
  feed.querySelectorAll(".dynamic").forEach((el) => el.remove());
  posts.forEach((post) => renderPost(post));
}
loadPosts();

function renderPost(post) {
  const card = document.createElement("div");
  card.classList.add("post-card", "dynamic");
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  card.innerHTML = `
    <div class="post-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <img src="https://i.pravatar.cc/40?img=${Math.floor(
        Math.random() * 70
      )}" class="avatar" style="border-radius:50%;">
      <span class="username" style="font-weight:bold;color:#007755;">${
        post.user.name
      }</span>
      <span class="time">${time}</span>
    </div>
    <div class="post-content">
      <p>${post.content}</p>
      ${
        post.image ? `<img src="${API_URL}${post.image}" alt="post image">` : ""
      }
    </div>
    <div class="post-actions">
      <button data-id="${post._id}" class="like-btn">👍 Like</button>
      <button data-id="${post._id}" class="comment-btn">💬 Comment</button>
    </div>
  `;
  feed.prepend(card);

  card.querySelector(".like-btn").addEventListener("click", () => {
    socket.emit("like", { user: currentUser.name, postId: post._id });
  });
  card.querySelector(".comment-btn").addEventListener("click", () => {
    const text = prompt("Nhập bình luận:");
    if (text)
      socket.emit("comment", {
        user: currentUser.name,
        postId: post._id,
        text,
      });
  });
}

// Post creation
postSubmit.addEventListener("click", async () => {
  const content = postContent.value.trim();
  if (!content && !postImage.files[0])
    return alert("Nhập nội dung hoặc chọn ảnh!");
  const formData = new FormData();
  formData.append("content", content);
  if (postImage.files[0]) formData.append("image", postImage.files[0]);

  const res = await fetch(`${API_URL}/api/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const post = await res.json();
  renderPost(post);
  postContent.value = "";
  postImage.value = "";
});

// ================= CHAT =================
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

function addChatMessage(user, text, ts) {
  const div = document.createElement("div");
  div.classList.add("message");
  const time = new Date(ts || Date.now()).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  div.innerHTML = `<strong style="color:#007755;">${user}:</strong> ${text} <span class="timestamp">${time}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatSend.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat", { user: currentUser.name, text });
  chatInput.value = "";
});

socket.on("chat", (msg) => addChatMessage(msg.user, msg.text, msg.ts));
socket.on("like", (data) =>
  console.log(`💖 ${data.user} đã thích bài ${data.postId}`)
);
socket.on("comment", (data) =>
  console.log(`💬 ${data.user} bình luận bài ${data.postId}`)
);
