const mongoose = require('mongoose');

const homeSchema = new mongoose.Schema({
    home_id: {
        type: Number,
        required: true,
        unique: true
    },
    customer_name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    set_top_box_id: {
        type: String,
        required: true
    },
    monthly_amount: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Home', homeSchema);
