# CablePay Backend API

Node.js + Express + SQLite backend for Cable Bill Manager application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Seed the database:
```bash
npm run seed
```

3. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3001`

## Default Credentials

- **Username:** admin
- **Password:** admin123

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token

### Homes
- `GET /api/homes/:homeId` - Get home by ID with payment status
- `POST /api/homes` - Create new home

### Payments
- `POST /api/payments/mark-paid` - Mark payment as paid
- `PUT /api/payments/mark-unpaid` - Mark payment as unpaid
- `GET /api/payments?month=X&year=Y&status=paid|unpaid` - Get payments by month/year

### Dashboard
- `GET /api/dashboard/stats?month=X&year=Y` - Get dashboard statistics

### Export
- `GET /api/export/excel?month=X&year=Y&status=all|paid|unpaid` - Export to Excel

## Database Schema

### Users
- id (INTEGER, PRIMARY KEY)
- username (TEXT, UNIQUE)
- password (TEXT, hashed)

### Homes
- id (INTEGER, PRIMARY KEY)
- home_id (INTEGER, UNIQUE)
- customer_name (TEXT)
- phone (TEXT)
- set_top_box_id (TEXT)
- monthly_amount (INTEGER)
- created_at (TEXT)
- updated_at (TEXT)

### Payments
- id (INTEGER, PRIMARY KEY)
- home_id (INTEGER, FOREIGN KEY)
- month (INTEGER)
- year (INTEGER)
- status (TEXT: 'paid' or 'unpaid')
- paid_date (TEXT, nullable)
- created_at (TEXT)
- updated_at (TEXT)

## Environment Variables

Create a `.env` file:
```
PORT=3001
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```
