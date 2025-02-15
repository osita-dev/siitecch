import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import authenticate from '../middlewares/authenticateToken.js';

const router = express.Router();

// protected route
router.get('/protected', authenticate, (req, res) => {
  res.json({
    message: 'You have accessed a protected route',
    user: req.user,
  });
});

router.get('/admin', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }

  res.json({
    message: 'Welcome, Admin!',
    user: req.user,
  });
});

router.get('/count', async (req, res) => {
  try {
      const userCount = await User.countDocuments();
      res.json({ totalUsers: userCount });
  } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// Signup route
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Set default role if not provided
    const role = 'student'; // default role

    // Create a new user
    const newUser = new User({ name, email, password, role }); // Pass role explicitly

    // Save the new user to the database
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Generate a refresh token
    const refreshToken = jwt.sign(
      { id: newUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // Save the refresh token in the user's document (optional but recommended)
    newUser.refreshToken = refreshToken;
    await newUser.save();

    // Set the refresh token in a secure, HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // Send the user data, access token, and refresh token in the response
    res.status(201).json({
      user: { name, email, role: newUser.role }, // Include the role here
      token,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Signup failed', error });
  }
});


// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    // Generate a refresh token (longer expiry, e.g., 7 days)
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET, // Ensure this secret is in .env
      { expiresIn: '7d' }
    );

    // Save the refresh token in the user's document (optional but recommended)
    user.refreshToken = refreshToken;
    await user.save();

    // Set the refresh token in a secure, HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // Prevents JavaScript access to the cookie
      secure: process.env.NODE_ENV === 'production', // Ensure it's secure in production only
      sameSite: 'strict', // Helps mitigate CSRF attacks
    });

    res.json({
      user: { name: user.name, email: user.email, role: user.role }, // Include role in response
      token,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error });
  }
});

// USER PROFILE
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user profile', error });
  }
});


router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Find the user by the decoded ID
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Issue a new access token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Respond with the new access token
    res.json({ token });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Get all users with formatted createdAt date
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude password field
    const formattedUsers = users.map(user => ({
      ...user.toObject(),
      formattedCreatedAt: new Date(user.createdAt).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }));
    res.json(formattedUsers); // Send formatted users data
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error });
  }
});



export default router;
