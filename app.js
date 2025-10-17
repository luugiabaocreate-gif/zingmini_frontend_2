// 💙 ZingMini Classic - Login/Register Script
const backendURL = "https://zingmini-backend-2.onrender.com";

// ---------------- LOGIN ----------------
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!email || !password) {
    alert("Vui lòng nhập đủ thông tin!");
    return;
  }

  try {
    const res = await fetch(`${backendURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Đăng nhập thất bại");

    // ✅ Lưu token + user
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    alert("Đăng nhập thành công!");
    window.location.href = "home.html";
  } catch (err) {
    alert("Lỗi đăng nhập: " + err.message);
  }
});

// ---------------- REGISTER ----------------
document.getElementById("registerBtn").addEventListener("click", async () => {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  if (!name || !email || !password) {
    alert("Vui lòng nhập đủ thông tin!");
    return;
  }

  try {
    const res = await fetch(`${backendURL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Đăng ký thất bại");

    alert("Đăng ký thành công! Giờ bạn có thể đăng nhập.");
    document.getElementById("registerName").value = "";
    document.getElementById("registerEmail").value = "";
    document.getElementById("registerPassword").value = "";
    switchToLogin();
  } catch (err) {
    alert("Lỗi đăng ký: " + err.message);
  }
});
