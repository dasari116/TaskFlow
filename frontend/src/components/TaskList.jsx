import React from 'react';
import { Calendar, Edit3, Trash2, CheckCircle2, Circle, Inbox } from 'lucide-react';

export default function TaskList({ tasks, onEdit, onDelete, onToggleStatus }) {
  const today = new Date().toISOString().split('T')[0];

  if (tasks.length === 0) {
    return (
      <div className="empty-state glass">
        <div className="empty-state-icon">
          <Inbox size={48} />
        </div>
        <h3 className="empty-state-title">No tasks found</h3>
        <p className="empty-state-desc">
          Try refining your search/filters or create a new task to get started!
        </p>
      </div>
    );
  }

  // Priority color helper
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'var(--color-high)';
      case 'Medium': return 'var(--color-medium)';
      case 'Low': return 'var(--color-low)';
      default: return 'var(--color-medium)';
    }
  };

  return (
    <div className="tasks-grid">
      {tasks.map((task) => {
        const isCompleted = task.status === 'Completed';
        const isOverdue = !isCompleted && task.due_date < today;
        const priorityColor = getPriorityColor(task.priority);

        return (
          <div 
            key={task.id} 
            className="task-card glass"
            style={{ '--task-priority-color': priorityColor }}
          >
            <div>
              <div className="task-card-header">
                <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
                
                <button
                  onClick={() => onToggleStatus(task)}
                  className="btn btn-secondary btn-icon"
                  style={{ 
                    border: 'none', 
                    background: 'none', 
                    color: isCompleted ? 'var(--color-success)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    width: 'auto',
                    height: 'auto'
                  }}
                  title={isCompleted ? "Mark as Pending" : "Mark as Completed"}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={22} fill="var(--color-success-bg)" />
                  ) : (
                    <Circle size={22} />
                  )}
                </button>
              </div>

              <h3 className={`task-title ${isCompleted ? 'completed' : ''}`} style={{ marginTop: '0.75rem' }}>
                {task.title}
              </h3>

              <p className={`task-description ${isCompleted ? 'completed' : ''}`} style={{ marginTop: '0.5rem' }}>
                {task.description || 'No description provided.'}
              </p>
            </div>

            <div className="task-footer">
              <div className={`task-due ${isOverdue ? 'overdue' : ''}`}>
                <Calendar size={14} />
                <span>
                  {task.due_date} {isOverdue && '(Overdue)'}
                </span>
              </div>

              <div className="task-actions">
                <button
                  onClick={() => onEdit(task)}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '2rem', height: '2rem', borderRadius: '8px' }}
                  title="Edit Task"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => onDelete(task.id)}
                  className="btn btn-danger btn-icon"
                  style={{ width: '2rem', height: '2rem', borderRadius: '8px' }}
                  title="Delete Task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
