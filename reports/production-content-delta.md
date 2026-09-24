# Future SWCU production content delta

**Not applied to production.** DEV CMS changes do not travel with Git. When SWCU separately authorizes a production content update, review the current production records first and apply these changes through the existing tenant-scoped CMS approval process. Do not overwrite later production edits. If the older content bootstrap is ever used, apply this approved delta after it; that bootstrap predates this refinement.

## Content refinement — About and Loans

Tenant: `swcu`. Both records already exist and are published; do not create new slots, modify another tenant, or change Vision, Mission, Purpose, membership rules, or calculator settings.

- `ABOUT_STORY`: Set the heading to **Member-owned. Serving members since 2000.** Set its body to:

  ```html
  <p>Service Worker Credit Union was formed following an initiative of the National Council of the Fiji Public Service Association and was registered on 14 September 2000.</p>
  <p>From the beginning, SWCU has focused on helping members build savings, access financial assistance and strengthen the wellbeing of members and their families.</p>
  <h3>Our Story</h3>
  <p>SWCU was established as a member-focused credit union built around regular saving, responsible borrowing and mutual support. Members save together and can access financial assistance for approved needs, while the Credit Union remains focused on the interests and wellbeing of its members and their families.</p>
  <p>Today, SWCU continues to serve its members from 300 Waimanu Road, Suva.</p>
  ```

  The repeated date/origin sentence from the preferred story wording is omitted because it is already given immediately above in the introduction.

- `LOANS_INTRO`: Preserve its existing approved Loans body and append this subsection:

  ```html
  <h3>How loan interest works</h3>
  <p>SWCU charges interest at 1% per month on the reducing loan balance. Interest is calculated daily on the amount still owing and applied at the end of each calendar month.</p>
  <p>As repayments reduce the loan balance, the amount on which interest is calculated also reduces. This means that although the monthly rate is 1%, a member does not simply pay 12% of the original loan amount over a year.</p>
  <p>The actual total interest and repayment amount will depend on the loan amount, repayment period, repayment timing, any applicable fees and SWCU’s approval.</p>
  ```

No public component copy or calculator configuration changes are needed. Verify the two pages and existing calculator estimate after future production approval; no production action is part of this task.