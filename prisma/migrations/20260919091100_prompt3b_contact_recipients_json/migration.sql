ALTER TABLE "contact_settings"
  ALTER COLUMN "notificationRecipients" TYPE JSONB
  USING CASE
    WHEN "notificationRecipients" IS NULL OR trim("notificationRecipients") = '' THEN '[]'::jsonb
    ELSE to_jsonb(string_to_array("notificationRecipients", ','))
  END;