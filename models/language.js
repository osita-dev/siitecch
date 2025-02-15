import mongoose from 'mongoose';

const exampleSchema = new mongoose.Schema({
    description: String,
});

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    content: String,
    examples: [exampleSchema],
    video_link: String,
});

const languageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    categories: [categorySchema],
});

const Language = mongoose.model('Language', languageSchema);

export default Language;
