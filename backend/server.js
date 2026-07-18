import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, User, Task } from './db.js';
import { hashPassword, comparePassword, generateToken, authenticateToken } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend build
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Validation helpers
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ---------------- USER REGISTRATION ----------------
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required fields.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password & save user
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash
    });

    // Generate token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      message: 'User registered successfully!',
      token,
      user: { id: user._id.toString(), email: user.email }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---------------- USER LOGIN ----------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required fields.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user._id.toString());

    res.status(200).json({
      message: 'Logged in successfully!',
      token,
      user: { id: user._id.toString(), email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---------------- TASK GET (READ ALL) ----------------
app.get('/tasks', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { search, status, priority, sortBy } = req.query;

  const queryObj = { user_id: userId };

  // Search filter
  if (search) {
    queryObj.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Status filter
  if (status && status !== 'All') {
    queryObj.status = status;
  }

  // Priority filter
  if (priority && priority !== 'All') {
    queryObj.priority = priority;
  }

  try {
    let tasksQuery = Task.find(queryObj);

    // Apply database sorting
    if (sortBy === 'due_date_asc') {
      tasksQuery = tasksQuery.sort({ due_date: 1 });
    } else if (sortBy === 'due_date_desc') {
      tasksQuery = tasksQuery.sort({ due_date: -1 });
    } else if (sortBy === 'priority_high_first') {
      // Handled in memory JS sorting
    } else {
      tasksQuery = tasksQuery.sort({ created_at: -1 });
    }

    const tasks = await tasksQuery.exec();

    // Custom priority sort in JS if requested
    if (sortBy === 'priority_high_first') {
      const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
      tasks.sort((a, b) => {
        const orderA = priorityOrder[a.priority] || 2;
        const orderB = priorityOrder[b.priority] || 2;
        return orderA - orderB;
      });
    }

    res.status(200).json(tasks);
  } catch (err) {
    console.error('Fetch tasks error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve tasks.' });
  }
});

// ---------------- TASK POST (CREATE) ----------------
app.post('/tasks', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { title, description, due_date, priority } = req.body;

  if (!title || !due_date) {
    return res.status(400).json({ error: 'Title and due date are required.' });
  }

  const validPriorities = ['High', 'Medium', 'Low'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'Medium';

  try {
    const newTask = await Task.create({
      user_id: userId,
      title,
      description: description || '',
      due_date,
      priority: taskPriority,
      status: 'Pending'
    });

    res.status(201).json(newTask);
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// ---------------- TASK PUT (UPDATE) ----------------
app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const taskId = req.params.id;
  const { title, description, due_date, priority, status } = req.body;

  try {
    // Check ownership first
    const task = await Task.findOne({ _id: taskId, user_id: userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    const updatedTitle = title !== undefined ? title : task.title;
    const updatedDesc = description !== undefined ? description : task.description;
    const updatedDueDate = due_date !== undefined ? due_date : task.due_date;
    const updatedPriority = priority !== undefined ? priority : task.priority;
    const updatedStatus = status !== undefined ? status : task.status;

    // Validations
    if (!updatedTitle) {
      return res.status(400).json({ error: 'Title cannot be empty.' });
    }
    if (!['Pending', 'Completed'].includes(updatedStatus)) {
      return res.status(400).json({ error: 'Invalid task status. Must be "Pending" or "Completed".' });
    }
    if (!['High', 'Medium', 'Low'].includes(updatedPriority)) {
      return res.status(400).json({ error: 'Invalid task priority. Must be "High", "Medium", or "Low".' });
    }

    task.title = updatedTitle;
    task.description = updatedDesc;
    task.due_date = updatedDueDate;
    task.priority = updatedPriority;
    task.status = updatedStatus;

    await task.save();
    res.status(200).json(task);
  } catch (err) {
    console.error('Update task error:', err.message);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// ---------------- TASK DELETE ----------------
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const taskId = req.params.id;

  try {
    // Check ownership first and delete
    const task = await Task.findOneAndDelete({ _id: taskId, user_id: userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    res.status(200).json({ message: 'Task deleted successfully.', id: taskId });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// Fallback for SPA client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.resolve(frontendDistPath, 'index.html'));
});

// Start database connection first, then start Express server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
};

startServer();
