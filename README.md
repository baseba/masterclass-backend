# masterclass-backend

## how to install:

ask @baseba for .env and add it to the project

```bash
pnpm install
pnpm run prisma:generate
pnpm run dev
```

## Database Schema

This project uses a normalized relational schema for a course booking platform. Below are the main entities, enums, and relationships:

### Models

- **Professor**: Teacher/owner of courses.
  - Fields: `id`, `name`, `email`, `bio`, `profilePictureUrl`
  - Relationships: Has many `courses`, manages `slots`.

- **Student**: User who books classes.
  - Fields: `id`, `name`, `email`, `passwordHash`, `phone`
  - Relationships: Can book `slots` via `reservations`, has many `payments`.

- **Course**: Collection of classes.
  - Fields: `id`, `professorId`, `title`, `description`, `isActive`
  - Relationships: Has many `classes`.

- **Class**: Single unit of learning.
  - Fields: `id`, `courseId`, `title`, `description`, `objectives`, `orderIndex`, `basePrice`
  - Relationships: Can be scheduled in multiple `slots`, has many `materials`.

- **Slot**: Scheduled instance of a class.
  - Fields: `id`, `classId`, `professorId`, `startTime`, `endTime`, `modality`, `status`, `minStudents`, `maxStudents`
  - Relationships: Has many `reservations`.

- **Reservation**: Student's booking of a slot.
  - Fields: `id`, `studentId`, `slotId`, `status`, `paymentId`
  - Relationships: Links `student` and `slot`, tracks attendance and payment.

- **Payment**: Records transactions.
  - Fields: `id`, `studentId`, `amount`, `currency`, `status`, `paymentProvider`, `transactionReference`, `createdAt`
  - Relationships: Can cover multiple `reservations`.

- **Material**: Learning resources tied to a class.
  - Fields: `id`, `classId`, `type`, `url`, `accessPolicy`
  - Relationships: Unlocked when student purchases class/course.

### Enums

- `SlotModality`: `group`, `private`
- `SlotStatus`: `candidate`, `confirmed`, `completed`, `cancelled`
- `ReservationStatus`: `pending`, `confirmed`, `cancelled`, `attended`, `no_show`
- `PaymentStatus`: `pending`, `paid`, `failed`, `refunded`
- `MaterialType`: `guide`, `slides`, `exercises`, `solutions`, `recording`
- `AccessPolicy`: `pre_class`, `post_class`, `no_show_restricted`

### Indexes

- Indexes are added for performance on `studentId`, `slotId`, `status` where relevant.

### Business Rules

- Progressive discounts for multiple class purchases (checkout logic).
- Group slots require quorum to confirm; private slots are confirmed immediately.
- Materials access depends on purchase and attendance.

For full schema details, see `prisma/schema.prisma`.

## Admin API Routes

These routes are available to authenticated admins:

### Authentication

- `POST /admin/login`
  - Authenticate as admin. Returns JWT token.
  - Body: `{ email, password }`

### Professor Management

- `GET /professor`
  - List all professors.
- `GET /professor/:id`
  - Get details of a professor by ID.
- `POST /professor/promote/:studentId`
  - Promote a student to professor. Creates a professor entry from an existing student.
  - Returns 409 if already a professor, 404 if student not found.

### Course Management

### Course Management

- `GET /course`
  - List all courses (with assigned professor and classes).
- `GET /course/:id`
  - Get details of a course by ID.
- `POST /course`
  - Create a new course and assign a professor.
  - Body: `{ title, description, professorId, isActive }`
- `PUT /course/:id`
  - Update a course.
  - Body: `{ title, description, professorId, isActive }`
- `DELETE /course/:id`
  - Delete a course.

## Session (Class) API Routes

Session routes are nested under courses and require authentication (admin or assigned professor):

- `GET /course/:courseId/sessions`
  - List all sessions (classes) in a course.
- `GET /course/:courseId/sessions/:sessionId`
  - Get details of a session by ID.
- `POST /course/:courseId/sessions`
  - Create a new session in a course.
  - Body: `{ title, description, objectives, orderIndex, basePrice }`
- `PUT /course/:courseId/sessions/:sessionId`
  - Update a session.
  - Body: `{ title, description, objectives, orderIndex, basePrice }`
- `DELETE /course/:courseId/sessions/:sessionId`
  - Delete a session.

**Access Control:**

- Admins can manage any session.
- Professors can manage sessions only in their assigned courses.
- Other users receive 403 Forbidden or 401 Unauthorized.

All session routes require a valid JWT in the `Authorization` header: `Bearer <token>`.

All routes (except `/admin/login`) require the admin JWT in the `Authorization` header: `Bearer <token>`.

## Cron job / Notification

This app exposes a protected endpoint to run daily cron jobs that notify students with meet links for remote slots happening the next day.

- POST `/cron/daily-job?key=<CRON_KEY>` — run the daily job (protected by `CRON_KEY` env var).

Environment variables used for email sending:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP server credentials used by nodemailer.
- `FROM_EMAIL` — optional from address for outgoing emails.
- `CRON_KEY` — simple key to protect the cron endpoint.

Notes:

- The cron job looks for remote slots (`modality = remote`) scheduled for the next calendar day and sends the link found in the slot's `location` field to all confirmed reservations.
- There is no database flag to avoid duplicate sends, so make sure the cron runs once per day (or we can add a `notified` flag in the DB in a follow-up change).
