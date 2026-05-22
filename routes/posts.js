const express = require('express');
const router = express.Router();
const {
  getPosts, getPost, createPost, updatePost, deletePost,
  toggleLike, addComment, deleteComment, toggleSave,
  getUserPosts, getMyPosts,
} = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.get('/', getPosts);
router.get('/my/posts', protect, getMyPosts);
router.get('/user/:userId', getUserPosts);
router.get('/:slug', optionalAuth, getPost);

router.post('/', protect, upload.single('coverImage'), createPost);
router.put('/:id', protect, upload.single('coverImage'), updatePost);
router.delete('/:id', protect, deletePost);

router.post('/:id/like', protect, toggleLike);
router.post('/:id/save', protect, toggleSave);
router.post('/:id/comments', protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);

module.exports = router;
