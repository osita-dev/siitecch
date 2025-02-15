import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import db from '../config/db.js'; // Ensure this path is correct
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CLIENT_CALLBACK,
      scope: ['profile', 'email'],
      accessType: 'offline', // Request refresh token
      prompt: 'consent',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Validate profile.emails
        if (!profile.emails || !profile.emails[0]) {
          return done(new Error('No email found in the Google profile'), null);
        }

        console.log('Access Token:', accessToken);
        console.log('Refresh Token:', refreshToken); // Fixed the typo
        console.log('User Profile:', profile);

        const email = profile.emails[0].value;

        // Check if the user exists in the database
        const [user] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (!user || user.length === 0) {
          // Create a new user
          const newUser = {
            name: profile.displayName,
            email,
            google_id: profile.id,
          };

          const result = await db.execute(
            'INSERT INTO users (name, email, google_id) VALUES (?, ?, ?)',
            [newUser.name, newUser.email, newUser.google_id]
          );

          newUser.id = result[0].insertId;
          console.log('New user created:', newUser); // Debugging log

          // Generate a JWT for the new user
          const token = jwt.sign(
            { id: newUser.id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Adjust expiration as needed
          );

          return done(null, { ...newUser, token });
        }

        // If user exists
        console.log('Existing user found:', user[0]); // Debugging log

        // Generate a JWT for the existing user
        const token = jwt.sign(
          { id: user[0].id, email: user[0].email },
          process.env.JWT_SECRET,
          { expiresIn: '1h' } // Adjust expiration as needed
        );

        return done(null, { ...user[0], token });
      } catch (err) {
        console.error('Google OAuth Error during verification:', err.message);
        return done(new Error('Authentication failed: ' + err.message), null);
      }
    }
  )
);

// Serializing and Deserializing User
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [user] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (!user || user.length === 0) {
      return done(new Error('User not found during deserialization'), null);
    }
    done(null, user[0]);
  } catch (err) {
    console.error('Error during deserialization:', err.message);
    done(err, null);
  }
});

export default passport;
