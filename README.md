# FindIt: Campus Lost & Found System

A web app where students report lost and found items, search and filter reports, and claim what is theirs. Admins verify reports and handle claims.

## Features

- Register and login with roles: Admin, Staff, Student
- Report lost or found items with an optional photo
- Admin verifies, rejects, hides, or shows reports before they are public
- Search and filter by name, category, location, date, and type
- Claim a found item with proof (admin approves or rejects)
- "I found this" on a lost item: the owner gets the finder's email after admin approval
- "I got it back" marks an item as claimed. Claimed items leave the home page after 6 hours
- Notifications with an unread bell, and a My Claims page
- Admin dashboard with status updates

## Tech Stack (MERN)

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Tailwind CSS, React Router, Axios |
| Backend | Node.js, Express.js, JWT, bcrypt, Multer |
| Database | MongoDB Atlas with Mongoose |
| Image storage | Cloudinary |
| Hosting | Render |

## Run locally

1. Install Node.js 20.19 or newer.
2. Clone the repo, then from the project folder run `npm run install-all`.
3. Create `server/.env` using `.env.example` as a template.
4. Run `npm run dev`. The site opens at http://localhost:5173.

To make an admin, register an account, then change its `role` to `admin` in MongoDB Atlas (database `findit`, collection `users`).

## Deployment

Express serves the built React app, so everything runs as a single service on Render.

- Build command: `npm run build`
- Start command: `npm start`
- Environment variables: `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NODE_ENV=production`, `NODE_VERSION=22`

## Future scope

Replace manual admin verification with an AI check that judges whether a report or claim looks legitimate.