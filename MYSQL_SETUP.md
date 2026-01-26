# MySQL Setup Guide

Your backend now uses MySQL instead of MongoDB. Follow these steps to set up MySQL.

## Option 1: Install MySQL Locally

### Windows:
1. **Download MySQL:**
   - Go to: https://dev.mysql.com/downloads/installer/
   - Download MySQL Installer for Windows
   - Choose "Developer Default" or "Server only"

2. **Install MySQL:**
   - Run the installer
   - Set root password (remember this!)
   - Complete the installation

3. **Verify Installation:**
   - Open Command Prompt
   - Run: `mysql --version`
   - Or use MySQL Workbench (GUI tool)

4. **Start MySQL Service:**
   - MySQL should start automatically
   - Or use Services (services.msc) to start "MySQL80"

### Mac:
```bash
# Using Homebrew
brew install mysql
brew services start mysql
mysql_secure_installation
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

## Option 2: Use XAMPP/WAMP (Windows - Easy Option)

1. **Download XAMPP:**
   - Go to: https://www.apachefriends.org/
   - Download and install XAMPP

2. **Start MySQL:**
   - Open XAMPP Control Panel
   - Click "Start" next to MySQL

3. **Default credentials:**
   - Username: `root`
   - Password: (empty/blank)

## Create Database

1. **Using MySQL Command Line:**
   ```bash
   mysql -u root -p
   # Enter your password when prompted
   
   CREATE DATABASE photography_site;
   USE photography_site;
   SHOW TABLES;
   exit;
   ```

2. **Using MySQL Workbench:**
   - Open MySQL Workbench
   - Connect to your server
   - Right-click and create new schema named `photography_site`

3. **Using phpMyAdmin (XAMPP):**
   - Go to: http://localhost/phpmyadmin
   - Click "New" → Enter database name: `photography_site`
   - Click "Create"

## Configure Backend

1. **Create/Update `.env` file in `backend/` folder:**
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=photography_site
   DB_PORT=3306
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

The server will automatically create the required tables (`users` and `slider_images`) on first run.

## Verify Connection

You should see:
```
✅ Connected to MySQL database
✅ Database tables synchronized
Server is running on port 3000
```

## Troubleshooting

### "Access denied for user"
- Check username and password in `.env` file
- Verify MySQL root password
- Try: `mysql -u root -p` to test connection

### "Can't connect to MySQL server"
- Make sure MySQL service is running
- Check if MySQL is running on port 3306
- Verify DB_HOST in `.env` file

### "Unknown database"
- Create the database first (see "Create Database" section above)
- Or update DB_NAME in `.env` to an existing database

### Port 3306 already in use
- Another MySQL instance might be running
- Stop other MySQL services or change port in `.env`

## Database Tables

The following tables will be created automatically:
- `users` - Stores admin user accounts
- `slider_images` - Stores hero slider image metadata

## Next Steps

Once MySQL is connected:
1. Restart your backend server
2. Access admin panel at `http://localhost:4200/admin/login`
3. Register your first admin account
4. Start managing users and sliders!

## Using Cloud MySQL (Alternative)

You can also use cloud MySQL services:
- **AWS RDS**
- **Google Cloud SQL**
- **Azure Database for MySQL**
- **PlanetScale** (free tier available)

Just update the connection details in your `.env` file.

