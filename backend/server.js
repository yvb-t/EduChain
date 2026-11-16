const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const scholarshipRoutes = require('./routes/scholarshipRoutes');
const donationRoutes = require('./routes/donationRoutes');
const collegeRoutes = require('./routes/collegeRoutes');
const chatRoutes = require('./routes/chatRoutes');
const kycRoutes = require('./routes/kycRoutes');
const proofRoutes = require('./routes/proofRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const ngoRoutes = require('./routes/ngoRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/college', collegeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/proof', proofRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/verification', require('./routes/verificationRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    // Emit viewer count update (mocked)
    io.to(roomId).emit('room_update', { viewers: Math.floor(Math.random() * 10) + 1 });
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on('send_message', (data) => {
    // Broadcast to others in the room
    socket.to(data.room).emit('new_message', { user: 'Anonymous', text: data.message });
  });

  socket.on('process_donation', (data) => {
    // In real app, verify payment here
    // Broadcast donation to room
    io.to(data.room).emit('new_donation', {
      donorName: data.donorName,
      amount: data.amount,
      message: data.message,
      timestamp: Date.now()
    });

    // Also emit to global live wall
    io.emit('global_donation', {
      donorName: data.donorName,
      amount: data.amount,
      studentName: "Student", // Would fetch real name
      timestamp: Date.now()
    });
  });

  socket.on('start_sprint', (data) => {
    const { room, duration } = data; // duration in minutes
    const endTime = Date.now() + duration * 60 * 1000;

    io.to(room).emit('sprint_started', {
      endTime,
      target: 5000 // Mock target for sprint
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
