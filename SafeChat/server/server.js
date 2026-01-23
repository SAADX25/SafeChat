const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const authController = require('./controllers/authController');
const authMiddleware = require('./middleware/auth');
const db = require('./db/database');

const app = express();
const server = http.createServer(app);

// تأكد من وجود مجلد uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR) },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage: storage });

// Routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authMiddleware, authController.getMe);
app.post('/api/user/update', authMiddleware, authController.updateProfile);
app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.users.read().map(u => {
    const { password, ...userWithoutPass } = u;
    return userWithoutPass;
  });
  res.json(users);
});

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, name: req.file.originalname, type: req.file.mimetype.startsWith('image') ? 'image' : 'file' });
});

// Channels
app.get('/api/channels', authMiddleware, (req, res) => {
  const channels = db.channels.read();
  // Ensure default channel exists
  if (channels.length === 0) {
    db.channels.create({ name: 'general', type: 'text' });
    return res.json(db.channels.read());
  }
  res.json(channels);
});

app.post('/api/channels', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Channel name is required' });
  
  const existing = db.channels.findOne({ name });
  if (existing) return res.status(400).json({ message: 'Channel already exists' });

  const channel = db.channels.create({ 
    name, 
    type: 'text', 
    createdBy: req.user._id 
  });
  
  io.emit('channel_created', channel);
  res.json(channel);
});

app.delete('/api/channels/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const channel = db.channels.findOne({ _id: id });
  
  if (!channel) return res.status(404).json({ message: 'Channel not found' });
  
  // Allow only creator or maybe anyone for now based on user request "delete button"
  // For now, let's assume if you have the ID you can delete it, or strictly match creator
  // But typically "creator" field is there. Let's check ownership.
  // Actually user just said "add delete button", usually implies for everyone or admin. 
  // Let's allow it for everyone for simplicity as per "pair programming" persona unless specified.
  // Wait, better to be safe. Let's check if createdBy matches OR if it's not the 'general' channel?
  // The user didn't specify admin roles. Let's just allow deleting any channel except maybe "general" if we want to be safe, 
  // but the code above creates 'general' if empty. 
  
  if (channel.name === 'general') {
     return res.status(403).json({ message: 'Cannot delete general channel' });
  }

  db.channels.delete(id);
  io.emit('channel_deleted', id);
  res.json({ message: 'Channel deleted' });
});

// Chat History
app.get('/api/messages', authMiddleware, (req, res) => {
  const { channelId } = req.query;
  const allMessages = db.messages.read();
  // Filter by channelId if provided, otherwise default to 'general' or null
  const messages = channelId 
    ? allMessages.filter(m => m.channelId === channelId) 
    : []; // Don't return messages if no channel selected
    
  res.json(messages.slice(-50));
});

app.get('/api/search', authMiddleware, (req, res) => {
  const { q, channelId } = req.query;
  if (!q) return res.json([]);
  
  const allMessages = db.messages.read();
  const results = allMessages.filter(m => {
    const matchChannel = channelId ? m.channelId === channelId : true;
    const matchText = m.text && m.text.toLowerCase().includes(q.toLowerCase());
    return matchChannel && matchText;
  });
  
  res.json(results.slice(-20)); // Limit to 20 results
});

const presenceCounts = new Map();

function getOnlineUsersPublic() {
  const userIds = Array.from(presenceCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([userId]) => String(userId));

  return userIds
    .map(userId => {
      const user = db.users.findOne({ _id: userId });
      if (!user) return null;
      const { password, ...userWithoutPass } = user;
      return userWithoutPass;
    })
    .filter(Boolean);
}

