# Professor Chapman's Mock Trial Tool

An educational web application for students to prepare for *The Princess Bride* mock trial by questioning characters and receiving guidance from Professor Chapman.

## Features

- **Character Questioning**: Ask any character from The Princess Bride about events, motivations, and perspectives
- **Intelligent AI System**: Automatic detection between character testimony and Professor Chapman's guidance
- **Student Whitelist**: Admin-controlled access management
- **Usage Tracking**: Monitor token usage and costs per student
- **Content Filtering**: Automatic blocking of non-literature questions
- **Admin Dashboard**: Comprehensive management interface

## Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (Neon serverless)
- **AI**: OpenAI GPT-4o
- **ORM**: Drizzle ORM

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (Neon recommended)
- OpenAI API key

## Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Admin
ADMIN_PASSWORD=YourSecurePassword

# Optional: CORS (comma-separated origins)
ALLOWED_ORIGINS=https://yourdomain.com

# Optional: Port (default: 5000)
PORT=5000
```

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Initialize Database

The database will be automatically migrated during `npm install`. If needed, run manually:

```bash
npm run db:push
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5000`

### 4. Access Admin Panel

1. Navigate to `http://localhost:5000/admin`
2. Login with your `ADMIN_PASSWORD`
3. Add students to the whitelist

### 5. Add Students

In the admin panel:
- Click "Add Student"
- Enter student email and name
- Set usage limits (optional)
- Click "Add Student"

Students can now access the app using their whitelisted email.

## Production Deployment

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repository
4. Add environment variables
5. Deploy

Render will automatically:
- Run `npm install`
- Run database migrations
- Build the application
- Start the server

## Admin Dashboard

Access at `/admin` with your admin password.

### Features:
- **Overview**: System statistics and status
- **Students**: Manage whitelist, set limits, toggle active status
- **Usage**: Monitor token usage and costs
- **Violations**: View content filter blocks
- **Settings**: Configure global limits and filter mode

## API Endpoints

### Public
- `GET /api/health` - Health check
- `POST /api/sessions` - Create chat session
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions/:id/messages` - Get messages
- `POST /api/sessions/:id/messages` - Send message
- `POST /api/sessions/:id/professor-mode` - Ask Professor Chapman

### Admin (requires authentication)
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/me` - Check auth status
- `GET /api/admin/students` - List students
- `POST /api/admin/students` - Add student
- `PATCH /api/admin/students/:email` - Update student
- `DELETE /api/admin/students/:email` - Remove student
- `GET /api/admin/settings` - Get settings
- `PATCH /api/admin/settings` - Update settings
- `GET /api/admin/usage` - Get usage stats
- `GET /api/admin/violations` - Get violations

## Usage Limits

Configure per-student or global limits:

- **Daily Token Limit**: Maximum tokens per day
- **Monthly Cost Limit**: Maximum cost per month
- **Global Limits**: Apply to all students combined

## Content Filtering

Two modes:
- **Normal**: Blocks high-confidence non-literature content
- **Strict**: Blocks any detected non-literature content

Blocked topics: math, science, technology, etc.

## Security Features

- Student whitelist (email-based)
- Admin password authentication
- Rate limiting on admin login
- HttpOnly cookies
- Token expiration (24 hours)
- CORS protection
- Content filtering
- Usage limits

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
npm run db:push
```

### Port Already in Use
```bash
# Change port in .env
PORT=3000
```

### Admin Login Issues
- Verify `ADMIN_PASSWORD` in `.env`
- Check browser cookies are enabled
- Clear cookies and try again

### Student Can't Access
- Verify email is in whitelist (admin panel)
- Check student is marked as "Active"
- Verify usage limits not exceeded

## Development

### Run Type Checking
```bash
npm run check
```

### Database Migrations
```bash
npm run db:push
```

### Initialize Database
```bash
npm run db:init
```

## License

MIT

## Support

For issues or questions, contact Professor Chapman.
