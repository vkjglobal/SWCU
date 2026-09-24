# Future SWCU production content delta

**Not applied to production.** DEV CMS changes do not travel with Git. When SWCU separately authorizes a production content update, review the current production records first and apply these changes through the existing tenant-scoped CMS approval process. Do not overwrite later production edits. If the older content bootstrap is ever used, apply this approved delta after it; that bootstrap predates this refinement.

## Site notice and News & Notices cleanup

SWCU DEV's instructional site notice (“This is an OPTIONAL scrolling message feature…”) was disabled, and its premature published news item (“New SWCU Website is now live! [www.swcu.finance]”) and unpublished “Test News” record were deleted. **Final production content must not include these demo/test records or equivalent placeholder notices and premature launch announcements.** During a separately authorised production reconciliation, inspect the `swcu` tenant's site notice and News & Notices records and remove or disable any equivalent demo/test content without touching genuine approved records. Do not create replacement launch news without SWCU approval. No production records were accessed or changed here.

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

## Initial Common Questions / FAQs

**DEV only; not applied to production.** For tenant `swcu`, review production FAQs first. Remove or leave disabled any superseded generic seed questions (“Where can I find SWCU forms?”, “How can I learn about joining SWCU?”, and “How do I contact SWCU?”). Add or update the following twelve tenant-scoped FAQ records with `isEnabled: true` and the indicated `sortOrder`. Do not duplicate a question that was already approved in production. The first six are the Home subset; Forms & Resources displays all twelve. The answers below are plain text, with blank lines between paragraphs, not HTML. Use the existing Administrator publish / Editor approval workflow.

### 0 — How do I become an SWCU member?

```text
Contact SWCU first to confirm your eligibility. Once confirmed, complete the Application for Membership Form and provide the required supporting documents.

New members currently pay a $1 entrance fee and must save at least $8 weekly or $16 fortnightly. Salary deduction is compulsory for new members.
```

### 1 — How much do I need to save regularly?

```text
The current minimum regular saving is $8 weekly or $16 fortnightly.

New members are required to make their regular savings through salary deduction.
```

### 2 — When can I apply for an SWCU loan?

```text
A member must normally save or contribute for at least three months before applying for a loan.

Loan applications are subject to SWCU approval and repayment eligibility.
```

### 3 — How does SWCU calculate loan interest?

```text
SWCU charges interest at 1% per month on the reducing loan balance. Interest is calculated daily on the amount still owing and applied at the end of each calendar month.

As repayments reduce the balance, the amount on which interest is calculated also reduces.
```

### 4 — Can I estimate my loan repayment before applying?

```text
Yes. Use the Plan Your Loan calculator on the Home page to see an estimated repayment based on your loan amount, payroll period and number of repayments.

The result is an estimate only. Actual repayments, fees, terms and approval are determined by SWCU.
```

### 5 — How can I contact SWCU?

```text
Visit SWCU at 300 Waimanu Road, Suva.

Phone:
777 7345
893 6901

Current public email:
swcu2016@gmail.com

Office hours:
Monday to Thursday: 8.30 am–4.30 pm
Friday: 8.30 am–4.00 pm
```

### 6 — What documents do I need when applying for membership?

```text
You will need a recent salary slip, photo identification, your TIN and FNPF details, an employer confirmation letter and a witness signature.

Use the current Application for Membership Form for the full application requirements.
```

### 7 — What can an SWCU loan be used for?

```text
SWCU loans are available for provident or productive purposes.

Applications are considered against the member’s ability to repay, income or salary and member account position.
```

### 8 — When are loan applications processed?

```text
The current loan application cut-off is Tuesday at 4.30 pm.

The Credit Committee meets on Wednesday, and approved loans are normally available for collection or payment on Thursday, subject to SWCU approval and processing.
```

### 9 — How do I withdraw my savings?

```text
Use the appropriate SWCU withdrawal form.

A Full Withdrawal Form and Partial Withdrawal Form are available from Forms & Resources.
```

### 10 — What is SWCU Retirement Savings?

```text
Retirement Savings is available to registered SWCU members.

Payment may be made when a member retires, resigns or leaves, or on death. A member may remain an SWCU member after retirement.
```

### 11 — What is the SWCU Death Benefit?

```text
Subject to SWCU rules and claim requirements, a deceased member’s savings may be doubled up to $5,000 and an outstanding loan may be cleared or written off up to $5,000.

There is no separate scheme contribution or fee.

The Special Death Benefit Claim form is available from Forms & Resources.
```

No production data has been accessed or changed. After a separately authorised production CMS update, verify the Home six, Forms & Resources twelve, and current calculator estimate. This FAQ delta should be applied after any older content bootstrap.