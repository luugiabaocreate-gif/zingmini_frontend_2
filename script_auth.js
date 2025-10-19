// script_auth.js — minimal auth helpers (kept compatible with existing backend)
const API_URL = "https://zingmini-backend-2.onrender.com";

async function postJson(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loginHandler(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value?.trim();
  const password = document.getElementById("login-password")?.value?.trim();
  if (!email || !password) return alert("Nhập email và mật khẩu");
  try {
    const data = await postJson(`${API_URL}/api/auth/login`, { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    location.href = "home.html";
  } catch (err) {
    console.error("Login error", err);
    alert("Đăng nhập thất bại");
  }
}

// attach if login form exists
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  if (form) form.addEventListener("submit", loginHandler);
});
