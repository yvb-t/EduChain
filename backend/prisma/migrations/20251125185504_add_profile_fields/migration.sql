-- AlterTable
ALTER TABLE "DonorProfile" ADD COLUMN "address" TEXT;
ALTER TABLE "DonorProfile" ADD COLUMN "bio" TEXT;
ALTER TABLE "DonorProfile" ADD COLUMN "phone_number" TEXT;

-- AlterTable
ALTER TABLE "ScholarshipRequest" ADD COLUMN "authority_number" TEXT;
ALTER TABLE "ScholarshipRequest" ADD COLUMN "proof_url" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "address" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN "phone_number" TEXT;
