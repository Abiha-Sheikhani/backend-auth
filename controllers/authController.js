const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cloudinary, upload } = require('../config/cloudinary');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// @POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.email === email ? 'Email already in use.' : 'Username already taken.',
      });
    }

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        savedPosts: user.savedPosts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id).populate('savedPosts', 'title slug coverImage createdAt');
  res.json({ success: true, user });
};

// @PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { username, bio } = req.body;
    const updateData = {};

    if (username) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;

    if (req.file) {
      // Delete old avatar from Cloudinary
      if (req.user.avatarPublicId) {
        await cloudinary.uploader.destroy(req.user.avatarPublicId);
      }
      updateData.avatar = req.file.path;
      updateData.avatarPublicId = req.file.filename;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Profile updated!', user });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };
