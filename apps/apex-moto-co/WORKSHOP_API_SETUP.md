# APEX Workshop API Authentication

This update separates the APEX Detailing / Workshop Android authentication from the normal website login while keeping the website and workshop on the same database and booking data.

## Authentication model

- Website accounts continue to use the existing Express website session.
- Workshop accounts live in `workshop_users`.
- Android authenticates through `/api/workshop/auth/login`.
- Access tokens expire after 15 minutes.
- Refresh tokens are rotated and remain valid for 30 days unless revoked.
- Workshop sessions are stored in `workshop_sessions`.
- Workshop API routes use `Authorization: Bearer <access token>`.

## Required environment variable

Add a dedicated secret to the production `.env` file:

`WORKSHOP_AUTH_SECRET=<random secret at least 32 characters>`

A good value can be generated with:

`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

If Docker Compose is used, `WORKSHOP_AUTH_SECRET` is passed into the web container by `docker-compose.yml`.

## Create the first workshop account

Set these variables in the environment or temporarily in `.env`:

- `WORKSHOP_EMAIL`
- `WORKSHOP_PASSWORD`
- `WORKSHOP_USERNAME`
- `WORKSHOP_DISPLAY_NAME`
- `WORKSHOP_ROLE` (`detailer` or another role string used by your permissions later)

Then run:

`npm run create-workshop-user`

The script creates or updates the workshop account in `workshop_users` and does not touch the normal `users` table.

## Android API endpoints

Authentication:

- `POST /api/workshop/auth/login`
- `POST /api/workshop/auth/refresh`
- `POST /api/workshop/auth/logout`
- `GET /api/workshop/auth/session`

Workshop data:

- `/api/workshop/detailing/health`
- `/api/workshop/detailing/session`
- `/api/workshop/detailing/technicians`
- `/api/workshop/detailing/bookings`
- `/api/workshop/detailing/bookings/:id`
- `/api/workshop/detailing/bookings/:id/status`
- `/api/workshop/detailing/bookings/:id/assign`
- `/api/workshop/detailing/bookings/:id/notes`
- `/api/workshop/detailing/bookings/:id/payment`
- `/api/workshop/detailing/bookings/:id/photos`

## Important deployment note

The Android app in version 2.4.0 no longer uses the website `/login` page or website session cookie. Install the updated Android build after deploying the backend changes.
