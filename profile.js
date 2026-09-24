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
const avatarFile = $id("avatar-file");
const uploadBtn = $id("upload-avatar-btn");
const pfAvatar = $id("pf-avatar");
const profileAvatarFileName = $id("profile-avatar-file-name");

if (avatarFile && profileAvatarFileName) {
  avatarFile.addEventListener("change", () => {
    const file = avatarFile.files?.[0];
    profileAvatarFileName.textContent = file ? file.name : "Chưa chọn tệp";
    profileAvatarFileName.title = file ? file.name : "";
  });
}

if (uploadBtn && avatarFile && pfAvatar) {
  uploadBtn.addEventListener("click", async () => {
    const file = avatarFile.files?.[0];
    if (!file) return alert("Vui lòng chọn ảnh trước!");
    if (!file.type.startsWith("image/")) return alert("Vui lòng chọn tệp hình ảnh.");

    const form = new FormData();
    form.append("avatar", file);

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Đang tải lên...";
    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser._id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const newAvatar = data.user?.avatar || data.avatar;
      if (!newAvatar) throw new Error("Server không trả về URL ảnh đại diện mới.");

      const finalUrl = newAvatar.startsWith("http") ? newAvatar : `${API_URL}${newAvatar}`;
      currentUser = { ...currentUser, ...(data.user || {}), avatar: finalUrl };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      pfAvatar.src = finalUrl;
      avatarFile.value = "";
      if (profileAvatarFileName) {
        profileAvatarFileName.textContent = "Đã tải ảnh";
        profileAvatarFileName.title = "";
      }
      alert("Ảnh đại diện đã được cập nhật.");
    } catch (err) {
      console.error("Upload avatar error:", err);
      alert("Lỗi khi tải ảnh: " + (err.message || err));
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Tải lên ảnh đại diện";
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
