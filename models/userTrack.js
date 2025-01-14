import mongoose from 'mongoose';

const userTrackSchema = new mongoose.Schema({
    date: { type: String, required: true },
    views: { type: Number, required: true },
    week: { type: String, required: true },
    month: { type: String, required: true },
    year: { type: String, required: true },
});

const UserTrack = mongoose.model('UserTrack', userTrackSchema);

export default UserTrack;