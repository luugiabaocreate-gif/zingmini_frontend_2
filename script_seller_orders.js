const API_URL = "https://zingmini-backend-2.onrender.com";

async function loadOrders() {
  const res = await fetch(`${API_URL}/api/orders`);
  const orders = await res.json();

  const container = document.getElementById("orderList");
  container.innerHTML = "";

  orders.forEach(o => {
    const div = document.createElement("div");
    div.className = "order-card";
    div.innerHTML = `
      <h3>Khách: ${o.buyerName}</h3>
      <p>Sản phẩm: ${o.products.map(p => p.product?.name).join(", ")}</p>
      <p>Trạng thái: ${o.status}</p>
    `;
    container.appendChild(div);
  });
}

loadOrders();
