-- Run once for existing My Daily D1 databases. Preserves existing reminder settings.
ALTER TABLE digest_settings ADD COLUMN times_json TEXT;
