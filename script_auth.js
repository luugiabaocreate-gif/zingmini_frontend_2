// =================== TOAST ===================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  document.getElementById("toast-container").appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 2500);
}

// =================== FORM TOGGLE ===================
const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});
registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
});

// =================== LOGIN ===================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(
      "https://zingmini-backend-2.onrender.com/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      showToast("Đăng nhập thành công", "success");
      setTimeout(() => {
        window.location.href = "home.html";
      }, 500);
    } else {
      showToast(data.message || "Đăng nhập thất bại", "error");
    }
  } catch (err) {
    showToast("Lỗi mạng", "error");
    console.error(err);
  }
});

// =================== REGISTER ===================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

  try {
    const res = await fetch(
      "https://zingmini-backend-2.onrender.com/api/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      showToast("Đăng ký thành công", "success");
      setTimeout(() => {
        window.location.href = "home.html";
      }, 500);
    } else {
      showToast(data.message || "Đăng ký thất bại", "error");
    }
  } catch (err) {
    showToast("Lỗi mạng", "error");
    console.error(err);
  }
});
