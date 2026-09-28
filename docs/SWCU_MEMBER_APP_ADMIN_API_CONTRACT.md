# SWCU Member App — Protected Admin API Contract

This is the protected server-to-server API hosted by the Member App. It is not the Website Admin UI and is deliberately outside `/api` because the global `/api` proxy is routed to another service.

## Base path and authentication

Base paths: `/member-admin/requests`, `/member-admin/members`, `/member-admin/notices`, and `/member-admin/documents`.

Every endpoint requires:

```http
Authorization: Bearer <SWCU_MEMBER_APP_ADMIN_SERVICE_KEY>
```

`SWCU_MEMBER_APP_ADMIN_SERVICE_KEY` is server-only. The Member App fails closed with `401` if the variable is missing, the header is missing, or the credential is invalid. The credential is compared in constant-time and is never included in a response.

## Dedicated private object storage configuration

Production requires both server environment values:

- `SWCU_MEMBER_APP_PRIVATE_BUCKET_ID`: the dedicated, private Member App bucket ID (not the website/public bucket)
- `SWCU_MEMBER_APP_PRIVATE_OBJECT_PREFIX`: a private object prefix within that bucket, for example `member-app-private/attachments`

Set these in each Member App environment's private server configuration. Do not set either as `NEXT_PUBLIC_*`, and do not store bucket bytes in PostgreSQL, public paths, or the repository. Missing/incomplete production configuration fails closed; production does not fall back to `DEFAULT_OBJECT_STORAGE_BUCKET_ID` / `PRIVATE_OBJECT_DIR`. Development may use the provisioned App Storage `DEFAULT_OBJECT_STORAGE_BUCKET_ID` and `PRIVATE_OBJECT_DIR` only when both exist and their private path does not overlap any configured `PUBLIC_OBJECT_SEARCH_PATHS`.

The storage adapter checks bucket and path ancestry both ways: a private prefix equal to, below, or above any configured public search path is rejected. In production the configured private bucket must also differ from every configured public bucket. Keep the dedicated private prefix separate from all public paths. Uploads and reads use short-lived server-authorized object URLs; the API itself streams downloads only after request/owner authorization.

Responses use JSON and `Cache-Control: no-store, private`. Dates are ISO-8601 UTC strings. The API does not return raw submitted JSON: detail returns an ordered array of `{key,label,value}` records generated from the approved form definition. Never place credentials, raw file bytes, or private form data in application logs.

## Member Requests

### List and filter requests

`GET /member-admin/requests`

Query parameters:

- `status`: one of `Processing`, `Approved`, `More Information Needed`, `Completed`, `Declined`
- `formCode`: one of `LOAN_APPLICATION`, `INCREASE_REPAYMENT_SAVINGS`, `FULL_WITHDRAWAL`, `PARTIAL_WITHDRAWAL`, `UPDATE_DETAILS`
- `search`: public reference, member name, or member number (case-insensitive)
- `page`: positive integer, default `1`
- `pageSize`: integer `1`–`100`, default `25`

Newest submitted first.

```json
{
  "requests": [{
    "id": "uuid",
    "reference": "SWCU-R-000001",
    "formCode": "loan-application",
    "requestType": "LOAN_APPLICATION",
    "formName": "Loan Application",
    "submittedAt": "2026-09-27T10:00:00.000Z",
    "status": "Processing",
    "updatedAt": "2026-09-27T10:00:00.000Z",
    "member": { "id": "member-id", "number": "member-number", "fullName": "Member Name", "email": "member@example.invalid", "mobile": "000 0000" }
  }],
  "page": 1,
  "pageSize": 25,
  "total": 1
}
```

### Request detail

`GET /member-admin/requests/{id}`

Returns `{ "request": { ... } }`, including:

- reference, request type, form version, submitted fields as `{key,label,value}` entries, confirmation, status, member-facing message, dates
- member summary (`id`, member number, name, email and mobile)
- member-visible attachments (`id`, `name`, `size`, `contentType`, `createdAt`, `responseId`)
- audit/activity entries (`actorType`, safe `actorId` when supplied, event, message, status and date)
- internal staff notes
- member responses and their attachments

Internal notes and raw audit data are never exposed by the member endpoints.

### Change status and/or member-facing message

`PATCH /member-admin/requests/{id}/status`

Supply one or both properties. Unknown properties are rejected. `status` is restricted to the five exact values above; `memberMessage` is a string of at most 2,000 characters or `null` to clear it.

```json
{ "status": "More Information Needed", "memberMessage": "Please provide the requested supporting information." }
```

Response:

```json
{ "request": { "id": "uuid", "reference": "SWCU-R-000001", "status": "More Information Needed", "memberMessage": "Please provide the requested supporting information.", "updatedAt": "2026-09-27T10:00:00.000Z" } }
```

