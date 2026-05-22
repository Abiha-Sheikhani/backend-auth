const Post = require('../models/Post');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

// @GET /api/posts
const getPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    const { category, tag, search, author } = req.query;

    const query = { published: true };
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (author) query.author = author;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-comments'),
      Post.countDocuments(query),
    ]);

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/posts/:slug
const getPost = async (req, res, next) => {
  try {
    const post = await Post.findOneAndUpdate(
      { slug: req.params.slug, published: true },
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate('author', 'username avatar bio')
      .populate('comments.user', 'username avatar');

    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    // Check if current user has liked the post
    const isLiked = req.user ? post.likes.includes(req.user._id) : false;
    const isSaved = req.user
      ? (await User.findById(req.user._id))?.savedPosts?.includes(post._id)
      : false;

    res.json({ success: true, post, isLiked, isSaved });
  } catch (error) {
    next(error);
  }
};

// @POST /api/posts
const createPost = async (req, res, next) => {
  try {
    const { title, content, category, tags, published } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const postData = {
      title,
      content,
      category: category || 'Other',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
      author: req.user._id,
      published: published !== undefined ? published : true,
    };

    if (req.file) {
      postData.coverImage = req.file.path;
      postData.coverImagePublicId = req.file.filename;
    }

    const post = await Post.create(postData);
    await post.populate('author', 'username avatar');

    res.status(201).json({ success: true, message: 'Post created!', post });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/posts/:id
const updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this post.' });
    }

    const { title, content, category, tags, published } = req.body;
    if (title) post.title = title;
    if (content) post.content = content;
    if (category) post.category = category;
    if (tags) post.tags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
    if (published !== undefined) post.published = published;

    if (req.file) {
      if (post.coverImagePublicId) {
        await cloudinary.uploader.destroy(post.coverImagePublicId);
      }
      post.coverImage = req.file.path;
      post.coverImagePublicId = req.file.filename;
    }

    await post.save();
    await post.populate('author', 'username avatar');

    res.json({ success: true, message: 'Post updated!', post });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/posts/:id
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (post.coverImagePublicId) {
      await cloudinary.uploader.destroy(post.coverImagePublicId);
    }

    await post.deleteOne();
    res.json({ success: true, message: 'Post deleted.' });
  } catch (error) {
    next(error);
  }
};

// @POST /api/posts/:id/like
const toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const userId = req.user._id;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }
    await post.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/posts/:id/comments
const addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    post.comments.push({ user: req.user._id, content });
    await post.save();
    await post.populate('comments.user', 'username avatar');

    const newComment = post.comments[post.comments.length - 1];
    res.status(201).json({ success: true, comment: newComment });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/posts/:id/comments/:commentId
const deleteComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found.' });

    if (
      comment.user.toString() !== req.user._id.toString() &&
      post.author.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    comment.deleteOne();
    await post.save();
    res.json({ success: true, message: 'Comment deleted.' });
  } catch (error) {
    next(error);
  }
};

// @POST /api/posts/:id/save
const toggleSave = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const user = await User.findById(req.user._id);
    const alreadySaved = user.savedPosts.includes(post._id);

    if (alreadySaved) {
      user.savedPosts.pull(post._id);
    } else {
      user.savedPosts.push(post._id);
    }
    await user.save();

    res.json({ success: true, saved: !alreadySaved });
  } catch (error) {
    next(error);
  }
};

// @GET /api/posts/user/:userId
const getUserPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ author: req.params.userId, published: true })
        .populate('author', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-comments'),
      Post.countDocuments({ author: req.params.userId, published: true }),
    ]);

    res.json({
      success: true,
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/posts/my/posts
const getMyPosts = async (req, res, next) => {
  try {
    const posts = await Post.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .select('-comments');
    res.json({ success: true, posts });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPosts, getPost, createPost, updatePost, deletePost,
  toggleLike, addComment, deleteComment, toggleSave,
  getUserPosts, getMyPosts,
};
