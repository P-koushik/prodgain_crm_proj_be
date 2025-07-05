import Contact from '../models/ContactModel.js';
import Tag from '../models/tagModel.js';
import Activity from '../models/activityModel.js';

export const search = async (req, res) => {
    const { q } = req.query;
    console.log("Search query:", q);
    if (!q || q.trim() === "") {
        return res.json({ contacts: [], tags: [], activities: [] });
    }
    const regex = new RegExp(q, 'i');

    try {
        const [contacts, tags, activities] = await Promise.all([
            Contact.find({
                $or: [
                    { name: regex },
                    { email: regex }
                ]
            }).limit(5),
            Tag.find({ name: regex }).limit(5),
            Activity.find({ title: regex }).limit(5),
        ]);

        res.json({ contacts, tags, activities });
    } catch (err) {
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
}