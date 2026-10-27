# SpazaKhokha — Frontend

## About the Project

SpazaKhokha is a digital solution designed to support South African spaza shops by simplifying customer credit management and repayment tracking.

This repository contains the frontend interface, designed to give shopkeepers a simple and accessible way to manage customer accounts, record credit purchases, and track outstanding balances.

The project is being developed as part of a hackathon exploring how digital payment technologies can support informal businesses in South Africa.

## Features

### Dashboard
- Overview of shop activity and customer credit.
- Summary of outstanding balances and registered customers.
- Quick actions for common shopkeeping tasks.
- Recent transaction overview.

### Customer Management
- Register customers with their names and phone numbers.
- Generate unique customer IDs.
- Search customers by name, phone number, or customer ID.
- View customer outstanding balances.

### Credit Tabs
- Record customer purchases made on credit.
- Associate purchases with registered customers.
- Calculate outstanding credit balances.
- Search and review recorded credit purchases.

### Repayments
- Record repayments against customer credit balances.
- Display the customer's outstanding balance before repayment.
- Prevent repayments that exceed the outstanding balance.
- View recent repayment records.

## Technologies Used

- **HTML5** : page structure and content.
- **CSS3** :styling, layout, and responsive design.
- **JavaScript** : interface interactions, customer management, credit tracking, and repayment logic.

The frontend is being developed with the intention of connecting to a Python backend and payment-related services.

## Project Structure

```text
spazakhokha/
├── index.html
├── style.css
├── script.js
├── assets/
│   └── logo.jpeg
└── README.md
```

*The file structure may change as development continues.*

## Getting Started

### Prerequisites

- A web browser.
- A code editor such as Visual Studio Code.
- Git, if cloning the repository.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/azaria-morake/spazakhokha.git
   ```

2. Navigate to the project directory:

   ```bash
   cd spazakhokha
   ```

3. Open the folder in Visual Studio Code:

   ```bash
   code .
   ```

4. Open `index.html` in your browser. Alternatively, use the Live Server extension in Visual Studio Code to run the frontend locally.

## Current Development Status

The frontend prototype includes dashboard navigation, customer registration and search, credit purchase recording, outstanding balance calculations, and repayment tracking.

At this stage, the application uses in-memory JavaScript data. Records are not permanently saved and will be lost when the page is refreshed.

Backend integration, persistent database storage, authentication, and real payment processing are not yet implemented in this frontend prototype.

## Future Improvements

- Connect to the Python backend and database.
- Persist customer, purchase, and repayment records.
- Integrate supported payment services through the project's chosen payment architecture.
- Add transaction history and filtering.
- Improve validation, error handling, and accessibility.
- Add authentication and role-based access controls.
- Expand responsive support for mobile devices.

## Team

SpazaKhokha is a collaborative hackathon project focused on practical digital tools for South African spaza shops.

## Disclaimer

SpazaKhokha is a prototype under development. The current frontend is intended for demonstration and testing, not for managing real financial records or processing actual payments.