import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Create a custom format function for the date
const formatDate = (date) => {
  const options = { 
    weekday: 'long',    // Full weekday name (e.g., "Monday")
    year: 'numeric',    // Full year (e.g., "2025")
    month: 'long',      // Full month name (e.g., "January")
    day: '2-digit',     // 2-digit day (e.g., "01")
  };
  const formattedDate = new Date(date).toLocaleDateString('en-US', options);
  
  // Return the date in the desired format (e.g., "06 Monday, January 01/2025 year")
  return `${formattedDate.split(',')[0]} ${formattedDate.split(',')[1]} ${formattedDate.split(',')[2]}`;
};

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student'], default: 'student' },
    resetToken: String,
    resetTokenExpiry: Date,
    refreshToken: String,
  },
  {
    timestamps: true, // Automatically add `createdAt` and `updatedAt` fields
  }
);

// Virtual to format the createdAt date
UserSchema.virtual('formattedCreatedAt').get(function () {
  return formatDate(this.createdAt);
});

// Pre-save hook to hash the password
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Create the model
const User = mongoose.model('User', UserSchema);
export default User;