Status and member-message changes are audited. If either actually changes, a safe `Request Update` notification is stored for the owning member; notification text contains no form values or staff message content.

### Add internal staff note

`POST /member-admin/requests/{id}/internal-notes`

```json
{ "note": "Internal staff note text." }
```

Note length is 1–4,000 characters. Response is `201 { "note": { "id": "uuid", "createdAt": "..." } }`. The note is audited and is never returned to a member endpoint.

### Access an attachment

`GET /member-admin/requests/{id}/attachments/{attachmentId}`

The API verifies that the attachment belongs to that request, records an attachment-access audit event, obtains a short-lived private object read, and streams the bytes through this authenticated endpoint. It does not disclose an object path, permanent URL, or signed URL. Response sets `Content-Disposition: attachment`, `Cache-Control: private, no-store`, and `X-Content-Type-Options: nosniff`.

## Member endpoints and DTO coordination

Member operations use the authenticated session identity; no request accepts a member ID as authority. Current member routes:

- `POST /member-requests` JSON `{formCode,fields,confirmation,idempotencyKey,attachmentIds?}` → `{id,reference}`. `confirmation` is `{accepted,declaration?,date?}`.
- `GET /member-requests` → `{requests:[...]}`.
- `GET /member-requests/{id}` → `{request:...}`.
- `POST /member-requests/{id}/responses` multipart fields `idempotencyKey` (required), `message` and/or `file`.
- `POST /member-requests/uploads` multipart `file` → `{id,name,size}`.
- `GET /member-requests/attachments/{id}` streams only an attachment for one of the member's own requests.

`src/lib/request-types.ts` exports the member DTOs and exact status/type values. `src/lib/approved-form-validation.ts` validates submission keys and values against the central `APPROVED_FORMS` definition. Pending uploads are session-owner-bound, expire after 24 hours if unclaimed, and are linked to an owned request atomically at submission.

## Member target search

`GET /member-admin/members?search=...&limit=25` (alias `q` for `search`) requires the same Bearer credential. Search is case-insensitive by name or member number and must contain 2–80 characters; `limit` is an integer from 1–50 (default 25). Response:

```json
{ "members": [{ "id": "internal-member-id", "memberNumber": "DEMO-0001", "name": "Demo Member One", "membershipStatus": "Active" }] }
```

Only these four fields are returned; no financial, authentication, or private profile data. The Admin should use `id` as `targetMemberId` when creating Individual Member content. Search keystrokes are not individually audited.

## Member Notices

Use audience **exactly** `All Members` or `Individual Member`. Notice statuses are **exactly** `Draft`, `Active`, `Scheduled`, `Expired` and are independent of request statuses. Dates are ISO-8601 strings or `null`. `targetMemberId` is required for Individual Member and must be absent or `null` for All Members. A Scheduled notice requires `showFrom`. The server alone decides whether a notice is currently visible; Draft, future and expired notices are withheld.

| Method | Path | Purpose |
|---|---|---|
| GET | `/member-admin/notices` | Newest-first list; optional `status`, `audience`, `search` (at most 120 characters), `page` (default 1), `pageSize` (1–100, default 25) |
| GET | `/member-admin/notices/{id}` | Notice metadata and full message |
| POST | `/member-admin/notices` | Create notice; JSON metadata or multipart metadata plus optional `file` |
| PATCH | `/member-admin/notices/{id}` | Update one or more metadata fields as JSON |
| GET | `/member-admin/notices/{id}/attachment` | Authorised private attachment stream |

Create metadata:

```json
{
  "title": "Demo notice",
  "message": "This is fictional test content.",
  "audience": "Individual Member",
  "targetMemberId": "internal-member-id",
  "showFrom": "2026-09-28T00:00:00.000Z",
  "showUntil": null,
  "status": "Active"
}
```

`status` defaults to Draft on create. PATCH accepts any nonempty subset of these properties; send explicit `null` to clear dates or a target when changing audience. Unrecognised fields, invalid periods, and mismatched audience/target are rejected. JSON creation has no attachment. For multipart creation, supply metadata as a JSON string in the `notice` or `data` field (or individual text fields) and optionally one `file`. The attachment uses the validated PDF/JPEG/PNG/WebP set and 10 MiB file limit. Attachments are uploaded on creation only in Phase 1; file replacement and deletion are not exposed.

