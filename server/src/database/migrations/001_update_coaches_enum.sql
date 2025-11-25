-- Migration: Update coaches table role enum to support new coach types
-- This migration adds new coach role types while keeping backward compatibility with existing data

-- Update coaches table to use new enum values
ALTER TABLE coaches
MODIFY COLUMN role ENUM('HEAD', 'STRATEGY', 'MENTAL', 'PHYSICAL', 'ANALYST', 'DOCTOR', 'HEAD_COACH', 'ASSISTANT_COACH') NOT NULL;

-- Add is_available column if it doesn't exist
-- (This is a safe operation since the column was added in schema.sql)
-- ALTER TABLE coaches ADD COLUMN is_available BOOLEAN DEFAULT TRUE;

-- Optional: Migrate old role values to new ones (uncomment if needed)
-- UPDATE coaches SET role = 'HEAD' WHERE role = 'HEAD_COACH';
-- UPDATE coaches SET role = 'STRATEGY' WHERE role = 'ASSISTANT_COACH';
