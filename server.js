const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/sliders', express.static(path.join(__dirname, 'uploads', 'sliders')));
app.use('/uploads/featured-works', express.static(path.join(__dirname, 'uploads', 'featured-works')));
app.use('/uploads/featured-works/images', express.static(path.join(__dirname, 'uploads', 'featured-works', 'images')));

// MySQL connection using Sequelize
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'root';
const DB_NAME = process.env.DB_NAME || 'photography_site';
const DB_PORT = process.env.DB_PORT || 3306;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false, // Set to console.log to see SQL queries
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log('✅ Connected to MySQL database');
    // Sync models (create tables if they don't exist)
    sequelize.sync({ alter: true }).then(() => {
      console.log('✅ Database tables synchronized');
    });
  })
  .catch(err => {
    console.error('❌ MySQL connection error:', err.message);
    if (err.message.includes('Unknown database')) {
      console.log('\n⚠️  Database does not exist!');
      console.log(`   Run: npm run setup-db`);
      console.log(`   Or create database '${DB_NAME}' manually in MySQL\n`);
    } else {
      console.log('\n⚠️  Please make sure MySQL is running and database credentials are correct');
      console.log('   Update DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env file\n');
    }
  });

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    trim: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// Compare password method
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// SliderImage Model
const SliderImage = sequelize.define('SliderImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  alt: {
    type: DataTypes.STRING,
    defaultValue: 'Slider Image'
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'slider_images',
  timestamps: true
});

// FeaturedWork Model
const FeaturedWork = sequelize.define('FeaturedWork', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  heading: {
    type: DataTypes.STRING,
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'featured_works',
  timestamps: true
});

// FeaturedWorkImage Model (for internal images)
const FeaturedWorkImage = sequelize.define('FeaturedWorkImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  featuredWorkId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'featured_works',
      key: 'id'
    }
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'featured_work_images',
  timestamps: true
});

// ContactMessage Model
const ContactMessage = sequelize.define('ContactMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    trim: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    trim: true,
    validate: {
      isEmail: true
    }
  },
  service: {
    type: DataTypes.STRING,
    allowNull: false,
    trim: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    trim: true
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'contact_messages',
  timestamps: true
});

// Define relationships
FeaturedWork.hasMany(FeaturedWorkImage, { foreignKey: 'featuredWorkId', as: 'images', onDelete: 'CASCADE' });
FeaturedWorkImage.belongsTo(FeaturedWork, { foreignKey: 'featuredWorkId', as: 'featuredWork' });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Ensure uploads directories exist
const slidersUploadsDir = path.join(__dirname, 'uploads', 'sliders');
const featuredWorksUploadsDir = path.join(__dirname, 'uploads', 'featured-works');
const featuredWorkImagesUploadsDir = path.join(__dirname, 'uploads', 'featured-works', 'images');
if (!fs.existsSync(slidersUploadsDir)) {
  fs.mkdirSync(slidersUploadsDir, { recursive: true });
}
if (!fs.existsSync(featuredWorksUploadsDir)) {
  fs.mkdirSync(featuredWorksUploadsDir, { recursive: true });
}
if (!fs.existsSync(featuredWorkImagesUploadsDir)) {
  fs.mkdirSync(featuredWorkImagesUploadsDir, { recursive: true });
}

// Multer configuration for slider uploads
const sliderStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, slidersUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'slider-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer configuration for featured work uploads
const featuredWorkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, featuredWorksUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'featured-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer configuration for featured work internal images
const featuredWorkImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, featuredWorkImagesUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'featured-internal-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: sliderStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

const uploadFeaturedWork = multer({
  storage: featuredWorkStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

const uploadFeaturedWorkImage = multer({
  storage: featuredWorkImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Routes

// ============ AUTHENTICATION ROUTES ============

// POST /api/auth/register - Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ where: { username: username.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      password
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user', message: error.message });
  }
});

// POST /api/auth/login - Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ where: { username: username.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login', message: error.message });
  }
});

// GET /api/auth/me - Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user', message: error.message });
  }
});

// ============ USER MANAGEMENT ROUTES (Protected) ============

// Helper function to transform user object for frontend (add _id field)
const transformUser = (user) => {
  if (!user) return null;
  const userObj = user.toJSON ? user.toJSON() : user;
  return {
    ...userObj,
    _id: userObj.id.toString()
  };
};

// GET all users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    const transformedUsers = users.map(transformUser);
    res.json(transformedUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users', message: error.message });
  }
});

// GET single user
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(transformUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user', message: error.message });
  }
});

// POST create user
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ where: { username: username.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      password
    });

    await user.reload({ attributes: { exclude: ['password'] } });
    res.status(201).json(transformUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user', message: error.message });
  }
});

