ALTER TABLE "tenant_settings"
ADD COLUMN "retirementMinimumContribution" TEXT;

DO $$
DECLARE
  swcu_id TEXT;
BEGIN
  SELECT "id" INTO swcu_id FROM "tenants" WHERE "slug" = 'swcu';
  IF swcu_id IS NOT NULL THEN
    UPDATE "tenant_settings"
    SET "retirementMinimumContribution" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = swcu_id;

    UPDATE "page_content"
    SET "body" = CASE "slot"
      WHEN 'MEMBERSHIP_INTRO' THEN '<p>SWCU provides savings, loans and member benefit services to eligible members.</p><p>Please contact SWCU to confirm your eligibility before applying.</p><h3>Before You Apply</h3><ul><li>Entrance fee: $1 for a new member.</li><li>Minimum regular savings: $8 per week or $16 per fortnight.</li><li>Salary deduction is compulsory for new members.</li><li>Bring a recent salary slip, photo identification, TIN/FNPF details and an employer confirmation letter.</li><li>A witness signature is required.</li></ul><p>Applications may be lodged at the FPSA branch in Lautoka, the FPSA branch in Labasa, or by email. Please contact SWCU for the current email destination.</p>'
      WHEN 'SAVINGS_INTRO' THEN '<p>Regular savings are a core SWCU member service and help members build funds over time for future needs.</p>'
      WHEN 'LOANS_INTRO' THEN '<p>Members must have saved or contributed for at least 3 months before applying. Loans may be for provident or productive purposes.</p><ul><li>Applications should be received by Tuesday at 4.30 pm.</li><li>The Credit Committee considers applications on Wednesday.</li><li>Approved collection or payment follows on Thursday according to the current process.</li></ul><p>Applications are subject to SWCU approval and repayment eligibility, including repayment ability, income or salary, and the member’s account position.</p>'
      WHEN 'RETIREMENT_INTRO' THEN '<p>Retirement Savings is available to all registered SWCU members. Funds may be payable on retirement, resignation or leaving, or death. A member may continue SWCU membership after retirement.</p>'
      WHEN 'DEATH_BENEFIT_INTRO' THEN '<p>The Special Death Benefit Scheme is available under normal SWCU membership conditions.</p><ul><li>On the death of a member, the member’s savings may be doubled up to a maximum of $5,000.</li><li>An outstanding loan may be cleared or written off up to a maximum of $5,000, subject to SWCU requirements.</li><li>There is no separate contribution or fee for the scheme.</li></ul><p>Subject to SWCU rules and claim requirements.</p>'
      ELSE "body"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = swcu_id
      AND "slot" IN ('MEMBERSHIP_INTRO','SAVINGS_INTRO','LOANS_INTRO','RETIREMENT_INTRO','DEATH_BENEFIT_INTRO');
  END IF;
END $$;