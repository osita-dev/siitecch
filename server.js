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

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', verifyToken);
app.use('/api/users', authRoutes);



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

// Add an example to a specific category by name
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

// Add an example to a specific category by ID
app.post('/api/languages/:languageId/categories/:categoryId/examples', async (req, res) => {
  const { languageId, categoryId } = req.params;
  const { title, code, description } = req.body;

  try {
    const language = await Language.findById(languageId);
    if (!language) return res.status(404).json({ message: 'Language not found' });

    const category = language.categories.id(categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    category.examples.push({ title, code, description });
    await language.save();

    res.status(200).json({ message: 'Example added successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to add example' });
  }
});

// Server-side - Update Language
app.put('/api/languages/:id', async (req, res) => {
  const { id } = req.params;
  const { name, slug, description } = req.body;

  try {
    const updatedLanguage = await Language.updateOne(
      { _id: id }, // Find the language by ID
      { $set: { name, slug, description } } // Update fields
    );

    if (updatedLanguage.modifiedCount > 0) {
      return res.status(200).json({ message: 'Language updated successfully' });
    } else {
      return res.status(404).json({ message: 'Language not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating language' });
  }
});

// Server-side - Update Category
app.put('/api/languages/:languageId/categories/:categoryId', async (req, res) => {
  const { languageId, categoryId } = req.params;
  const { name, content, video_link } = req.body;

  try {
    const updatedCategory = await Language.updateOne(
      { _id: categoryId, language: languageId }, // Find category by ID within the specific language
      { $set: { name, content, video_link } } // Update fields
    );

    if (updatedCategory.modifiedCount > 0) {
      return res.status(200).json({ message: 'Category updated successfully' });
    } else {
      return res.status(404).json({ message: 'Category not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating category' });
  }
});

// Server-side - Update Example
app.put('/api/languages/:languageId/categories/:categoryId/examples/:exampleId', async (req, res) => {
  const { languageId, categoryId, exampleId } = req.params;
  const { title, code, description } = req.body;

  try {
    const updatedExample = await Language.updateOne(
      { _id: exampleId, language: languageId, category: categoryId }, // Find example by ID within the language and category
      { $set: { title, code, description } } // Update fields
    );

    if (updatedExample.modifiedCount > 0) {
      return res.status(200).json({ message: 'Example updated successfully' });
    } else {
      return res.status(404).json({ message: 'Example not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating example' });
  }
});

// Server-side - Delete Language
app.delete('/api/languages/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedLanguage = await Language.deleteOne({ _id: id });

    if (deletedLanguage.deletedCount > 0) {
      return res.status(200).json({ message: 'Language deleted successfully' });
    } else {
      return res.status(404).json({ message: 'Language not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting language' });
  }
});


// Server-side - Delete Category
app.delete('/api/languages/:languageId/categories/:categoryId', async (req, res) => {
  const { languageId, categoryId } = req.params;

  try {
    const deletedCategory = await Language.deleteOne({ _id: categoryId, language: languageId });

    if (deletedCategory.deletedCount > 0) {
      return res.status(200).json({ message: 'Category deleted successfully' });
    } else {
      return res.status(404).json({ message: 'Category not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting category' });
  }
});


// Server-side - Delete Example
app.delete('/api/languages/:languageId/categories/:categoryId/examples/:exampleId', async (req, res) => {
  const { languageId, categoryId, exampleId } = req.params;

  try {
    const deletedExample = await Language.deleteOne({ _id: exampleId, language: languageId, category: categoryId });
    console.log(deletedExample);
    if (deletedExample.deletedCount > 0) {
      return res.status(200).json({ message: 'Example deleted successfully' });
    } else {
      return res.status(404).json({ message: 'Example not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting example' });
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
