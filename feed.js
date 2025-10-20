const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const feedList = document.getElementById("feed-list");
document.getElementById("refresh-feed").addEventListener("click", loadFeed);

async function loadFeed() {
  feedList.innerHTML = "<div class='small'>Đang tải...</div>";
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Không tải được");
    const j = await res.json();
    let posts = Array.isArray(j) ? j : j.posts || j.data || [];
    if (!Array.isArray(posts)) posts = [];

    // === Đảo ngược thứ tự: tin mới nhất lên trên ===
    posts.reverse();

    feedList.innerHTML = "";
    if (!posts.length)
      feedList.innerHTML = "<div class='small'>Chưa có bài viết</div>";
    posts.forEach((p) => {
      const div = document.createElement("div");
      div.className = "post-card";
      const user = p.user || p.author || { name: p.name || "Ẩn danh" };
      const time = new Date(p.createdAt || Date.now()).toLocaleString();
      div.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="font-weight:700">${escapeHtml(
        user.name || ""
      )}</div><div class="small" style="margin-left:auto">${escapeHtml(
        time
      )}</div></div><div style="margin-top:8px">${escapeHtml(
        p.content || p.text || ""
      )}</div>`;
      feedList.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    feedList.innerHTML = `<div class="small">Lỗi: ${e.message || e}</div>`;
  }
}
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
loadFeed();
