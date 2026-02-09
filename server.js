const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression()); // Enable gzip compression
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically with caching headers
const staticOptions = {
  maxAge: '1y', // 1 year cache
  etag: true,
  lastModified: true
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use('/uploads/sliders', express.static(path.join(__dirname, 'uploads', 'sliders'), staticOptions));
app.use('/uploads/featured-works', express.static(path.join(__dirname, 'uploads', 'featured-works'), staticOptions));
app.use('/uploads/featured-works/images', express.static(path.join(__dirname, 'uploads', 'featured-works', 'images'), staticOptions));
app.use('/uploads/services', express.static(path.join(__dirname, 'uploads', 'services'), staticOptions));

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
  .then(async () => {
    console.log('✅ Connected to MySQL database');
    // Sync models (create tables if they don't exist, but don't alter existing tables)
    // Using { alter: false } to avoid "too many keys" error on existing tables
    try {
      await sequelize.sync({ alter: false });
      console.log('✅ Database tables synchronized');
      
      // Manually add width and height columns if they don't exist (for existing tables)
      await addImageDimensionColumns();
    } catch (syncError) {
      console.warn('⚠️  Database sync warning:', syncError.message);
      console.log('   Tables may already exist. If you need to add new columns, use migrations.');
    }
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
  width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'featured_work_images',
  timestamps: true
});

// Service Model
const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    trim: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
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
  width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'services',
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

// Helper function to add width/height columns to existing tables
const addImageDimensionColumns = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    
    // Check and add columns to slider_images table
    const sliderTableInfo = await queryInterface.describeTable('slider_images');
    if (!sliderTableInfo.width) {
      await queryInterface.addColumn('slider_images', 'width', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added width column to slider_images');
    }
    if (!sliderTableInfo.height) {
      await queryInterface.addColumn('slider_images', 'height', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added height column to slider_images');
    }
    
    // Check and add columns to featured_works table
    const featuredWorksTableInfo = await queryInterface.describeTable('featured_works');
    if (!featuredWorksTableInfo.width) {
      await queryInterface.addColumn('featured_works', 'width', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added width column to featured_works');
    }
    if (!featuredWorksTableInfo.height) {
      await queryInterface.addColumn('featured_works', 'height', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added height column to featured_works');
    }
    
    // Check and add columns to featured_work_images table
    const featuredWorkImagesTableInfo = await queryInterface.describeTable('featured_work_images');
    if (!featuredWorkImagesTableInfo.width) {
      await queryInterface.addColumn('featured_work_images', 'width', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added width column to featured_work_images');
    }
    if (!featuredWorkImagesTableInfo.height) {
      await queryInterface.addColumn('featured_work_images', 'height', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added height column to featured_work_images');
    }
    
    // Check and add columns to services table
    const servicesTableInfo = await queryInterface.describeTable('services');
    if (!servicesTableInfo.width) {
      await queryInterface.addColumn('services', 'width', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added width column to services');
    }
    if (!servicesTableInfo.height) {
      await queryInterface.addColumn('services', 'height', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added height column to services');
    }
  } catch (error) {
    // Ignore errors if columns already exist or tables don't exist yet
    if (!error.message.includes('Duplicate column name') && !error.message.includes("doesn't exist")) {
      console.warn('⚠️  Warning adding dimension columns:', error.message);
    }
  }
};

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
const servicesUploadsDir = path.join(__dirname, 'uploads', 'services');
if (!fs.existsSync(slidersUploadsDir)) {
  fs.mkdirSync(slidersUploadsDir, { recursive: true });
}
if (!fs.existsSync(featuredWorksUploadsDir)) {
  fs.mkdirSync(featuredWorksUploadsDir, { recursive: true });
}
if (!fs.existsSync(featuredWorkImagesUploadsDir)) {
  fs.mkdirSync(featuredWorkImagesUploadsDir, { recursive: true });
}
if (!fs.existsSync(servicesUploadsDir)) {
  fs.mkdirSync(servicesUploadsDir, { recursive: true });
}

// Image processing utilities
const processImage = async (inputPath, outputPath, options = {}) => {
  const {
    quality = 92, // Increased from 85 to 92 for better clarity
    maxWidth = null,
    maxHeight = null,
    format = 'webp'
  } = options;

  let pipeline = sharp(inputPath);

  // Get image metadata
  const metadata = await pipeline.metadata();
  
  // Resize if needed
  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3' // Better quality resampling
    });
  }

  // Convert and compress based on format
  if (format === 'webp') {
    pipeline = pipeline.webp({ 
      quality,
      effort: 6, // Higher effort for better compression (0-6, 6 is best)
      nearLossless: false, // Set to true for near-lossless quality (larger files)
      smartSubsample: true // Better quality subsampling
    });
  } else if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ 
      quality, 
      mozjpeg: true,
      trellisQuantisation: true, // Better quality
      overshootDeringing: true,
      optimizeScans: true
    });
  } else if (format === 'png') {
    pipeline = pipeline.png({ 
      quality: Math.min(100, quality * 1.1), // PNG quality is 0-100
      compressionLevel: 9,
      palette: true // Use palette for better compression
    });
  }

  await pipeline.toFile(outputPath);
  
  // Get optimized image metadata
  const optimizedMetadata = await sharp(outputPath).metadata();
  
  return {
    width: optimizedMetadata.width,
    height: optimizedMetadata.height,
    size: fs.statSync(outputPath).size,
    format: optimizedMetadata.format
  };
};

// Check if browser supports WebP
const supportsWebP = (req) => {
  const accept = req.headers.accept || '';
  return accept.includes('image/webp');
};

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

// Multer configuration for service uploads
const serviceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, servicesUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
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

const uploadService = multer({
  storage: serviceStorage,
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

    // Process and optimize image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(slidersUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file and use optimized version
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    const sliderImage = await SliderImage.create({
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/sliders/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height,
      alt: req.body.alt || req.file.originalname,
      order: req.body.order || 0
    });

    res.status(201).json(sliderImage);
  } catch (error) {
    console.error('Error processing slider image:', error);
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
    const oldFilePath = slider.path;
    if (oldFilePath) {
      const fullPath = path.isAbsolute(oldFilePath) 
        ? oldFilePath 
        : path.join(__dirname, oldFilePath);
      
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log('✅ Deleted old file:', fullPath);
        } catch (deleteError) {
          console.error('❌ Error deleting old file:', deleteError.message);
        }
      }
    }

    // Process and optimize new image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(slidersUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    // Update existing record with optimized file info
    const updateData = {
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/sliders/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height
    };

    if (req.body.alt) updateData.alt = req.body.alt;
    if (req.body.order !== undefined) updateData.order = parseInt(req.body.order);

    await slider.update(updateData);
    await slider.reload();

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

    // Process and optimize image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(featuredWorksUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    const featuredWork = await FeaturedWork.create({
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/featured-works/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height,
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

    // Process and optimize new image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(featuredWorksUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    // Update existing record with optimized file info
    const updateData = {
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/featured-works/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height
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

    // Process and optimize image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(featuredWorkImagesUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    const internalImage = await FeaturedWorkImage.create({
      featuredWorkId: featuredWorkId,
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/featured-works/images/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height,
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

// ============ SERVICE ROUTES ============

// GET all services (public)
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.findAll({
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services', message: error.message });
  }
});

// GET single service
app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch service', message: error.message });
  }
});

