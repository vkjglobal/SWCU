DO $$
DECLARE
  swcu_id TEXT;
BEGIN
  SELECT "id" INTO swcu_id FROM "tenants" WHERE "slug" = 'swcu';
  IF swcu_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "page_content"
  SET "heading" = 'Our Story',
      "body" = 'Service Worker Credit Union began on 23 August 2000, when a group of Fiji Public Service Association members met in Suva to establish a credit union for members. Today, SWCU serves its members from 300 Waimanu Road, Suva.',
      "isPublished" = true,
      "publishedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP),
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "tenantId" = swcu_id
    AND "slot" = 'ABOUT_STORY'
    AND "body" = 'Founded around 2000; now serving members from 300 Waimanu Road.';

  UPDATE "page_content"
  SET "heading" = 'Loans',
      "body" = 'SWCU provides member loans for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member’s account position.',
      "isPublished" = true,
      "publishedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP),
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "tenantId" = swcu_id
    AND "slot" = 'LOANS_INTRO'
    AND "body" = 'SWCU loans are for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member account position.';

  INSERT INTO "page_content" ("id", "tenantId", "slot", "heading", "body", "isPublished", "publishedAt", "createdAt", "updatedAt")
  VALUES
    ('final-gate-' || swcu_id || '-about-story', swcu_id, 'ABOUT_STORY', 'Our Story', 'Service Worker Credit Union began on 23 August 2000, when a group of Fiji Public Service Association members met in Suva to establish a credit union for members. Today, SWCU serves its members from 300 Waimanu Road, Suva.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-about-vision', swcu_id, 'ABOUT_VISION', 'Our Vision', 'To be a leading credit union providing financial services for our members.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-about-mission', swcu_id, 'ABOUT_MISSION', 'Our Mission', 'To encourage members to save and provide financial assistance that helps improve the wellbeing of members and their families.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-about-purpose', swcu_id, 'ABOUT_PURPOSE', 'Our Purpose', 'To help members build savings, access financial assistance for provident and productive needs, and strengthen their financial wellbeing.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-membership', swcu_id, 'MEMBERSHIP_INTRO', 'Membership', 'SWCU provides savings, loans and member benefit services to eligible members. Members and people interested in joining can use the Membership Application and contact SWCU for current membership requirements.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-savings', swcu_id, 'SAVINGS_INTRO', 'Savings', 'Regular savings help members build funds for future needs and difficult times. SWCU provides members with a practical way to build their savings over time.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-loans', swcu_id, 'LOANS_INTRO', 'Loans', 'SWCU provides member loans for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member’s account position.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-retirement', swcu_id, 'RETIREMENT_INTRO', 'Retirement Savings', 'SWCU’s Retirement Savings Fund helps members build additional savings and strengthen their financial position for the future.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('final-gate-' || swcu_id || '-death-benefit', swcu_id, 'DEATH_BENEFIT_INTRO', 'Death Benefit Scheme', 'SWCU’s Special Death Benefit Scheme is designed to provide support to the families and beneficiaries of members who pass away. Claims are handled under the Scheme’s approved rules.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("tenantId", "slot") DO NOTHING;
END $$;