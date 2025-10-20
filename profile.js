// profile.js
const API_URL = "https://zingmini-backend-2.onrender.com";

function $id(id) {
  return document.getElementById(id);
}

const token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
if (!token || !currentUser) {
  alert("Vui lòng đăng nhập.");
  location.href = "index.html";
}

// ===== Hiển thị thông tin =====
$id("pf-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/84?u=${currentUser._id}`;
$id("pf-name").textContent = currentUser.name || "Bạn";
$id("pf-email").textContent = currentUser.email || "";

$id("inp-name").value = currentUser.name || "";
$id("inp-avatar").value = currentUser.avatar || "";

// ===== Nút Hoàn tác =====
$id("cancel-profile").addEventListener("click", () => {
  $id("inp-name").value = currentUser.name || "";
  $id("inp-avatar").value = currentUser.avatar || "";
});

// ===== Lưu thay đổi tên hoặc avatar (URL) =====
$id("save-profile").addEventListener("click", async () => {
  const name = $id("inp-name").value.trim();
  const avatar = $id("inp-avatar").value.trim();
  if (!name) return alert("Tên không được để trống");
  try {
    const res = await fetch(`${API_URL}/api/users/${currentUser._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, avatar }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Lỗi");
    }
    const updated = await res.json();
    currentUser = { ...currentUser, ...updated };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    $id("pf-name").textContent = currentUser.name;
    $id("pf-avatar").src =
      currentUser.avatar || `https://i.pravatar.cc/84?u=${currentUser._id}`;

    alert("Cập nhật thông tin thành công");
  } catch (e) {
    console.error(e);
    alert("Cập nhật thất bại: " + (e.message || e));
  }
});

// ===== Đổi ảnh đại diện bằng file upload =====
const avatarFile = document.getElementById("avatar-file");
const uploadBtn = document.getElementById("upload-avatar-btn");
const pfAvatar = document.getElementById("pf-avatar");

if (uploadBtn && avatarFile && pfAvatar) {
  uploadBtn.addEventListener("click", async () => {
    const file = avatarFile.files[0];
    if (!file) return alert("Vui lòng chọn ảnh!");

    const form = new FormData();
    form.append("avatar", file);

    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser._id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");
      const updated = await res.json();

      // Cập nhật localStorage và UI
      currentUser = { ...currentUser, ...updated };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      pfAvatar.src = updated.avatar?.startsWith("http")
        ? updated.avatar
        : `${API_URL}${updated.avatar}`;
      alert("✅ Đã đổi ảnh đại diện thành công!");
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi tải ảnh lên!");
    }
  });
}

// ===== Hiển thị bài viết của người dùng =====
async function loadUserPosts() {
  const container = $id("user-posts");
  container.innerHTML = `<div class="small">Đang tải...</div>`;
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Không tải được bài");
    const j = await res.json();
    let posts = Array.isArray(j) ? j : j.posts || j.data || [];
    if (!Array.isArray(posts)) posts = [];

    posts = posts.filter((p) => {
      const u = p.user || p.author || p.owner || {};
      const uid = u._id || u.id || p.userId || p.user;
      return String(uid) === String(currentUser._id);
    });

    container.innerHTML = "";
    if (!posts.length) {
      container.innerHTML = `<div class="small">Bạn chưa có bài đăng nào.</div>`;
      return;
    }

    posts.forEach((p) => {
      const d = document.createElement("div");
      d.className = "post-item";
      const time = new Date(p.createdAt || Date.now()).toLocaleString();
      d.innerHTML = `<div style="font-weight:700">${escapeHtml(
        p.content || p.text || ""
      )}</div><div class="small" style="margin-top:6px">${escapeHtml(
        time
      )}</div>`;
      container.appendChild(d);
    });
  } catch (e) {
    console.warn(e);
    container.innerHTML = `<div class="small">Không thể tải bài: ${
      e.message || e
    }</div>`;
  }
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

loadUserPosts();
