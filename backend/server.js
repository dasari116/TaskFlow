import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { run, query, queryOne } from './db.js';
import { hashPassword, comparePassword, generateToken, authenticateToken } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password & save user
    const passwordHash = await hashPassword(password);
    const result = await run(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email.toLowerCase().trim(), passwordHash]
    );

    // Generate token
    const token = generateToken(result.id);

    res.status(201).json({
      message: 'User registered successfully!',
      token,
      user: { id: result.id, email: email.toLowerCase().trim() }
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
    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user.id);

    res.status(200).json({
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, email: user.email }
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

  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [userId];

  // Search filter
  if (search) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Status filter
  if (status && status !== 'All') {
    sql += ' AND status = ?';
    params.push(status);
  }

  // Priority filter
  if (priority && priority !== 'All') {
    sql += ' AND priority = ?';
    params.push(priority);
  }

  // Sorting
  if (sortBy === 'due_date_asc') {
    sql += ' ORDER BY due_date ASC';
  } else if (sortBy === 'due_date_desc') {
    sql += ' ORDER BY due_date DESC';
  } else if (sortBy === 'priority_high_first') {
    sql += ` ORDER BY 
      CASE priority 
        WHEN 'High' THEN 1 
        WHEN 'Medium' THEN 2 
        WHEN 'Low' THEN 3 
      END ASC`;
  } else {
    sql += ' ORDER BY created_at DESC'; // default sort
  }

  try {
    const tasks = await query(sql, params);
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
    const result = await run(
      'INSERT INTO tasks (user_id, title, description, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, description || '', due_date, taskPriority, 'Pending']
    );

    const newTask = await queryOne('SELECT * FROM tasks WHERE id = ?', [result.id]);
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
    const task = await queryOne('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
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

    await run(
      'UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, status = ? WHERE id = ?',
      [updatedTitle, updatedDesc, updatedDueDate, updatedPriority, updatedStatus, taskId]
    );

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.status(200).json(updatedTask);
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
    // Check ownership first
    const task = await queryOne('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    await run('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.status(200).json({ message: 'Task deleted successfully.', id: taskId });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
