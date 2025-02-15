dotenv.config();
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Language from './models/language.js';
import verifyToken from './middlewares/authenticateToken.js';
import Feedback from './models/feedback.js';

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'https://siitecch-learn.vercel.app',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', verifyToken);
app.use('/api/users', authRoutes);

// Route to keep MongoDB connection active
app.get("/api/ping", async (req, res) => {
  try {
    // Simple MongoDB query to keep the connection active
    await mongoose.connection.db.command({ ping: 1 });
    res.status(200).send("Database connection is active");
  } catch (error) {
    res.status(500).send("Error keeping database connection alive");
  }
});

// Example Protected Route
app.get('/dashboard', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'Welcome to the dashboard!',
    user: req.user,
  });
});


app.get('/count-videos', async (req, res) => {
  try {
      const result = await Language.aggregate([
          { $unwind: "$categories" }, // Flatten categories array
          { $match: { "categories.video_link": { $ne: null, $ne: "" } } }, // Filter non-empty video links
          { $count: "totalVideos" } // Count them
      ]);

      const totalVideos = result.length > 0 ? result[0].totalVideos : 0;
      res.json({ totalVideos });
  } catch (error) {
      console.error('Error counting video links:', error);
      res.status(500).json({ error: 'Failed to count video links' });
  }
});


// Fetch all languages
app.get('/api/languages', async (req, res) => {
  try {
    const languages = await Language.find().select('name slug description');
    res.json(languages);
  } catch (err) {
    console.error('Error fetching languages:', err);
    res.status(500).json({ error: 'Failed to fetch languages.' });
  }
});


// Fetch a single language by slug
app.get('/api/languages/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const language = await Language.findOne({ slug });
    if (!language) {
      return res.status(404).json({ error: 'Language not found.' });
    }
    res.json(language);
  } catch (error) {
    console.error('Detailed Error:', error.message);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Add a new language
app.post('/api/languages', async (req, res) => {
  const { name, slug, description } = req.body;

  try {
    const newLanguage = new Language({
      name,
      slug,
      description,
      categories: [] // Initialize with an empty array
    });

    await newLanguage.save();
    res.status(200).json({ message: 'Language added successfully!', languageId: newLanguage._id });
  } catch (error) {
    console.error('Error adding language:', error);
    res.status(500).json({ message: 'Failed to add language', error: error.message });
  }
});

// Add a new category to a language
app.post('/api/languages/:languageId/categories', async (req, res) => {
  const { name, content, video_link } = req.body;
  const { languageId } = req.params;

  try {
    const language = await Language.findById(languageId);

    if (!language) {
      return res.status(404).json({ message: 'Language not found' });
    }

    // Add the new category to the categories array
    const newCategory = {
      name: name || '',
      content: content || '',
      video_link: video_link || '',
      examples: [] // Initialize empty examples array
    };

    language.categories.push(newCategory);
    await language.save();

    res.status(200).json({ message: 'Category added successfully!', categoryId: language.categories[language.categories.length - 1]._id });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ message: 'Failed to add category', error: error.message });
  }
});

// Get categories by language
app.get('/api/languages/:languageId/categories', async (req, res) => {
  const { languageId } = req.params;

  try {
    const language = await Language.findById(languageId);

    if (!language) {
      return res.status(404).json({ message: 'Language not found' });
    }

    const categories = language.categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// this is feching all categories

app.get('/api/categories/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Find the language that contains the category
    const language = await Language.findOne({ 'categories._id': id });

    if (!language) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Extract the specific category
    const category = language.categories.find(cat => cat._id.toString() === id);

    res.status(200).json({ 
      ...category.toObject(),
      language_id: language._id // Attach language ID for reference
    });

  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});


app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, content, video_link } = req.body;

  try {
    // Find the language that contains the category
    const language = await Language.findOne({ 'categories._id': id });

    if (!language) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Find the specific category inside the language
    const category = language.categories.find(cat => cat._id.toString() === id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Update category fields
    category.name = name;
    category.content = content;
    category.video_link = video_link;

    // Save the updated language document
    await language.save();

    res.status(200).json({ message: 'Category updated successfully' });

  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

app.post("/api/languages/:languageId/categories/:categoryId/videos", async (req, res) => {
  const { languageId, categoryId } = req.params;
  const { videoUrl } = req.body;

  if (!videoUrl) {
      return res.status(400).json({ message: "Video URL is required" });
  }

  try {
      const language = await Language.findById(languageId);
      if (!language) {
          return res.status(404).json({ message: "Language not found" });
      }

      const category = language.categories.id(categoryId);
      if (!category) {
          return res.status(404).json({ message: "Category not found" });
      }

      // Update video link field
      category.video_link = videoUrl;

      await language.save();

      return res.status(201).json({ message: "Video link updated successfully", category });
  } catch (error) {
      console.error("Error updating video link:", error);
      return res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required' });
    }

    const newFeedback = new Feedback({ name, email, subject, message });
    await newFeedback.save();

    res.status(201).json({ message: 'Feedback received successfully!' });
  } catch (error) {
    console.error('Feedback Error:', error);
    res.status(500).json({ message: 'Failed to send feedback' });
  }
});


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