// POST upload new service (protected)
app.post('/api/services', authenticateToken, uploadService.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.body.title || !req.body.description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Process and optimize image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(servicesUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    const service = await Service.create({
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/services/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height,
      title: req.body.title,
      description: req.body.description,
      order: req.body.order || 0
    });

    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service', message: error.message });
  }
});

// PUT update service (title, description, order) (protected)
app.put('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }
    const { title, description, order } = req.body;
    const service = await Service.findByPk(serviceId);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = parseInt(order);

    await service.update(updateData);
    await service.reload();

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service', message: error.message });
  }
});

// PUT update service with new file (protected)
app.put('/api/services/:id/image', authenticateToken, uploadService.single('image'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }

    const service = await Service.findByPk(serviceId);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Delete old file from filesystem
    const oldFilePath = service.path;
    if (oldFilePath) {
      const fullPath = path.isAbsolute(oldFilePath)
        ? oldFilePath
        : path.join(__dirname, oldFilePath);

      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (deleteError) {
          console.error('Error deleting old service file:', deleteError.message);
        }
      }
    }

    // Process and optimize new image
    const originalPath = req.file.path;
    const optimizedFilename = req.file.filename.replace(/\.[^/.]+$/, '') + '.webp';
    const optimizedPath = path.join(servicesUploadsDir, optimizedFilename);
    
    const metadata = await processImage(originalPath, optimizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp'
    });

    // Delete original file
    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }

    // Update existing record with optimized file info
    const updateData = {
      filename: optimizedFilename,
      originalName: req.file.originalname,
      path: optimizedPath,
      url: `/uploads/services/${optimizedFilename}`,
      width: metadata.width,
      height: metadata.height
    };

    if (req.body.title) updateData.title = req.body.title;
    if (req.body.description) updateData.description = req.body.description;
    if (req.body.order !== undefined) updateData.order = parseInt(req.body.order);

    await service.update(updateData);
    await service.reload();

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service image', message: error.message });
  }
});

