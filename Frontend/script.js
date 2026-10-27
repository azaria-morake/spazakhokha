
const message = document.getElementById("message");
const customersPage = document.getElementById("customersPage");

const dashboardSections = [
  document.querySelector(".topbar"),
  document.querySelector(".summary-grid"),
  document.querySelector(".quick-actions"),
  document.querySelector(".transactions")
];

let customers = [];
let nextCustomerNumber = 1;

let purchases = [];
let nextPurchaseNumber = 1;

let repayments = [];
let nextRepaymentNumber = 1;

const creditTabsPage = document.getElementById("creditTabsPage");

const repaymentsPage = document.getElementById("repaymentsPage");
const repaymentForm = document.getElementById("repaymentForm");
const repaymentCustomer = document.getElementById("repaymentCustomer");
const repaymentAmount = document.getElementById("repaymentAmount");
const repaymentNote = document.getElementById("repaymentNote");
const repaymentBalance = document.getElementById("repaymentBalance");
const repaymentList = document.getElementById("repaymentList");
const repaymentEmpty = document.getElementById("repaymentEmpty");


function showMessage(text) {
  message.textContent = text;
}

function openCustomers() {
  dashboardSections.forEach(section => {
    section.hidden = true;
  });

  customersPage.hidden = false;
  renderCustomers();
}

function openDashboard() {
  customersPage.hidden = true;

  dashboardSections.forEach(section => {
    section.hidden = false;
  });

    creditTabsPage.hidden = true;
    repaymentsPage.hidden = true;

}

function openCustomerForm() {
  document.getElementById("customerFormContainer").hidden = false;
  document.getElementById("customerName").focus();
}

function renderCustomers() {
  const searchInput = document.getElementById("customerSearch");
  const list = document.getElementById("customerList");
  const empty = document.getElementById("customerEmpty");

  const search = searchInput.value.trim().toLowerCase();

  // Filter all registered customers.
  const filtered = customers.filter(customer =>
    customer.id.toLowerCase().includes(search) ||
    customer.name.toLowerCase().includes(search) ||
    customer.phone.toLowerCase().includes(search)
  );

  // Rebuild the visible list.
  list.replaceChildren();

  filtered.forEach(customer => {
    const row = document.createElement("tr");

    const values = [
      customer.id,
      customer.name,
      customer.phone,
      `R${customer.balance.toFixed(2)}`
    ];

    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    list.appendChild(row);
  });

  // Show the correct empty-state message.
  empty.hidden = filtered.length > 0;

  if (customers.length === 0) {
    empty.textContent = "No customers yet. Add your first customer.";
  } else {
    empty.textContent = "No matching customers found.";
  }

  // Update the dashboard customer count.
  document.getElementById("customers").textContent =
    customers.length;
}


function openCreditTabs() {
  dashboardSections.forEach(section => {
    section.hidden = true;
  });

  customersPage.hidden = true;
  creditTabsPage.hidden = false;

  renderCustomerOptions();
  renderPurchases();
}

function renderCustomerOptions() {
  const select = document.getElementById("purchaseCustomer");
  const previousValue = select.value;

  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a customer";
  select.appendChild(placeholder);

  customers.forEach(customer => {
    const option = document.createElement("option");
    option.value = customer.id;
    option.textContent = `${customer.name} (${customer.id})`;
    select.appendChild(option);
  });

  if (customers.some(c => c.id === previousValue)) {
    select.value = previousValue;
  }
}

function renderPurchases() {
  const list = document.getElementById("purchaseList");
  const empty = document.getElementById("purchaseEmpty");
  const search = document.getElementById("tabSearch")
    .value.trim().toLowerCase();

  list.replaceChildren();

  const filtered = purchases.filter(purchase =>
    purchase.customerName.toLowerCase().includes(search) ||
    purchase.customerId.toLowerCase().includes(search) ||
    purchase.description.toLowerCase().includes(search)
  );

  filtered.forEach(purchase => {
    const row = document.createElement("tr");

    const values = [
      purchase.customerName,
      purchase.description,
      `R${purchase.amount.toFixed(2)}`,
      purchase.date
    ];

    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    list.appendChild(row);
  });

  empty.hidden = filtered.length > 0;
  empty.textContent = purchases.length === 0
    ? "No credit purchases recorded yet."
    : "No matching purchases found.";

  const total = customers.reduce(
    (sum, customer) => sum + customer.balance, 0
  );

  const owing = customers.filter(
    customer => customer.balance > 0
  ).length;

  document.getElementById("totalOutstanding").textContent =
    `R${total.toFixed(2)}`;

  document.getElementById("customersWithTabs").textContent =
    owing;

  document.getElementById("outstanding").textContent =
    `R${total.toFixed(2)}`;
}


function openRepayments() {
  dashboardSections.forEach(section => {
    section.hidden = true;
  });

  customersPage.hidden = true;
  creditTabsPage.hidden = true;
  repaymentsPage.hidden = false;

  renderRepaymentCustomers();
  renderRepayments();
  updateRepaymentBalance();
}

function renderRepaymentCustomers() {
  const previousValue = repaymentCustomer.value;

  repaymentCustomer.innerHTML =
    '<option value="">Select a customer</option>';

  customers.forEach(customer => {
    if (customer.balance > 0) {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent = `${customer.name} (${customer.id})`;
      repaymentCustomer.appendChild(option);
    }
  });

  if ([...repaymentCustomer.options].some(
    option => option.value === previousValue
  )) {
    repaymentCustomer.value = previousValue;
  }
}

