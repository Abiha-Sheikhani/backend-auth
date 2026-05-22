const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment cannot be empty'],
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    excerpt: {
      type: String,
      maxlength: [300, 'Excerpt cannot exceed 300 characters'],
    },
    coverImage: {
      type: String,
      default: '',
    },
    coverImagePublicId: {
      type: String,
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['Technology', 'Lifestyle', 'Travel', 'Food', 'Health', 'Business', 'Entertainment', 'Other'],
      default: 'Other',
    },
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [commentSchema],
    views: {
      type: Number,
      default: 0,
    },
    published: {
      type: Boolean,
      default: true,
    },
    slug: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// Auto-generate slug before saving
postSchema.pre('save', function (next) {
  if (this.isModified('title') || this.isNew) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') +
      '-' +
      Date.now();
  }
  // Auto-generate excerpt from content
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.replace(/(<([^>]+)>)/gi, '').substring(0, 250) + '...';
  }
  next();
});

// Index for search
postSchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('Post', postSchema);