// DELETE service (protected)
app.delete('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Delete file from filesystem
    const filePath = path.isAbsolute(service.path) ? service.path : path.join(__dirname, service.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await service.destroy();
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service', message: error.message });
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

// ============ DYNAMIC IMAGE RESIZING (On-Demand) ============

// In-memory cache for resized images (optional - can be cleared)
const imageCache = new Map();

// GET dynamic image resizing endpoint
app.get('/api/images/:type/:id/:size', async (req, res) => {
  try {
    const { type, id, size } = req.params;
    
    // Validate size parameter
    const validSizes = ['thumb', 'medium', 'large', 'original'];
    if (!validSizes.includes(size)) {
      return res.status(400).json({ error: 'Invalid size. Use: thumb, medium, large, or original' });
    }

    // Define size dimensions
    const sizeDimensions = {
      thumb: { maxWidth: 300, maxHeight: 300 },
      medium: { maxWidth: 800, maxHeight: 800 },
      large: { maxWidth: 1920, maxHeight: 1920 },
      original: { maxWidth: null, maxHeight: null }
    };

    // Find the image record based on type
    let imageRecord = null;
    let imagePath = null;

    switch (type) {
      case 'slider':
        imageRecord = await SliderImage.findByPk(id);
        break;
      case 'featured-work':
        imageRecord = await FeaturedWork.findByPk(id);
        break;
      case 'featured-work-image':
        imageRecord = await FeaturedWorkImage.findByPk(id);
        break;
      case 'service':
        imageRecord = await Service.findByPk(id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid image type' });
    }

    if (!imageRecord) {
      return res.status(404).json({ error: 'Image not found' });
    }

    imagePath = path.isAbsolute(imageRecord.path) 
      ? imageRecord.path 
      : path.join(__dirname, imageRecord.path);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    // If original size requested, serve directly
    if (size === 'original') {
      const format = supportsWebP(req) ? 'webp' : path.extname(imagePath).slice(1);
      if (format === 'webp' && !imagePath.endsWith('.webp')) {
        // Need to convert on-the-fly
        const tempPath = imagePath + '.temp.webp';
        await processImage(imagePath, tempPath, { quality: 92, format: 'webp' });
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.sendFile(tempPath, () => {
          // Clean up temp file after sending
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        });
      } else {
        res.setHeader('Content-Type', `image/${format}`);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.sendFile(imagePath);
      }
      return;
    }

    // Generate resized image on-demand
    const dimensions = sizeDimensions[size];
    const cacheKey = `${type}-${id}-${size}`;
    
    // Check cache first
    if (imageCache.has(cacheKey)) {
      const cachedPath = imageCache.get(cacheKey);
      if (fs.existsSync(cachedPath)) {
        const format = supportsWebP(req) ? 'webp' : 'jpeg';
        res.setHeader('Content-Type', `image/${format}`);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.sendFile(cachedPath);
        return;
      } else {
        imageCache.delete(cacheKey);
      }
    }

    // Generate resized image
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const resizedFilename = `${cacheKey}-${Date.now()}.webp`;
    const resizedPath = path.join(tempDir, resizedFilename);
    
    await processImage(imagePath, resizedPath, {
      quality: 92, // Higher quality for better clarity
      format: 'webp',
      maxWidth: dimensions.maxWidth,
      maxHeight: dimensions.maxHeight
    });

    // Cache the resized image (limit cache size)
    if (imageCache.size > 100) {
      // Clear oldest entries
      const firstKey = imageCache.keys().next().value;
      const firstPath = imageCache.get(firstKey);
      if (fs.existsSync(firstPath)) {
        fs.unlinkSync(firstPath);
      }
      imageCache.delete(firstKey);
    }
    imageCache.set(cacheKey, resizedPath);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(resizedPath);
  } catch (error) {
    console.error('Error resizing image:', error);
    res.status(500).json({ error: 'Failed to resize image', message: error.message });
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