List response is `{ "notices": [<notice>], "total": 1, "page": 1, "pageSize": 25 }`; detail/create/update use `{ "notice": <notice> }` (create: 201). Notice includes `id`, `title`, `message`, `preview`, `audience`, `targetMember`, `showFrom`, `showUntil`, `status` (effective display status), `storedStatus`, `createdAt`, `updatedAt`, `hasAttachment`, and `attachment` (`{name,size,contentType}` or `null`). The object-storage name/URL is never returned. Important writes and file accesses are audited with a safe staff actor label (`x-admin-actor` is an audit label, not authentication).

## Member Documents

Use the same two audiences. Document statuses are **exactly** `Draft`, `Available`, `Scheduled`, `Expired`. A Scheduled document requires `availableFrom`. Individual Member documents require an existing `targetMemberId`. Only in-period Available/Scheduled content is accessible to the target member or all authenticated members, respectively. Business Central statements and request attachments are not Member Documents.

| Method | Path | Purpose |
|---|---|---|
| GET | `/member-admin/documents` | Newest-first list; optional `status`, `audience`, `search` (at most 120 characters), `page`, `pageSize` (same bounds as notices) |
| GET | `/member-admin/documents/{id}` | Metadata and private file information |
| POST | `/member-admin/documents` | Create/upload with multipart metadata and required `file` |
| PATCH | `/member-admin/documents/{id}` | Update metadata as JSON |
| GET | `/member-admin/documents/{id}/file` | Authorised private stream |

Create multipart: JSON-string `document` or `data` part (individual text fields also accepted) and a required `file` part. Metadata shape:

```json
{
  "title": "Demo member resource",
  "description": "Fictional content for testing only.",
  "documentType": "PDF",
  "audience": "All Members",
  "availableFrom": null,
  "availableUntil": null,
  "status": "Draft"
}
```

`targetMemberId` is additionally required for Individual Member; `status` defaults to Draft. PATCH accepts a nonempty subset; clearing dates/target requires an explicit `null`. Unknown fields and invalid date periods are rejected. Files are validated by extension, MIME and bytes (PDF/JPEG/PNG/WebP, maximum 10 MiB). File replacement and deletion are not exposed in Phase 1. List response is `{ "documents": [<document>], "total": 1, "page": 1, "pageSize": 25 }`; detail/create/update use `{ "document": <document> }` (create: 201). Document metadata includes `id`, `title`, `description`, `documentType`, `audience`, `targetMember`, `availableFrom`, `availableUntil`, `status` (effective display status), `storedStatus`, `createdAt`, `updatedAt`, `fileName`, `fileSize`, `contentType`. No storage path or signed URL is returned. The 2025–2026 Annual Report must not be uploaded without separate approval.

## Member notices, documents and notifications

These are **member-session** routes, not Admin-service routes. Identity is taken from the authenticated HttpOnly session, never a client-provided member ID. All GET responses are private/no-store and filtered on the server.

| Method | Path | Response / behaviour |
|---|---|---|
| GET | `/member-notices` | `{ "notices": [...] }` visible current notices only |
| GET | `/member-notices/{id}` | `{ "notice": ... }` or 404 |
| GET | `/member-notices/{id}/attachment` | Authorised private stream or 404 |
| GET | `/member-documents` | `{ "documents": [...] }` available documents only |
| GET | `/member-documents/{id}` | `{ "document": ... }` or 404 |
| GET | `/member-documents/{id}/file` | Authorised private stream or 404 |
| GET | `/member-notifications` | `{ "notifications": [...], "unreadCount": 0 }` newest first; `SWCU Notice` and `Request Update` only |
| GET | `/member-notifications/unread-count` | `{ "unreadCount": 0 }` |
| GET | `/member-notifications/{id}` | `{ "notification": ... }` for authorised content; read-only |
| POST | `/member-notifications/{id}/read` | `{ "readAt": "ISO-8601" }`; idempotent read action |

Notification items have `id`, `type`, `title`, `preview`, `body`, `createdAt`, `readAt`, plus `noticeId` or `requestId` as applicable. An All Members notice is stored once; its read state is individual to each member. A Request Update contains no submitted form fields or internal staff note. Notice and document file responses set `Cache-Control: private, no-store`, `Content-Disposition: attachment`, and `X-Content-Type-Options: nosniff`; no persistent object URL is exposed.

## Errors

All JSON errors use `{ "error": "..." }`. Common status codes:

- `400`: malformed input, unknown field/type, invalid audience/status/date or validation failure
- `401`: missing/invalid member session or Admin service credential
- `403`: member mutation origin could not be verified
- `404`: request, notice, document or private file unavailable to the caller (including wrong member and out-of-window content)
- `413`: request body/file too large
- `429`: temporary upload quota reached
- `500`: generic operation failure
- `503`: dedicated private storage unavailable
- `409`: conflicting request-state transition or request-response action

Responses intentionally avoid SQL, storage, stack, and credential details.