// PUT update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { name, username, password } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (username) updateData.username = username.toLowerCase();
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.password = password;
    }

    // Check if username is being changed and already exists
    if (username) {
      const existingUser = await User.findOne({
        where: {
          username: username.toLowerCase(),
          id: { [Sequelize.Op.ne]: req.params.id }
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update(updateData);
    await user.reload({ attributes: { exclude: ['password'] } });

    res.json(transformUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', message: error.message });
  }
});

// DELETE user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    // Prevent deleting yourself
    if (String(req.user.userId) === String(req.params.id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', message: error.message });
  }
});

// ============ SLIDER ROUTES ============

// GET all slider images (public)
app.get('/api/sliders', async (req, res) => {
  try {
    const sliders = await SliderImage.findAll({
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slider images', message: error.message });
  }
});

// GET single slider image
app.get('/api/sliders/:id', async (req, res) => {
  try {
    const slider = await SliderImage.findByPk(req.params.id);
    if (!slider) {
      return res.status(404).json({ error: 'Slider image not found' });
    }
    res.json(slider);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slider image', message: error.message });
  }
});

// POST upload new slider image (protected)
app.post('/api/sliders', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const sliderImage = await SliderImage.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      url: `/uploads/sliders/${req.file.filename}`,
      alt: req.body.alt || req.file.originalname,
      order: req.body.order || 0
    });

    res.status(201).json(sliderImage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload slider image', message: error.message });
  }
});

// PUT update slider image (alt text, order) (protected)
app.put('/api/sliders/:id', authenticateToken, async (req, res) => {
  try {
    const sliderId = parseInt(req.params.id);
    if (isNaN(sliderId)) {
      return res.status(400).json({ error: 'Invalid slider ID' });
    }
    const { alt, order } = req.body;
    console.log(`🔍 Updating slider (no image) with ID: ${sliderId}`);
    const slider = await SliderImage.findByPk(sliderId);

    if (!slider) {
      console.error(`❌ Slider not found with ID: ${sliderId}`);
      return res.status(404).json({ error: 'Slider image not found' });
    }

    await slider.update({ alt, order });
    await slider.reload();

    res.json(slider);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update slider image', message: error.message });
  }
});

// PUT update slider image with new file (protected)
app.put('/api/sliders/:id/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const sliderId = parseInt(req.params.id);
    if (isNaN(sliderId)) {
      return res.status(400).json({ error: 'Invalid slider ID' });
    }
    console.log(`🔍 Looking for slider with ID: ${sliderId} (type: ${typeof sliderId})`);
    const slider = await SliderImage.findByPk(sliderId);

    if (!slider) {
      console.error(`❌ Slider not found with ID: ${sliderId}`);
      return res.status(404).json({ error: 'Slider image not found' });
    }
    
    console.log(`✅ Found slider ID: ${slider.id}, filename: ${slider.filename}`);

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Delete old file from filesystem
    // The path stored in database is the full path from multer
    const oldFilePath = slider.path;
    if (oldFilePath) {
      // Handle both absolute and relative paths
      const fullPath = path.isAbsolute(oldFilePath) 
        ? oldFilePath 
        : path.join(__dirname, oldFilePath);
      
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log('✅ Deleted old file:', fullPath);
        } catch (deleteError) {
          console.error('❌ Error deleting old file:', deleteError.message);
          // Continue even if deletion fails
        }
      } else {
        console.warn('⚠️ Old file not found (may have been deleted already):', fullPath);
      }
    }

    // Update existing record with new file info
    const updateData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      url: `/uploads/sliders/${req.file.filename}`
    };

    if (req.body.alt) updateData.alt = req.body.alt;
    if (req.body.order !== undefined) updateData.order = parseInt(req.body.order);

    // Use update() to modify existing record, not create new one
    console.log(`🔄 Updating slider ID: ${slider.id} (not creating new record)`);
    await slider.update(updateData);
    await slider.reload();
    console.log(`✅ Slider updated successfully. ID: ${slider.id}, New filename: ${slider.filename}`);

    res.json(slider);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update slider image', message: error.message });
  }
});

