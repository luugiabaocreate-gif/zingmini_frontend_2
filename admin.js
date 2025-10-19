const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const adminArea = document.getElementById("admin-area");

if (!token || !currentUser) {
  adminArea.innerHTML = `<div class="small">Bạn chưa đăng nhập.</div>`;
} else {
  // simple permission check: assume backend has role flag in user object
  if (!currentUser.role || currentUser.role !== "admin") {
    adminArea.innerHTML = `<div class="small">Bạn không có quyền truy cập (cần role: admin).</div>`;
  } else {
    adminArea.innerHTML = `<div class="small">Đang tải danh sách người dùng...</div>`;
    (async ()=>{
      try {
        const res = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` }});
        if (!res.ok) throw new Error("Không lấy được danh sách");
        const users = await res.json();
        const rows = (Array.isArray(users)?users:(users.data||users.users||[]));
        let html = `<table><thead><tr><th>Tên</th><th>Email</th><th>ID</th><th>Hành động</th></tr></thead><tbody>`;
        rows.forEach(u=>{
          html += `<tr data-id="${u._id||u.id}"><td>${escapeHtml(u.name||"")}</td><td>${escapeHtml(u.email||"")}</td><td>${escapeHtml(u._id||u.id)}</td><td><button class="btn ban" data-id="${u._id||u.id}">Xóa</button></td></tr>`;
        });
        html += `</tbody></table>`;
        adminArea.innerHTML = html;
        adminArea.querySelectorAll("button.ban").forEach(b=>{
          b.addEventListener("click", async (ev) => {
            const id = b.getAttribute("data-id");
            if (!confirm("Xác nhận xóa user " + id)) return;
            try {
              const r = await fetch(`${API_URL}/api/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }});
              if (!r.ok) throw new Error("Xóa thất bại");
              alert("Đã xóa user " + id);
              // remove row visually
              const tr = adminArea.querySelector(`tr[data-id="${id}"]`);
              if (tr) tr.remove();
            } catch (e) {
              console.error(e); alert("Lỗi: "+(e.message||e));
            }
          });
        });
      } catch (e) {
        console.error(e);
        adminArea.innerHTML = `<div class="small">Lỗi: ${e.message||e}</div>`;
      }
    })();
  }
}

function escapeHtml(s=""){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
