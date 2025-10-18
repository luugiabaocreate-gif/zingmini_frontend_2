import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const API_URL = "https://your-backend-domain.com";
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
const token = localStorage.getItem("token");

if (!currentUser || !token) window.location.href = "index.html";

const socket = io(API_URL, { auth: { token } });

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const feed = document.querySelector(".feed");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");
const postSubmit = document.getElementById("post-submit");

function addChatMessage(user, text) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerText = `${user}: ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatSend.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit("chat", { user: currentUser.name, text: msg });
  chatInput.value = "";
});

socket.on("chat", (msg) => addChatMessage(msg.user, msg.text));

async function loadPosts() {
  const res = await fetch(`${API_URL}/api/posts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const posts = await res.json();
  feed.querySelectorAll(".post-card.dynamic").forEach((el) => el.remove());
  posts.forEach((post) => renderPost(post));
}

function renderPost(post) {
  const card = document.createElement("div");
  card.classList.add("post-card", "dynamic");
  card.innerHTML = `
    <div class="post-header">
      <img src="https://i.pravatar.cc/40?img=${Math.floor(
        Math.random() * 70
      )}" class="avatar">
      <span class="username">${post.user.name}</span>
    </div>
    <div class="post-content">
      <p>${post.content}</p>
      ${
        post.image ? `<img src="${API_URL}${post.image}" alt="post image">` : ""
      }
    </div>
    <div class="post-actions">
      <button data-id="${post._id}" class="like-btn">Like</button>
      <button data-id="${post._id}" class="comment-btn">Comment</button>
    </div>
  `;
  feed.appendChild(card);

  card
    .querySelector(".like-btn")
    .addEventListener("click", () =>
      socket.emit("like", { user: currentUser.name, postId: post._id })
    );
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

postSubmit.addEventListener("click", async () => {
  const content = postContent.value.trim();
  const file = postImage.files[0];
  if (!content && !file) return alert("Nhập nội dung hoặc chọn ảnh!");
  const formData = new FormData();
  formData.append("content", content);
  if (file) formData.append("image", file);

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const newPost = await res.json();
    postContent.value = "";
    postImage.value = "";
    renderPost(newPost);
    socket.emit("new-post", { post: newPost });
  } catch (err) {
    alert("Lỗi khi tạo bài: " + err.message);
  }
});

socket.on("like", (data) =>
  console.log(`${data.user} liked post ${data.postId}`)
);
socket.on("comment", (data) =>
  console.log(`${data.user} commented: "${data.text}" on post ${data.postId}`)
);
socket.on("new-post", (data) => renderPost(data.post));

loadPosts();