// Helper for deduplication
function getUniqueUsers(sockets) {
  const users = sockets.map(s => s.data.user).filter(u => u);
  const unique = users.filter((user, index, self) =>
    index === self.findIndex((t) => (
      String(t._id) === String(user._id)
    ))
  );
  return unique;
}

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.emit('online_users', getOnlineUsersPublic());

  socket.on('join', async ({ userId, channelId }) => {
    const user = db.users.findOne({ _id: userId });
    if (user) {
      socket.data.user = user;

      const nextUserId = String(userId);
      const prevUserId = socket.data.userId ? String(socket.data.userId) : null;
      if (prevUserId !== nextUserId) {
        if (prevUserId) {
          const prevCount = (presenceCounts.get(prevUserId) || 0) - 1;
          if (prevCount <= 0) {
            presenceCounts.delete(prevUserId);
            db.users.update(prevUserId, { status: 'offline' });
          } else {
            presenceCounts.set(prevUserId, prevCount);
          }
        }

        const nextCount = (presenceCounts.get(nextUserId) || 0) + 1;
        presenceCounts.set(nextUserId, nextCount);
        socket.data.userId = nextUserId;
        if (nextCount === 1) {
          db.users.update(nextUserId, { status: 'online' });
        }

        io.emit('online_users', getOnlineUsersPublic());
      }

      socket.data.currentChannel = channelId;

      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room !== socket.id) {
          await socket.leave(room);
          const sockets = await io.in(room).fetchSockets();
          const uniqueUsers = getUniqueUsers(sockets);
          io.to(room).emit('room_users', uniqueUsers);
        }
      }

      if (channelId) {
        await socket.join(channelId);
        const sockets = await io.in(channelId).fetchSockets();
        const uniqueUsers = getUniqueUsers(sockets);
        io.to(channelId).emit('room_users', uniqueUsers);
      }
    }
  });

  socket.on('send_message', (data) => {
    if (!socket.data.user) {
      console.log('send_message failed: No user attached to socket', socket.id);
      return;
    }

    // الحصول على أحدث بيانات المستخدم (بما في ذلك اللون)
    const currentUser = db.users.findOne({ _id: socket.data.user._id });

    const message = db.messages.create({
      text: data.text,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      userId: currentUser._id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      channelId: data.channelId, // Save channel ID
      color: currentUser.color,
      isDiamond: currentUser.isDiamond,
      customGradient: currentUser.customGradient, // Save custom gradient
      type: data.type || 'text',
      replyTo: data.replyTo || null, // Save reply info
      reactions: {}
    });

    io.to(data.channelId).emit('receive_message', message);
  });


  socket.on('delete_message', (msgId) => {
    const msg = db.messages.findOne({ _id: msgId });
    if (msg && socket.data.user && (socket.data.user._id === msg.userId)) {
      db.messages.delete(msgId);
      io.to(msg.channelId).emit('message_deleted', msgId);
    }
  });

  socket.on('edit_message', ({ msgId, newText }) => {
    const msg = db.messages.findOne({ _id: msgId });
    if (msg && socket.data.user && (socket.data.user._id === msg.userId)) {
      db.messages.update(msgId, { text: newText, isEdited: true });
      const updatedMsg = db.messages.findOne({ _id: msgId });
      io.to(msg.channelId).emit('message_updated', updatedMsg);
    }
  });

  socket.on('add_reaction', ({ msgId, emoji }) => {
    const msg = db.messages.findOne({ _id: msgId });
    if (msg) {
      if (!msg.reactions) msg.reactions = {};
      msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
      db.messages.update(msgId, { reactions: msg.reactions });
      
      // إرسال الرسالة المحدثة بالكامل
      const updatedMsg = db.messages.findOne({ _id: msgId });
      io.to('general').emit('message_updated', updatedMsg);
    }
  });

  socket.on('typing', ({ channelId }) => {
    if (socket.data.user && channelId) {
      // Check if user is actually in the room
      if (socket.rooms.has(channelId)) {
         socket.to(channelId).emit('user_typing', { username: socket.data.user.username, channelId });
      }
    }
  });

  socket.on('stop_typing', ({ channelId }) => {
    if (socket.data.user && channelId) {
       if (socket.rooms.has(channelId)) {
        socket.to(channelId).emit('user_stop_typing', { username: socket.data.user.username, channelId });
       }
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected');
    if (socket.data.userId) {
      const id = String(socket.data.userId);
      const nextCount = (presenceCounts.get(id) || 0) - 1;
      if (nextCount <= 0) {
        presenceCounts.delete(id);
        db.users.update(id, { status: 'offline' });
      } else {
        presenceCounts.set(id, nextCount);
      }
      io.emit('online_users', getOnlineUsersPublic());
    }
    if (socket.data.currentChannel) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const sockets = await io.in(socket.data.currentChannel).fetchSockets();
      const uniqueUsers = getUniqueUsers(sockets);
      io.to(socket.data.currentChannel).emit('room_users', uniqueUsers);
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