function updateRepaymentBalance() {
  const customer = customers.find(
    item => item.id === repaymentCustomer.value
  );

  repaymentBalance.textContent = customer
    ? `R${customer.balance.toFixed(2)}`
    : "R0.00";
}

function renderRepayments() {
  repaymentList.innerHTML = "";

  repayments.forEach(repayment => {
    const row = document.createElement("tr");

    [
      repayment.id,
      repayment.customerName,
      `R${repayment.amount.toFixed(2)}`,
      repayment.date,
      repayment.note || "—"
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    repaymentList.appendChild(row);
  });

  repaymentEmpty.hidden = repayments.length > 0;
}



document.getElementById("purchaseForm")
  .addEventListener("submit", event => {
    event.preventDefault();

    const customerId =
      document.getElementById("purchaseCustomer").value;

    const description =
      document.getElementById("purchaseDescription")
        .value.trim();

    const amount = Number(
      document.getElementById("purchaseAmount").value
    );

    const customer = customers.find(
      item => item.id === customerId
    );

    if (!customer) {
      showMessage("Please register and select a customer first.");
      return;
    }

    if (
      !description ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000
    ) {
      showMessage("Enter a description and a valid purchase amount.");
      return;
    }

    // Increase the customer's outstanding credit balance.
    customer.balance = Math.round(
      (customer.balance + amount) * 100
    ) / 100;

    purchases.unshift({
      id: `PUR-${nextPurchaseNumber++}`,
      customerId: customer.id,
      customerName: customer.name,
      description,
      amount,
      date: new Date().toLocaleDateString("en-ZA")
    });

    event.target.reset();

    renderPurchases();
    renderCustomers();

    showMessage(
      `Purchase recorded. ${customer.name}'s outstanding tab is R${customer.balance.toFixed(2)}.`
    );
  });

document.getElementById("tabSearch")
  .addEventListener("input", renderPurchases);


// Open customer management.
document.getElementById("addCustomerBtn")
  .addEventListener("click", () => {
    openCustomers();
    openCustomerForm();
  });

document.getElementById("newCustomerBtn")
  .addEventListener("click", openCustomerForm);

// Register a new customer without deleting existing customers.
document.getElementById("customerForm")
  .addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("customerName")
      .value.trim();

    const phone = document.getElementById("customerPhone")
      .value.trim();

    if (!name || !phone) {
      showMessage("Please enter a name and phone number.");
      return;
    }

    const customer = {
      id: `SK-${String(nextCustomerNumber).padStart(4, "0")}`,
      name: name,
      phone: phone,
      balance: 0
    };

    nextCustomerNumber++;
    customers.push(customer);

    // Clear the form and display the new record.
    event.target.reset();
    document.getElementById("customerFormContainer").hidden = true;

    // Clear any previous search so the new customer is visible.
    document.getElementById("customerSearch").value = "";

    renderCustomers();

    showMessage(`${customer.name} added successfully (${customer.id}).`);
  });

// Search immediately as the user types.
document.getElementById("customerSearch")
  .addEventListener("input", renderCustomers);

// Cancel registration.
document.getElementById("cancelCustomerBtn")
  .addEventListener("click", () => {
    document.getElementById("customerForm").reset();
    document.getElementById("customerFormContainer").hidden = true;
    showMessage("");
  });

// Dashboard quick actions.
document.getElementById("purchaseBtn")
  .addEventListener("click", () => {
    showMessage("The purchase screen is coming next.");
  });

document.getElementById("repaymentBtn")
  .addEventListener("click", () => {
    showMessage("The repayment screen is coming next.");
  });

document.getElementById("viewCustomersBtn")
  .addEventListener("click", openCustomers);

// Navigation.

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();

    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    link.classList.add("active");

    const page = link.textContent.trim();

    if (page === "Dashboard") {
      openDashboard();
      showMessage("");
    } else if (page === "Customers") {
      creditTabsPage.hidden = true;
      openCustomers();
      showMessage("");
    } else if (page === "Credit Tabs") {
      openCreditTabs();
      showMessage("");
    } else if (page === "Repayments") {
        openRepayments();
        showMessage("");
    } else {
      customersPage.hidden = true;
      creditTabsPage.hidden = true;

      dashboardSections.forEach(section => {
        section.hidden = true;
      });

      showMessage(`${page} screen is coming next.`);
    }
  });
});


repaymentCustomer.addEventListener("change", updateRepaymentBalance);

repaymentForm.addEventListener("submit", event => {
  event.preventDefault();

  const customer = customers.find(
    item => item.id === repaymentCustomer.value
  );

  const amount = Number(repaymentAmount.value);
  const note = repaymentNote.value.trim();

  if (!customer) {
    showMessage("Please select a customer.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("Enter a valid repayment amount.");
    return;
  }

  if (amount > customer.balance) {
    showMessage(
      `The repayment cannot exceed the outstanding balance of R${customer.balance.toFixed(2)}.`
    );
    return;
  }

  customer.balance = Math.round((customer.balance - amount) * 100) / 100;

  repayments.unshift({
    id: `RP-${String(nextRepaymentNumber++).padStart(4, "0")}`,
    customerId: customer.id,
    customerName: customer.name,
    amount,
    date: new Date().toLocaleDateString("en-ZA"),
    note
  });

  repaymentForm.reset();

  renderRepaymentCustomers();
  renderRepayments();
  renderCustomers();
  renderPurchases();
  updateRepaymentBalance();

  showMessage(
    `Repayment of R${amount.toFixed(2)} recorded for ${customer.name}.`
  );
});
