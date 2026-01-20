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

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', ({ userId, channelId }) => {
    const user = db.users.findOne({ _id: userId });
    if (user) {
      socket.user = user;
      // Leave previous rooms
      socket.rooms.forEach(room => {
        if (room !== socket.id) socket.leave(room);
      });
      
      if (channelId) {
        socket.join(channelId);
        // Optional: Notify room
        // io.to(channelId).emit('system_message', { ... });
      }
    }
  });

  socket.on('send_message', (data) => {
    if (!socket.user) {
      console.log('send_message failed: No user attached to socket', socket.id);
      return;
    }

    // الحصول على أحدث بيانات المستخدم (بما في ذلك اللون)
    const currentUser = db.users.findOne({ _id: socket.user._id });

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
      type: data.type || 'text',
      reactions: {}
    });

    io.to(data.channelId).emit('receive_message', message);
  });


  socket.on('delete_message', (msgId) => {
    const msg = db.messages.findOne({ _id: msgId });
    if (msg && socket.user && (socket.user._id === msg.userId)) {
      db.messages.delete(msgId);
      io.to(msg.channelId).emit('message_deleted', msgId);
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

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});