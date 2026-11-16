# EduChain - Technical Specification

## 1. High-Level System Architecture

### Overview
EduChain is a web and mobile-responsive platform designed to connect students with donors. The system follows a monolithic architecture initially for speed of development, transitioning to microservices if needed.

### Components
1.  **Frontend (Web + Mobile)**:
    -   **Framework**: Next.js (React) for a unified responsive web application. PWA support for mobile-like experience.
    -   **Styling**: Tailwind CSS for premium, clean UI.
    -   **State Management**: React Context / Zustand.
    -   **Maps**: Google Maps API / Leaflet for location-based discovery.
2.  **Backend**:
    -   **Runtime**: Node.js.
    -   **Framework**: Express.js.
    -   **Authentication**: JWT (JSON Web Tokens) with role-based access control (RBAC).
3.  **Database**:
    -   **Primary DB**: PostgreSQL (Relational data for users, transactions, scholarships).
    -   **ORM**: Prisma or Sequelize.
4.  **Payment Layer**:
    -   **Aggregator**: Integration with Stripe (International) and Razorpay/PhonePe (India/UPI).
    -   **Multi-currency**: Handling currency conversion at the payment gateway level, storing amounts in base currency (e.g., USD or INR) with exchange rate logs.
5.  **File Storage**:
    -   **Service**: AWS S3 or compatible object storage (MinIO for local dev) for KYC docs, selfies, and proof receipts.

---

## 2. Database Schema

### Tables (Entities)

#### `Users`
-   `id` (UUID, PK)
-   `email` (String, Unique)
-   `password_hash` (String)
-   `role` (Enum: STUDENT, DONOR, ADMIN)
-   `is_verified` (Boolean)
-   `created_at` (Timestamp)

#### `StudentProfiles`
-   `user_id` (FK -> Users.id)
-   `full_name` (String)
-   `photo_url` (String)
-   `institution_name` (String)
-   `course_name` (String)
-   `location_lat` (Float)
-   `location_lng` (Float)
-   `bio` (Text)
-   `academic_score` (String)
-   `kyc_status` (Enum: PENDING, VERIFIED, REJECTED)

#### `DonorProfiles`
-   `user_id` (FK -> Users.id)
-   `full_name` (String)
-   `total_donated` (Decimal)
-   `badge_level` (String)

#### `ScholarshipRequests`
-   `id` (UUID, PK)
-   `student_id` (FK -> StudentProfiles.user_id)
-   `type` (Enum: MICRO, BIG)
-   `title` (String)
-   `description` (Text)
-   `amount_requested` (Decimal)
-   `amount_raised` (Decimal)
-   `status` (Enum: ACTIVE, COMPLETED, CANCELLED)
-   `deadline` (Timestamp)

#### `Donations`
-   `id` (UUID, PK)
-   `donor_id` (FK -> DonorProfiles.user_id)
-   `scholarship_id` (FK -> ScholarshipRequests.id)
-   `amount` (Decimal)
-   `currency` (String)
-   `payment_gateway_ref` (String)
-   `status` (Enum: SUCCESS, FAILED)
-   `created_at` (Timestamp)

#### `KYCDocuments`
-   `id` (UUID, PK)
-   `student_id` (FK)
-   `doc_type` (Enum: GOVT_ID, STUDENT_ID, INSTITUTE_LETTER)
-   `file_url` (String)
-   `status` (Enum: PENDING, APPROVED, REJECTED)

#### `ProofSubmissions`
-   `id` (UUID, PK)
-   `scholarship_id` (FK)
-   `file_url` (String)
-   `description` (String)
-   `verified_by_admin` (Boolean)

---

## 3. UI Screen List

### Common
1.  **Landing Page**: Hero section with "Chain + Book + Pin" logo, impact stats, "How it works", Featured Students, Footer.
2.  **Auth Screens**: Login, Register (Select Role: Student/Donor), Forgot Password.

### Student Portal
1.  **Dashboard**: Overview of active requests, total received, KYC status.
2.  **My Profile**: Edit details, upload selfie, view public profile preview.
3.  **KYC Verification**: Step-by-step upload for ID, Student Card, Letter.
4.  **Create Request**: Form to select Micro/Big scholarship, enter amount, title, story.
5.  **Proof Upload**: List of completed scholarships -> Upload Receipt button.

### Donor Portal
1.  **Explore Students**: Grid view of student cards. Filters: Location (Map/City), Class, Scholarship Type.
2.  **Student Details**: Full bio, academic info, funding progress bar, "Donate Now" button.
3.  **Donation Flow**: Amount input -> Payment Gateway Modal (UPI/Card/etc.) -> Success Screen.
4.  **History**: List of past donations with "Download Receipt" button.
5.  **Impact Report**: Analytics showing students helped, total money given.

---

## 4. Backend Business Logic

### Authentication
-   **Role-Based**: Middleware to check `req.user.role`.
-   **KYC Gate**: Students cannot create Scholarship Requests until `kyc_status` is VERIFIED.

### Request Management
-   **Micro vs Big**:
    -   Micro (₹10 - ₹5k): Auto-approval after basic KYC.
    -   Big (₹10k - ₹10L): Requires Admin manual review before going live.
-   **Progress**: Updates `amount_raised` atomically on successful donation.

### Payments
-   **Integration**:
    -   Create Payment Intent (Stripe) or Order (Razorpay).
    -   Webhook listener to confirm payment success.
    -   On success: Create `Donation` record, update `ScholarshipRequest`, send email receipt.

### File Storage
-   **Upload**: Presigned URLs for direct S3 upload or server-side upload handling.
-   **Security**: KYC docs are private (accessible only to Admin/Owner). Profile pics are public.

---

## 5. High-Level API Structure

### Auth
-   `POST /api/auth/register`
-   `POST /api/auth/login`
-   `GET /api/auth/me`

### Students
-   `GET /api/students` (Public, with filters)
-   `GET /api/students/:id`
-   `PUT /api/students/profile` (Protected)
-   `POST /api/students/kyc` (Upload docs)

### Scholarships
-   `POST /api/scholarships` (Create request)
-   `GET /api/scholarships` (Feed)
-   `POST /api/scholarships/:id/proof` (Upload proof)

### Donations
-   `POST /api/donations/initiate` (Start payment)
-   `POST /api/donations/webhook` (Payment callback)
-   `GET /api/donations/history` (Donor history)
