ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE "User" ADD CONSTRAINT "User_language_supported" CHECK ("language" IN ('ru','kk','en'));
