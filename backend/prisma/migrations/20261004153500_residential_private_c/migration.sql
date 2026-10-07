-- Add missing private residential class for C
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'residentialPrivateC';
