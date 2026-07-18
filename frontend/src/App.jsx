import React, { useState, useEffect, useCallback } from 'react';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import TaskList from './components/TaskList';
import TaskForm from './components/TaskForm';
import { Search, Plus, ListFilter, SlidersHorizontal, Loader2 } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  
  // Filtering & Sorting State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState('created_at_desc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Sync Theme with DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Auth Handlers
  const handleAuthSuccess = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setTasks([]);
  };

  // Fetch Tasks
  const fetchTasks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.append('search', search.trim());
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (priorityFilter !== 'All') queryParams.append('priority', priorityFilter);
      queryParams.append('sortBy', sortBy);

      const response = await fetch(`/tasks?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, priorityFilter, sortBy]);

  // Debounced/Triggered task fetching when filters change
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchTasks();
    }, 300); // 300ms debounce on search/filter changes

    return () => clearTimeout(delayDebounce);
  }, [fetchTasks]);

  // Toggle status (Pending <-> Completed)
  const handleToggleStatus = async (task) => {
    try {
      const newStatus = task.status === 'Pending' ? 'Completed' : 'Pending';
      const response = await fetch(`/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updated = await response.json();
        // Optimistically update list in state
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      }
    } catch (err) {
      console.error('Error toggling task status:', err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Edit Button Action
  const handleEditClick = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // Save/Create complete handler
  const handleSaveComplete = () => {
    fetchTasks();
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-container">
      <Navbar 
        email={user?.email} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        onLogout={handleLogout} 
      />

      {/* Toolbar / Search & Filters */}
      <div className="toolbar glass">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListFilter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-input filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <select
            className="form-input filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-input filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created_at_desc">Newest First</option>
              <option value="due_date_asc">Due Date (Asc)</option>
              <option value="due_date_desc">Due Date (Desc)</option>
              <option value="priority_high_first">Priority: High First</option>
            </select>
          </div>

          <button 
            onClick={() => {
              setEditingTask(null);
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ padding: '0.7rem 1.25rem' }}
          >
            <Plus size={18} />
            Add Task
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && tasks.length === 0 ? (
        <div className="loading-container glass">
          <Loader2 className="spinner" style={{ width: '2.5rem', height: '2.5rem' }} />
          <p className="loading-text">Retrieving tasks...</p>
        </div>
      ) : (
        <TaskList 
          tasks={tasks} 
          onEdit={handleEditClick} 
          onDelete={handleDeleteTask} 
          onToggleStatus={handleToggleStatus} 
        />
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <TaskForm 
          task={editingTask} 
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }} 
          onSave={handleSaveComplete} 
        />
      )}
    </div>
  );
}
