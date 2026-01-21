const jwt = require('jsonwebtoken');
const db = require('../db/database.js');

const SECRET_KEY = 'super_secret_key_change_this';

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'لا يوجد تصريح دخول' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = db.users.findOne({ _id: decoded.id });

    if (!user) {
      throw new Error();
    }

    const { password, ...userWithoutPass } = user;
    req.user = userWithoutPass;
    next();
  } catch (err) {
    res.status(401).json({ message: 'التوكن غير صالح' });
  }
};