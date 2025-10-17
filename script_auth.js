// script_auth.js — phiên bản hoàn chỉnh, giữ nguyên hiệu ứng, chỉ fix API chuẩn

const API_BASE = "https://zingmini-backend-2.onrender.com/api"; // ✅ Backend Render có /api

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");

  // 🔹 Đăng nhập
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) return alert("Vui lòng nhập đủ thông tin!");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }), // ✅ Dùng đúng field backend yêu cầu
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Sai tài khoản hoặc mật khẩu");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      alert("🎉 Đăng nhập thành công!");
      window.location.href = "home.html";
    } catch (err) {
      alert("Lỗi đăng nhập: " + err.message);
    }
  });

  // 🔹 Đăng ký
  registerBtn.addEventListener("click", async () => {
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!name || !email || !password)
      return alert("Vui lòng nhập đầy đủ thông tin!");

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }), // ✅ Chuẩn theo backend
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Không thể đăng ký tài khoản");

      alert("💜 Đăng ký thành công! Hãy đăng nhập nhé ❤️");
      switchToLogin(); // chuyển về form đăng nhập (hiệu ứng giữ nguyên)
    } catch (err) {
      alert("Lỗi đăng ký: " + err.message);
    }
  });
});