// DELETE slider image (protected)
app.delete('/api/sliders/:id', authenticateToken, async (req, res) => {
  try {
    const slider = await SliderImage.findByPk(req.params.id);
    if (!slider) {
      return res.status(404).json({ error: 'Slider image not found' });
    }

    // Delete file from filesystem
    const filePath = path.isAbsolute(slider.path) ? slider.path : path.join(__dirname, slider.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await slider.destroy();
    res.json({ message: 'Slider image deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete slider image', message: error.message });
  }
});

// ============ FEATURED WORK ROUTES ============

// GET all featured works (public)
app.get('/api/featured-works', async (req, res) => {
  try {
    const featuredWorks = await FeaturedWork.findAll({
      include: [{
        model: FeaturedWorkImage,
        as: 'images',
        required: false,
        separate: false,
        order: [['order', 'ASC']]
      }],
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
    console.log('📦 GET /api/featured-works - Found', featuredWorks.length, 'featured works');
    if (featuredWorks.length > 0) {
      console.log('📦 First featured work:', JSON.stringify(featuredWorks[0].toJSON(), null, 2));
    }
    res.json(featuredWorks);
  } catch (error) {
    console.error('❌ Error fetching featured works:', error);
    res.status(500).json({ error: 'Failed to fetch featured works', message: error.message });
  }
});

// GET single featured work
app.get('/api/featured-works/:id', async (req, res) => {
  try {
    const featuredWork = await FeaturedWork.findByPk(req.params.id, {
      include: [{
        model: FeaturedWorkImage,
        as: 'images',
        order: [['order', 'ASC']]
      }]
    });
    if (!featuredWork) {
      return res.status(404).json({ error: 'Featured work not found' });
    }
    res.json(featuredWork);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured work', message: error.message });
  }
});

// POST upload new featured work (protected)
app.post('/api/featured-works', authenticateToken, uploadFeaturedWork.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.body.heading) {
      return res.status(400).json({ error: 'Heading is required' });
    }

    const featuredWork = await FeaturedWork.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      url: `/uploads/featured-works/${req.file.filename}`,
      heading: req.body.heading,
      order: req.body.order || 0
    });

    const featuredWorkWithImages = await FeaturedWork.findByPk(featuredWork.id, {
      include: [{
        model: FeaturedWorkImage,
        as: 'images',
        order: [['order', 'ASC']]
      }]
    });

    res.status(201).json(featuredWorkWithImages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload featured work', message: error.message });
  }
});

