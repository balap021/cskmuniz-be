# Quick Start Guide - MySQL Setup

## Step 1: Install MySQL Dependencies

```bash
cd backend
npm install
```

## Step 2: Create .env File

Create a `.env` file in the `backend/` folder:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=photography_site
DB_PORT=3306
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important:** Replace `your_mysql_password` with your actual MySQL root password.

## Step 3: Create the Database

### Option A: Automatic (Recommended)

```bash
npm run setup-db
```

This will automatically create the `photography_site` database.

### Option B: Manual (Using MySQL Command Line)

1. Open MySQL command line or MySQL Workbench
2. Connect to your MySQL server
3. Run:
   ```sql
   CREATE DATABASE photography_site;
   ```

### Option C: Using phpMyAdmin (XAMPP)

1. Go to: http://localhost/phpmyadmin
2. Click "New" in the left sidebar
3. Enter database name: `photography_site`
4. Click "Create"

## Step 4: Start the Server

```bash
npm start
```

You should see:
```
✅ Connected to MySQL database
✅ Database tables synchronized
Server is running on port 3000
```

## Troubleshooting

### "Access denied for user"
- Check your MySQL root password in `.env` file
- Try connecting manually: `mysql -u root -p`

### "Can't connect to MySQL server"
- Make sure MySQL service is running
- Check if MySQL is on port 3306
- Verify DB_HOST in `.env` (should be `localhost`)

### "Unknown database"
- Run `npm run setup-db` to create the database
- Or create it manually (see Step 3)

## Next Steps

Once the server is running:
1. The tables (`users` and `slider_images`) will be created automatically
2. Access admin panel: http://localhost:4200/admin/login
3. Register your first admin account

