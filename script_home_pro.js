// ZingMini Home Lite — bản đơn giản ổn định nhất
// Chức năng: load posts, đăng bài, preview ảnh, logout, theme toggle.
// Không có socket, chat, hiệu ứng. Tương thích backend v3.

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Chưa đăng nhập thì quay lại index
if (!token || !currentUser) location.href = "index.html";

// DOM helpers
const $ = (id) => document.getElementById(id);
const postsContainer = $("posts-container");
const postContent = $("post-content");
const postImage = $("post-image");
const postSubmit = $("post-submit");
const mediaPreview = $("media-preview");
const toggleThemeBtn = $("toggle-theme");
const logoutAction = $("logout-action");

// Hiển thị tên & avatar
const navUser = $("nav-username");
if (navUser) navUser.textContent = currentUser.name || "Bạn";
const navAvatar = $("nav-avatar");
if (navAvatar)
  navAvatar.src =
    currentUser.avatar || `https://i.pravatar.cc/40?u=${currentUser._id}`;

// =================== THEME ===================
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  if (toggleThemeBtn)
    toggleThemeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem("zing_theme") || "light");

if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener("click", () => {
    const newMode = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("zing_theme", newMode);
    applyTheme(newMode);
  });
}

// =================== LOGOUT ===================
if (logoutAction) {
  logoutAction.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Đăng xuất tài khoản này?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      location.href = "index.html";
    }
  });
}

// =================== LOAD POSTS ===================
async function loadPosts() {
  postsContainer.innerHTML =
    "<p style='text-align:center;color:#888;padding:12px'>Đang tải bài viết...</p>";
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const data = await res.json();
    postsContainer.innerHTML = "";
    if (!data.length) {
      postsContainer.innerHTML =
        "<p style='text-align:center;color:#888;padding:12px'>Chưa có bài viết nào.</p>";
      return;
    }
    data.forEach((p, i) => {
      const node = createPostNode(p);
      postsContainer.appendChild(node);
      setTimeout(() => node.classList.add("loaded"), i * 60 + 60);
    });
  } catch (err) {
    console.error("Lỗi load posts:", err);
    postsContainer.innerHTML =
      "<p style='text-align:center;color:#c00;padding:12px'>Không tải được bài viết.</p>";
  }
}
loadPosts();

// =================== CREATE POST ===================
if (postSubmit && postContent) {
  postSubmit.addEventListener("click", async () => {
    const content = postContent.value.trim();
    const file = postImage?.files?.[0] || null;
    if (!content && !file) return alert("Nhập nội dung hoặc chọn ảnh!");

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
    } catch (err) {
      console.error("Đăng bài lỗi:", err);
      alert("Không thể đăng bài. Thử lại sau!");
    }
  });
}

// =================== MEDIA PREVIEW ===================
if (postImage && mediaPreview) {
  postImage.addEventListener("change", (e) => {
    const file = e.target.files[0];
    mediaPreview.innerHTML = "";
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["mp4", "webm", "ogg"].includes(ext)) {
        const v = document.createElement("video");
        v.src = fr.result;
        v.controls = true;
        v.style.maxWidth = "220px";
        mediaPreview.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = fr.result;
        img.style.maxWidth = "220px";
        mediaPreview.appendChild(img);
      }
    };
    fr.readAsDataURL(file);
  });
}

// =================== RENDER POST CARD ===================
function createPostNode(post) {
  const div = document.createElement("div");
  div.className = "post-card";
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  div.innerHTML = `
    <div class="post-header">
      <img src="${
        post.user?.avatar || `https://i.pravatar.cc/44?u=${post.user?._id}`
      }" alt="avatar">
      <div>
        <div class="bold">${escapeHtml(post.user?.name || "Ẩn danh")}</div>
        <div class="small">${time}</div>
      </div>
    </div>
    <div class="post-content">
      <p>${escapeHtml(post.content || "")}</p>
      ${post.image ? renderMediaHtml(post.image) : ""}
    </div>
  `;
  return div;
}

function renderMediaHtml(path) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext))
    return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  return `<img src="${url}" style="width:100%;border-radius:8px;margin-top:8px"/>`;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
