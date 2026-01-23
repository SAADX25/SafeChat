const bcrypt = require('bcryptjs');
const db = require('./db/database.js');
const path = require('path');
const fs = require('fs');

// Ensure database uses absolute path logic similar to server.js if needed, 
// but require('./server/db/database.js') should work if run from project root.

async function createAdmin() {
  const username = 'SAADX';
  const password = 'saad20022';
  
  // Check if user exists
  const existingUser = db.users.findOne({ username });
  if (existingUser) {
    console.log('User SAADX already exists. Updating to Admin...');
    db.users.update(existingUser._id, { 
      isAdmin: true,
      isDiamond: true,
      customGradient: ['#ff0000', '#00ff00', '#0000ff'] // Default custom gradient
    });
    console.log('Updated SAADX to Admin.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.users.create({
    username,
    email: 'admin@safechat.com',
    password: hashedPassword,
    avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${username}`,
    theme: 'neon',
    status: 'online',
    isAdmin: true,
    isDiamond: true,
    customGradient: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8f00ff']
  });

  console.log('Admin user SAADX created successfully.');
}

createAdmin();
