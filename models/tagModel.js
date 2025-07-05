import mongoose from 'mongoose';

const schema = mongoose.Schema;
const ObjectId = schema.Types.ObjectId


const tagSchema = new schema({
    name: {
        type: String,
        required: true
    },
    color: {
        type: String,
        default: '#3b82f6',
        required: true
    },
    user: {
        type: String,
        uid: ObjectId,
        ref: "User",
        required: true
    }
});

const Tag = mongoose.models.Tag || mongoose.model("Tag", tagSchema);
export default Tag;