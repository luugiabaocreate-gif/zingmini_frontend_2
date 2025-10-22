const API_URL = "https://zingmini-backend-2.onrender.com";

const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");

async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  if (!email || !password) return alert("Vui lòng nhập đủ email và mật khẩu!");

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Đăng nhập thất bại");

    // 🧩 Chuẩn hóa avatar NGAY SAU khi nhận response
    if (data && data.user) {
      // ✅ Luôn chuẩn hóa đường dẫn avatar (relative -> full URL)
if (data.user.avatar) {
  if (data.user.avatar.startsWith("/")) {
    data.user.avatar = `${API_URL}${data.user.avatar}`;
  } else if (data.user.avatar.startsWith("http://")) {
    data.user.avatar = data.user.avatar.replace("http://", "https://");
  }
} else {
  data.user.avatar = `${API_URL}/uploads/default_avatar.png`;
}

// ✅ Lưu vào localStorage để frontend đọc được khi F5
localStorage.setItem("token", data.token);
localStorage.setItem("currentUser", JSON.stringify(data.user));
console.log("✅ Saved currentUser:", data.user);

      localStorage.setItem("token", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
    }

    alert("Đăng nhập thành công!");
    location.href = "home.html";
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    alert(err.message || "Lỗi máy chủ khi đăng nhập!");
  }
}

async function handleRegister() {
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();
  if (!name || !email || !password)
    return alert("Điền đủ thông tin để đăng ký!");

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Đăng ký thất bại");

    alert("Đăng ký thành công! Vui lòng đăng nhập lại.");
    const showLogin = document.getElementById("show-login");
    if (showLogin) showLogin.click();
  } catch (err) {
    console.error("Lỗi đăng ký:", err);
    alert(err.message || "Lỗi máy chủ khi đăng ký!");
  }
}

if (loginBtn) loginBtn.addEventListener("click", handleLogin);
if (registerBtn) registerBtn.addEventListener("click", handleRegister);
