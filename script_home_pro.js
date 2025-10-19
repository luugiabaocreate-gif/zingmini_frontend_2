// ZingMini Home — RESTORE STABLE EDITION
// Load posts, create post (FormData), logout, theme toggle.
// No chat module — stable recovery build.

const API_URL = "[https://zingmini-backend-2.onrender.com](https://zingmini-backend-2.onrender.com)";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// redirect if no auth
if (!token || !currentUser) location.href = "index.html";

const getEl = (id) => document.getElementById(id);
const postsContainer = getEl("posts-container");
const postContent = getEl("post-content");
const postImage = getEl("post-image");
const postSubmit = getEl("post-submit");
const mediaPreview = getEl("media-preview");
const toggleThemeBtn = getEl("toggle-theme");
const logoutAction = getEl("logout-action");

// small helpers
function escapeHtml(s = "") {
return String(s)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">");
}

// setup user info
const navUser = getEl("nav-username");
if (navUser) navUser.textContent = currentUser.name || "Bạn";
const navAvatar = getEl("nav-avatar");
if (navAvatar)
navAvatar.src =
currentUser.avatar ||
`https://i.pravatar.cc/40?u=${currentUser._id || "x"}`;

/* THEME TOGGLE */
function applyTheme(mode) {
document.body.classList.toggle("dark", mode === "dark");
if (toggleThemeBtn)
toggleThemeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem("zing_home_theme") || "light");

if (toggleThemeBtn) {
toggleThemeBtn.addEventListener("click", () => {
const dark = document.body.classList.toggle("dark");
const mode = dark ? "dark" : "light";
localStorage.setItem("zing_home_theme", mode);
toggleThemeBtn.textContent = dark ? "☀️" : "🌙";
});
}

/* LOGOUT */
if (logoutAction) {
logoutAction.addEventListener("click", (e) => {
e.preventDefault();
if (confirm("Bạn có muốn đăng xuất?")) {
localStorage.removeItem("token");
localStorage.removeItem("currentUser");
location.href = "index.html";
}
});
}

/* LOAD POSTS */
async function loadPosts() {
postsContainer.innerHTML =
"<p style='text-align:center;color:#777;padding:10px'>Đang tải bài viết...</p>";
try {
const res = await fetch(`${API_URL}/api/posts`);
const data = await res.json();
postsContainer.innerHTML = "";
data.forEach((p, i) => {
const post = createPostNode(p);
postsContainer.appendChild(post);
setTimeout(() => post.classList.add("loaded"), i * 50 + 50);
});
} catch (err) {
postsContainer.innerHTML =
"<p style='text-align:center;color:#c00;padding:10px'>Không tải được bài viết.</p>";
}
}
loadPosts();

/* CREATE POST NODE */
function createPostNode(post) {
const div = document.createElement("div");
div.className = "post-card";
const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
div.innerHTML = `    <div class="post-header">       <img src="${
        post.user?.avatar ||`[https://i.pravatar.cc/44?u=${post.user?._id}`](https://i.pravatar.cc/44?u=${post.user?._id}`)
}" alt="avatar"> <div> <div class="bold">${escapeHtml(post.user?.name || "Ẩn danh")}</div> <div class="small">${time}</div> </div> </div> <div class="post-content"> <p>${escapeHtml(post.content || "")}</p>
${post.image ? renderMediaHtml(post.image) : ""} </div>`;
return div;
}

/* MEDIA RENDER */
function renderMediaHtml(path) {
const url = path.startsWith("http") ? path : `${API_URL}${path}`;
const ext = url.split(".").pop().toLowerCase();
if (["mp4", "webm", "ogg"].includes(ext))
return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
return `<img src="${url}" style="width:100%;border-radius:8px;margin-top:8px"/>`;
}

/* PREVIEW MEDIA */
if (postImage && mediaPreview) {
postImage.addEventListener("change", (e) => {
const file = e.target.files[0];
mediaPreview.innerHTML = "";
if (!file) return;
const fr = new FileReader();
fr.onload = () => {
const el = document.createElement(
file.type.startsWith("video/") ? "video" : "img"
);
el.src = fr.result;
if (file.type.startsWith("video/")) el.controls = true;
el.style.maxWidth = "220px";
mediaPreview.appendChild(el);
};
fr.readAsDataURL(file);
});
}

/* CREATE POST */
if (postSubmit && postContent) {
postSubmit.addEventListener("click", async () => {
const content = postContent.value.trim();
const file = postImage?.files?.[0];
if (!content && !file) return alert("Nhập nội dung hoặc chọn ảnh!");

```
const form = new FormData();
form.append("content", content);
if (file) form.append("image", file);

try {
  const res = await fetch(`${API_URL}/api/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const newPost = await res.json();
  const node = createPostNode(newPost);
  postsContainer.prepend(node);
  postContent.value = "";
  if (postImage) postImage.value = "";
  if (mediaPreview) mediaPreview.innerHTML = "";
} catch {
  alert("Không thể đăng bài ngay bây giờ. Vui lòng thử lại sau.");
}
```

});
}

/* APPEAR EFFECT */
(function nonBlockingEffects() {
const boot = document.createElement("div");
boot.id = "zingmini-boot";
boot.innerHTML = `<div class="boot-text">ZingMini</div>`;
document.body.appendChild(boot);
requestAnimationFrame(() => boot.classList.add("show"));
setTimeout(() => boot.classList.add("hide"), 700);
setTimeout(() => boot.remove(), 1100);
})();
