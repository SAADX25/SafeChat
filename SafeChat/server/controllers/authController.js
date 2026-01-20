const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const SECRET_KEY = 'super_secret_key_change_this'; // في الإنتاج يوضع في .env

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // التحقق من صحة البيانات
    if (!username || !password) {
      return res.status(400).json({ message: 'البيانات ناقصة' });
    }

    const existingUser = db.users.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'اسم المستخدم مستخدم بالفعل' });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = db.users.create({
      username,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${username}`, // صورة رمزية Cyberpunk
      theme: 'neon', // الثيم الافتراضي
      status: 'online'
    });

    const token = jwt.sign({ id: newUser._id }, SECRET_KEY);
    
    const { password: _, ...userWithoutPass } = newUser;
    res.json({ user: userWithoutPass, token });
    
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.users.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ id: user._id }, SECRET_KEY);
    const { password: _, ...userWithoutPass } = user;
    
    res.json({ user: userWithoutPass, token });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.getMe = (req, res) => {
  // المستخدم يأتي من الـ Middleware
  res.json(req.user);
};

exports.updateProfile = (req, res) => {
  try {
    const { username, color, isDiamond, avatar } = req.body;
    const userId = req.user._id;

    const updates = {};
    if (username) updates.username = username;
    if (color) updates.color = color;
    if (isDiamond !== undefined) updates.isDiamond = isDiamond;
    if (avatar) updates.avatar = avatar;

    const updatedUser = db.users.update(userId, updates);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password, ...userWithoutPass } = updatedUser;
    res.json(userWithoutPass);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
};