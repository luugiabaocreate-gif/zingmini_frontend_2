// =================== GLOBAL ===================
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));
if (!token || !user) window.location.href = "index.html";

document.getElementById("current-user").innerText = user.name;
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

// =================== SOCKET.IO ===================
const socket = io("https://zingmini-backend-2.onrender.com", {
  transports: ["websocket", "polling"],
});

// =================== FEED ===================
const feed = document.getElementById("feed");
const postBtn = document.getElementById("post-btn");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");

async function loadPosts() {
  const res = await fetch("https://zingmini-backend-2.onrender.com/api/posts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const posts = await res.json();
  feed.innerHTML = "";
  posts.forEach((post) => {
    feed.appendChild(createPostElement(post));
  });
}

function createPostElement(post) {
  const div = document.createElement("div");
  div.className = "post";
  div.innerHTML = `
    <div class="post-header">
      <img src="https://via.placeholder.com/40" alt="avatar">
      <span class="post-user">${post.user.name}</span>
    </div>
    <div class="post-content">${post.content || ""}</div>
    <div class="post-images">${(post.images || [])
      .map((src) => {
        if (src.endsWith(".mp4"))
          return `<video controls src="${src}"></video>`;
        return `<img src="${src}" />`;
      })
      .join("")}</div>
    <div class="post-actions">
      <span class="like-btn" data-id="${post._id}">👍 Thích</span>
      <span class="comment-btn" data-id="${post._id}">💬 Bình luận</span>
    </div>
    <div class="comments" id="comments-${post._id}"></div>
  `;
  // Like
  div.querySelector(".like-btn").addEventListener("click", () => {
    socket.emit("like", { postId: post._id, user: user.name });
  });
  // Comment
  div.querySelector(".comment-btn").addEventListener("click", () => {
    const commentText = prompt("Nhập bình luận:");
    if (commentText)
      socket.emit("comment", {
        postId: post._id,
        user: user.name,
        text: commentText,
      });
  });
  return div;
}

// New post
postBtn.addEventListener("click", async () => {
  const formData = new FormData();
  formData.append("content", postContent.value);
  for (let f of postImage.files) formData.append("images", f);
  const res = await fetch("https://zingmini-backend-2.onrender.com/api/posts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const newPost = await res.json();
  feed.prepend(createPostElement(newPost));
  postContent.value = "";
  postImage.value = "";
});

// =================== SOCKET EVENTS ===================
socket.on("like", (data) =>
  showToast(`${data.user} đã thích 1 bài viết`, "info")
);
socket.on("comment", (data) =>
  showToast(`${data.user} bình luận: "${data.text.slice(0, 30)}"`, "info")
);
socket.on("notification", (data) => addNotification(data));

// =================== NOTIFICATIONS ===================
const notificationsContainer = document.getElementById("notifications");
function addNotification(data) {
  const div = document.createElement("div");
  div.className = "notification";
  div.innerText = data.title;
  notificationsContainer.prepend(div);
  setTimeout(() => div.remove(), 4000);
}

// =================== CHAT ===================
const messages = document.getElementById("messages");
const chatInput = document.getElementById("chat-input");
document.getElementById("send-btn").addEventListener("click", sendChat);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChat();
});
function sendChat() {
  if (chatInput.value.trim() !== "") {
    socket.emit("chat", { user: user.name, text: chatInput.value });
    chatInput.value = "";
  }
}
socket.on("chat", (data) => {
  const div = document.createElement("div");
  div.className = "message" + (data.user === user.name ? " self" : "");
  div.innerText = `${data.user}: ${data.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// =================== STORIES ===================
const storiesContainer = document.getElementById("stories");
async function loadStories() {
  // giả lập 5 stories
  for (let i = 1; i <= 5; i++) {
    const div = document.createElement("div");
    div.className = "story";
    div.innerHTML = `<img src="https://picsum.photos/80/80?random=${i}" />`;
    storiesContainer.appendChild(div);
  }
}
loadStories();

// =================== EMOJI PICKER ===================
const emojiBtn = document.getElementById("emoji-btn");
const emojiPicker = document.getElementById("emoji-picker");
emojiBtn.addEventListener("click", () =>
  emojiPicker.classList.toggle("hidden")
);
const emojis = [
  "😀",
  "😂",
  "😎",
  "😍",
  "😭",
  "😡",
  "👍",
  "👎",
  "💖",
  "🎉",
  "🔥",
  "🤔",
];
emojis.forEach((e) => {
  const span = document.createElement("span");
  span.className = "emoji";
  span.innerText = e;
  span.addEventListener("click", () => {
    chatInput.value += e;
    chatInput.focus();
  });
  emojiPicker.appendChild(span);
});

// =================== INIT ===================
loadPosts();
