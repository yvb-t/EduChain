# 🎓 EduChain — Educational Crowdfunding & Scholarship Platform

[![Next.js](https://img.shields.io/badge/Next.js-14%2B-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

EduChain is a transparent, modern educational crowdfunding and scholarship matching platform connecting underprivileged and high-achieving students with philanthropic donors, alumni foundations, and corporate sponsors for verified academic sponsorship.

---

## 🌟 Key Highlights & Modules

- **🎯 Transparent Scholarship Matching**: Direct algorithmic connection between donor funding criteria (academic field, geographic origin, merit threshold) and eligible student applicants.
- **🛡️ KYC & Academic Credential Verification**: Multi-factor verification workflow requiring student identity proof, institutional enrollment transcripts, and recommendation letters to eliminate sponsorship fraud.
- **💳 Multi-Currency Global Payment Layer**: Integrated payment rails supporting domestic UPI/net-banking as well as international debit/credit cards (Stripe / Razorpay) with automated ledger auditing.
- **📊 Real-Time Academic Milestones**: Sponsored students post semester grade cards and academic progress updates directly to their funding sponsors.
- **📁 Secure Document Storage**: Encrypted object storage (AWS S3 / MinIO) for student identification, financial need proofs, and institutional receipts.

---

## 🏗️ High-Level System Architecture

\\\	ext
EduChain/
├── frontend/                 # Next.js / React web portal with Tailwind UI
│   ├── src/
│   │   ├── app/              # App router pages (Student, Donor, Admin dashboards)
│   │   ├── components/       # Reusable cards, modal dialogs, and navigation
│   │   └── context/          # Global auth & application state
├── backend/                  # Node.js + Express REST API
│   ├── controllers/          # Business logic (Campaigns, Donations, Verification)
│   ├── models/               # PostgreSQL relational models
│   ├── routes/               # Secure authenticated API endpoints
│   └── middleware/           # JWT authentication & Role-Based Access Control (RBAC)
└── technical_specification.md # Detailed system specification & data schemas
\\\

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **PostgreSQL** (v14 or higher)

### Installation & Local Setup

1. **Clone the repository:**
   \\\ash
   git clone https://github.com/yvb-t/EduChain.git
   cd EduChain
   \\\

2. **Setup Backend:**
   \\\ash
   cd backend
   npm install
   npm run dev
   \\\

3. **Setup Frontend:**
   \\\ash
   cd ../frontend
   npm install
   npm run dev
   \\\
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author

**D Yuva Raja**
- GitHub: [@yvb-t](https://github.com/yvb-t)