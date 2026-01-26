# Photography Site Backend API

Node.js backend for managing dynamic home slider images.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=photography_site
DB_PORT=3306
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important:** Change `JWT_SECRET` to a strong, random string in production!

3. Make sure MySQL is running on your system. See `MYSQL_SETUP.md` for detailed setup instructions.

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication Endpoints

### POST /api/auth/register
Register a new admin user
- Body: JSON with `name`, `username`, `password`
- Response: User object and JWT token

### POST /api/auth/login
Login user
- Body: JSON with `username`, `password`
- Response: User object and JWT token

### GET /api/auth/me
Get current authenticated user (requires Bearer token)
- Headers: `Authorization: Bearer <token>`
- Response: User object

### User Management Endpoints (Protected)

### GET /api/users
Get all users (requires authentication)
- Headers: `Authorization: Bearer <token>`
- Response: Array of user objects

### GET /api/users/:id
Get single user (requires authentication)

### PUT /api/users/:id
Update user (requires authentication)
- Body: JSON with `name`, `username`, `password` (optional)

### DELETE /api/users/:id
Delete user (requires authentication)

### Slider Endpoints

### GET /api/sliders
Get all slider images (public)
- Response: Array of slider image objects

### GET /api/sliders/:id
Get a single slider image by ID

### POST /api/sliders
Upload a new slider image (requires authentication)
- Headers: `Authorization: Bearer <token>`
- Body: Form-data with `image` file, optional `alt` text, optional `order` number
- Response: Created slider image object

### PUT /api/sliders/:id
Update slider image metadata (requires authentication)
- Headers: `Authorization: Bearer <token>`
- Body: JSON with `alt` and/or `order` fields

### DELETE /api/sliders/:id
Delete a slider image (requires authentication)
- Headers: `Authorization: Bearer <token>`
- Response: Success message

### GET /api/health
Health check endpoint

## File Upload

- Images are stored in `uploads/sliders/` directory
- Supported formats: JPEG, JPG, PNG, GIF, WEBP
- Maximum file size: 10MB
- Images are accessible at `/uploads/sliders/{filename}`