// PUT update featured work (heading, order) (protected)
app.put('/api/featured-works/:id', authenticateToken, async (req, res) => {
  try {
    const featuredWorkId = parseInt(req.params.id);
    if (isNaN(featuredWorkId)) {
      return res.status(400).json({ error: 'Invalid featured work ID' });
    }
    const { heading, order } = req.body;
    const featuredWork = await FeaturedWork.findByPk(featuredWorkId);

    if (!featuredWork) {
      return res.status(404).json({ error: 'Featured work not found' });
    }

    const updateData = {};
    if (heading !== undefined) updateData.heading = heading;
    if (order !== undefined) updateData.order = parseInt(order);

    await featuredWork.update(updateData);
    
    const featuredWorkWithImages = await FeaturedWork.findByPk(featuredWorkId, {
      include: [{
        model: FeaturedWorkImage,
        as: 'images',
        order: [['order', 'ASC']]
      }]
    });

    res.json(featuredWorkWithImages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update featured work', message: error.message });
  }
});

// PUT update featured work with new file (protected)
app.put('/api/featured-works/:id/image', authenticateToken, uploadFeaturedWork.single('image'), async (req, res) => {
  try {
    const featuredWorkId = parseInt(req.params.id);
    if (isNaN(featuredWorkId)) {
      return res.status(400).json({ error: 'Invalid featured work ID' });
    }

    const featuredWork = await FeaturedWork.findByPk(featuredWorkId);

    if (!featuredWork) {
      return res.status(404).json({ error: 'Featured work not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Delete old file from filesystem
    const oldFilePath = featuredWork.path;
    if (oldFilePath) {
      const fullPath = path.isAbsolute(oldFilePath)
        ? oldFilePath
        : path.join(__dirname, oldFilePath);

      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (deleteError) {
          console.error('Error deleting old featured work file:', deleteError.message);
        }
      }
    }

    // Update existing record with new file info
    const updateData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      url: `/uploads/featured-works/${req.file.filename}`
    };

    if (req.body.heading) updateData.heading = req.body.heading;
    if (req.body.order !== undefined) updateData.order = parseInt(req.body.order);

    await featuredWork.update(updateData);
    
    const featuredWorkWithImages = await FeaturedWork.findByPk(featuredWorkId, {
      include: [{
        model: FeaturedWorkImage,
        as: 'images',
        order: [['order', 'ASC']]
      }]
    });

    res.json(featuredWorkWithImages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update featured work', message: error.message });
  }
});

// DELETE featured work (protected)
app.delete('/api/featured-works/:id', authenticateToken, async (req, res) => {
  try {
    const featuredWork = await FeaturedWork.findByPk(req.params.id, {
      include: [{
        model: FeaturedWorkImage,
        as: 'images'
      }]
    });
    if (!featuredWork) {
      return res.status(404).json({ error: 'Featured work not found' });
    }

    // Delete main image file from filesystem
    const filePath = path.isAbsolute(featuredWork.path) ? featuredWork.path : path.join(__dirname, featuredWork.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete all internal images
    if (featuredWork.images && featuredWork.images.length > 0) {
      for (const image of featuredWork.images) {
        const imagePath = path.isAbsolute(image.path) ? image.path : path.join(__dirname, image.path);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }

    // Delete from database (cascade will delete internal images)
    await featuredWork.destroy();
    res.json({ message: 'Featured work deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete featured work', message: error.message });
  }
});

// ============ FEATURED WORK INTERNAL IMAGES ROUTES ============

// GET all internal images for a featured work
app.get('/api/featured-works/:id/images', async (req, res) => {
  try {
    const featuredWorkId = parseInt(req.params.id);
    if (isNaN(featuredWorkId)) {
      return res.status(400).json({ error: 'Invalid featured work ID' });
    }

    console.log('📥 Fetching internal images for featured work ID:', featuredWorkId);

    const images = await FeaturedWorkImage.findAll({
      where: { featuredWorkId },
      order: [['order', 'ASC'], ['createdAt', 'ASC']]
    });

    console.log('✅ Found', images.length, 'internal images');
    res.json(images);
  } catch (error) {
    console.error('❌ Error fetching internal images:', error);
    res.status(500).json({ error: 'Failed to fetch internal images', message: error.message });
  }
});

// POST upload internal image to featured work (protected)
app.post('/api/featured-works/:id/images', authenticateToken, uploadFeaturedWorkImage.single('image'), async (req, res) => {
  try {
    const featuredWorkId = parseInt(req.params.id);
    if (isNaN(featuredWorkId)) {
      return res.status(400).json({ error: 'Invalid featured work ID' });
    }

    console.log('📤 Uploading internal image for featured work ID:', featuredWorkId);
    console.log('📤 File received:', req.file ? req.file.originalname : 'No file');

    const featuredWork = await FeaturedWork.findByPk(featuredWorkId);
    if (!featuredWork) {
      console.error('❌ Featured work not found:', featuredWorkId);
      return res.status(404).json({ error: 'Featured work not found' });
    }

    if (!req.file) {
      console.error('❌ No file provided in request');
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('✅ File details:', {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    });

    const internalImage = await FeaturedWorkImage.create({
      featuredWorkId: featuredWorkId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      url: `/uploads/featured-works/images/${req.file.filename}`,
      order: req.body.order || 0
    });

    console.log('✅ Internal image uploaded successfully:', internalImage.id);
    res.status(201).json(internalImage);
  } catch (error) {
    console.error('❌ Error uploading internal image:', error);
    res.status(500).json({ error: 'Failed to upload internal image', message: error.message });
  }
});

// DELETE internal image (protected)
app.delete('/api/featured-works/:id/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const imageId = parseInt(req.params.imageId);
    if (isNaN(imageId)) {
      return res.status(400).json({ error: 'Invalid image ID' });
    }

    const image = await FeaturedWorkImage.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Internal image not found' });
    }

    // Delete file from filesystem
    const filePath = path.isAbsolute(image.path) ? image.path : path.join(__dirname, image.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await image.destroy();
    res.json({ message: 'Internal image deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete internal image', message: error.message });
  }
});

// ============ CONTACT MESSAGE ROUTES ============

// POST submit contact form (public)
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, service, phone, message } = req.body;

    // Validation
    if (!name || !email || !service || !message) {
      return res.status(400).json({ error: 'Name, email, service, and message are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const contactMessage = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      service: service.trim(),
      phone: phone ? phone.trim() : null,
      message: message.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your message! We will get back to you within 24 hours.',
      data: contactMessage
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit contact form', message: error.message });
  }
});

// GET all contact messages (protected)
app.get('/api/contact', authenticateToken, async (req, res) => {
  try {
    const messages = await ContactMessage.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact messages', message: error.message });
  }
});

// GET single contact message (protected)
app.get('/api/contact/:id', authenticateToken, async (req, res) => {
  try {
    const message = await ContactMessage.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Contact message not found' });
    }

    // Mark as read
    if (!message.read) {
      await message.update({ read: true });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact message', message: error.message });
  }
});

// PUT mark message as read/unread (protected)
app.put('/api/contact/:id/read', authenticateToken, async (req, res) => {
  try {
    const { read } = req.body;
    const message = await ContactMessage.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Contact message not found' });
    }

    await message.update({ read: read === true || read === 'true' });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message status', message: error.message });
  }
});

// DELETE contact message (protected)
app.delete('/api/contact/:id', authenticateToken, async (req, res) => {
  try {
    const message = await ContactMessage.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Contact message not found' });
    }

    await message.destroy();
    res.json({ message: 'Contact message deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact message', message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
