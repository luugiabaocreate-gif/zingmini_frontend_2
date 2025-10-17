// script_auth.js — phiên bản chuẩn cho ZingMini Frontend 2

const API_BASE = "https://zingmini-backend-2.onrender.com/api"; // Backend mới

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const toggleLogin = document.getElementById("toggle-login");
  const toggleRegister = document.getElementById("toggle-register");

  toggleLogin.addEventListener("click", () => {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  });

  toggleRegister.addEventListener("click", () => {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });

  // 🔹 Đăng nhập
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error("Sai tài khoản hoặc mật khẩu");

      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      alert("Đăng nhập thành công!");
      window.location.href = "home.html";
    } catch (err) {
      alert("Lỗi đăng nhập: " + err.message);
    }
  });

  // 🔹 Đăng ký
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error("Không thể đăng ký");

      alert("Đăng ký thành công! Hãy đăng nhập.");
      toggleLogin.click();
    } catch (err) {
      alert("Lỗi đăng ký: " + err.message);
    }
  });
});
