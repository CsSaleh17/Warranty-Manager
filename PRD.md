# Product Requirements Document (PRD)

## Product Name

Warranty Manager

## Overview

Warranty Manager is a responsive web application that helps users store, organize, and track product warranties and purchase invoices in one place.

Users can add purchased products, upload invoice files, save warranty details, and track how many days remain before each warranty expires.

The application solves common problems such as losing invoices, forgetting warranty expiration dates, and difficulty finding product information when maintenance or repair is needed.

### Target Users

- Individuals who own electronic devices or household products.
- Families managing warranties for multiple products.
- Students and professionals managing laptops, phones, and accessories.
- Small businesses tracking company equipment.

## Core Features

### User Authentication

- Create an account.
- Log in using email and password.
- Log out securely.
- Each user can access only their own data.

### Product Management

Users can:

- Add a product.
- View product details.
- Edit product information.
- Delete a product.

Each product includes:

- Product name.
- Category.
- Store name.
- Purchase date.
- Warranty duration.
- Warranty unit.
- Serial number.
- Invoice image or PDF.
- Optional notes.

### Warranty Tracking

The system automatically calculates:

- Warranty expiration date.
- Remaining warranty days.
- Warranty status.

Warranty statuses:

- **Active:** More than 30 days remain.
- **Expiring Soon:** Between 0 and 30 days remain.
- **Expired:** The expiration date has passed.
- **No Warranty:** The product does not have a warranty.
- **Unknown:** Warranty information is incomplete.

### Dashboard

The dashboard displays:

- Total products.
- Active warranties.
- Warranties expiring soon.
- Expired warranties.
- Recently added products.
- Products with the nearest expiration dates.

### Search and Filtering

Users can search by:

- Product name.
- Store name.
- Serial number.

Users can filter by:

- Product category.
- Warranty status.

Users can sort by:

- Product name.
- Purchase date.
- Warranty expiration date.
- Recently added products.

### Invoice Management

Users can:

- Upload an invoice.
- Preview an invoice.
- Download an invoice.
- Replace an invoice.
- Delete an invoice.

Supported formats:

- JPG
- JPEG
- PNG
- PDF

## UX Flow

1. The user creates an account or logs in.
2. The user opens the dashboard.
3. The user selects **Add Product**.
4. The user enters the product and warranty information.
5. The user optionally uploads an invoice.
6. The system validates the entered information.
7. The backend calculates the warranty expiration date.
8. The product is saved in the database.
9. The user views the product and its warranty status.
10. The user can later search, edit, or delete the product.

### Main Pages

- Login.
- Registration.
- Dashboard.
- Products.
- Add Product.
- Product Details.
- Edit Product.
- Expiring Soon.
- Profile.
- Not Found.

## Technology Stack

### Frontend

- React.
- JavaScript.
- HTML5.
- CSS3.
- React Router.
- Fetch API.

### Backend

- Node.js.
- Express.js.

### Database

- MySQL.
- mysql2.

### Authentication

- express-session.
- bcrypt.

### File Uploads

- multer.
- Local file storage during development.

### Testing

- Jest.
- Supertest.
- React Testing Library.

## Database Structure

### Users Table

| Field         | Type      | Description            |
| ------------- | --------- | ---------------------- |
| id            | INT       | Unique user identifier |
| full_name     | VARCHAR   | User full name         |
| email         | VARCHAR   | Unique email address   |
| password_hash | VARCHAR   | Hashed password        |
| created_at    | TIMESTAMP | Account creation date  |
| updated_at    | TIMESTAMP | Last account update    |

### Products Table

| Field             | Type      | Description                |
| ----------------- | --------- | -------------------------- |
| id                | INT       | Unique product identifier  |
| user_id           | INT       | Product owner              |
| name              | VARCHAR   | Product name               |
| category          | VARCHAR   | Product category           |
| store_name        | VARCHAR   | Purchase store             |
| purchase_date     | DATE      | Purchase date              |
| warranty_duration | INT       | Warranty length            |
| warranty_unit     | ENUM      | Days, months, or years     |
| expiration_date   | DATE      | Calculated expiration date |
| serial_number     | VARCHAR   | Product serial number      |
| invoice_path      | VARCHAR   | Invoice file path          |
| notes             | TEXT      | Optional notes             |
| created_at        | TIMESTAMP | Product creation date      |
| updated_at        | TIMESTAMP | Last product update        |

## Validation Rules

- Email must use a valid format.
- Email addresses must be unique.
- Product name is required.
- Category is required.
- Store name is required.
- Purchase date is required.
- Purchase date cannot be in the future.
- Warranty duration must be greater than zero.
- Warranty unit must be days, months, or years.
- Invoice files must use an approved format.
- Invoice files must not exceed 5 MB.
- Users cannot access products owned by another user.
- Backend validation is the final source of truth.

## Security Requirements

- Hash passwords using bcrypt.
- Store secrets and database credentials in `.env`.
- Never hardcode passwords, API keys, or session secrets.
- Use parameterized MySQL queries.
- Validate and sanitize user input.
- Protect against SQL Injection.
- Protect against XSS.
- Protect sensitive requests against CSRF.
- Use HTTP-only session cookies.
- Protect private endpoints.
- Verify product ownership before viewing, editing, or deleting.
- Validate uploaded files by extension, MIME type, and size.
- Do not expose stack traces or database errors.
- Apply rate limiting to login and registration routes.
- Use Helmet security headers.

## Constraints

Technical constraints:

- The frontend must use React and JavaScript.
- The backend must use Node.js and Express.js.
- The database must use MySQL.
- The application must be responsive.
- Users must log in before accessing private pages.
- Users must access only their own data.
- Sensitive values must not be hardcoded.
- Passwords must never be stored as plain text.

## MVP Acceptance Criteria

The MVP is complete when:

- Users can register, log in, and log out.
- Users can add, view, edit, and delete products.
- Users can upload and access invoice files.
- Warranty expiration dates are calculated correctly.
- Remaining days and warranty status are displayed correctly.
- Users can search and filter products.
- The dashboard displays accurate statistics.
- Expiring warranties appear in a dedicated section.
- Users cannot access another user’s products.
- Invalid input displays clear error messages.
- The application works on desktop and mobile devices.
