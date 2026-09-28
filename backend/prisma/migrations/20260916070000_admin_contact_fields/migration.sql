-- Add optional per-admin contact fields shown publicly in the site footer.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsapp" TEXT;
