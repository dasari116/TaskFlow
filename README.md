# TaskFlow - Full-Stack Task Management Web Application

TaskFlow is a premium, modern task management web application designed for high productivity. Built with a responsive, glassmorphic layout, it features real-time search, robust priority-based sorting, category-wise filtering, user authentication via JWT, and light/dark theme support.

---

## Technical Stack

* **Frontend**: React, Vite, Vanilla CSS (Premium variables, glassmorphism, responsive grid, animations).
* **Backend**: Node.js, Express.
* **Database**: SQLite3 (Portable, self-contained, auto-initializing).
* **Authentication**: JSON Web Tokens (JWT).

---

## Project Structure

```text
├── backend/
│   ├── db.js             # SQLite database configuration & schema DDL
│   ├── auth.js           # JWT helpers & authentication middleware
│   ├── server.js         # Express routing and REST API endpoints
│   ├── package.json      # Backend configuration and dependencies
│   └── database.sqlite   # Dynamically created SQLite file
├── frontend/
│   ├── index.html        # Main HTML file with SEO metadata
│   ├── src/
│   │   ├── main.jsx      # React entry script
│   │   ├── App.jsx       # State management, filter configurations, theme sync
│   │   ├── index.css     # Premium styling system (CSS variables, animations)
│   │   └── components/
│   │       ├── Auth.jsx      # Login and registration card with validations
│   │       ├── Navbar.jsx    # Top header with user display and light/dark toggle
│   │       ├── TaskForm.jsx  # Creation and editing task form modal dialog
│   │       └── TaskList.jsx  # Grid layout card renderer with overdue validation
│   └── package.json      # Frontend Vite configuration
├── package.json          # Root scripts to orchestrate backend & frontend concurrently
└── README.md             # Project documentation
```

---

## Database Schema

TaskFlow uses two SQLite tables: `users` and `tasks` with foreign keys and cascade deletions.

```text
+-----------------------+              +-------------------------------------+
|        users          |              |                tasks                |
+-----------------------+              +-------------------------------------+
| id (PK) INTEGER       | <----+       | id (PK) INTEGER                     |
| email TEXT (UNIQUE)   |      |       | user_id (FK -> users.id) INTEGER    |
| password_hash TEXT    |      +------ | title TEXT                          |
| created_at DATETIME   |              | description TEXT                    |
+-----------------------+              | status TEXT ('Pending'/'Completed') |
                                       | priority TEXT ('High'/'Medium'/'Low')|
                                       | due_date TEXT                       |
                                       | created_at DATETIME                 |
                                       +-------------------------------------+
```

### Table Definitions

#### `users`
* `id` (INTEGER, Primary Key, Auto Increment)
* `email` (TEXT, Unique, Not Null) - User email for registration/login
* `password_hash` (TEXT, Not Null) - Bcrypt hashed password
* `created_at` (DATETIME) - Auto-timestamp when the record is created

#### `tasks`
* `id` (INTEGER, Primary Key, Auto Increment)
* `user_id` (INTEGER, Foreign Key referencing `users(id)` with `ON DELETE CASCADE`)
* `title` (TEXT, Not Null)
* `description` (TEXT)
* `status` (TEXT, Check constraints: `Pending`, `Completed`, Defaults to `Pending`)
* `priority` (TEXT, Check constraints: `High`, `Medium`, `Low`, Defaults to `Medium`)
* `due_date` (TEXT, Not Null) - Stored in `YYYY-MM-DD` text format
* `created_at` (DATETIME) - Auto-timestamp when the record is created

---

## REST API Documentation

All API endpoints return JSON payloads. Authentication is performed using standard JWT authorization headers: `Authorization: Bearer <token>`.

### Authentication Endpoints

#### 1. Register User
* **Method & URL**: `POST /register`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
* **Validation**: Email must be a valid structure and unique in the database. Password must be at least 6 characters long.
* **Success Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully!",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 1,
      "email": "user@example.com"
    }
  }
  ```

#### 2. User Login
* **Method & URL**: `POST /login`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Logged in successfully!",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 1,
      "email": "user@example.com"
    }
  }
  ```

---

### Task Endpoints (Protected by JWT)

Require Header: `Authorization: Bearer <JWT_TOKEN>`

#### 3. Get Tasks
* **Method & URL**: `GET /tasks`
* **Query Parameters (Optional)**:
  * `search`: Filters tasks by search query matching title or description (e.g. `?search=proposal`).
  * `status`: Filters by status (`Pending` or `Completed`).
  * `priority`: Filters by task priority (`High`, `Medium`, or `Low`).
  * `sortBy`: Sorts tasks (`created_at_desc`, `due_date_asc`, `due_date_desc`, `priority_high_first`).
* **Success Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "user_id": 1,
      "title": "Complete project proposal",
      "description": "Finish the design sections.",
      "status": "Pending",
      "priority": "High",
      "due_date": "2026-07-20",
      "created_at": "2026-07-16 16:10:00"
    }
  ]
  ```

#### 4. Create Task
* **Method & URL**: `POST /tasks`
* **Request Body**:
  ```json
  {
    "title": "Write unit tests",
    "description": "Verify user authentication endpoints.",
    "due_date": "2026-07-18",
    "priority": "Medium"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "id": 2,
    "user_id": 1,
    "title": "Write unit tests",
    "description": "Verify user authentication endpoints.",
    "status": "Pending",
    "priority": "Medium",
    "due_date": "2026-07-18",
    "created_at": "2026-07-16 16:15:00"
  }
  ```

#### 5. Update Task
* **Method & URL**: `PUT /tasks/:id`
* **Request Body**: (all fields are optional, provide only fields to update)
  ```json
  {
    "title": "Updated Task Title",
    "status": "Completed"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "id": 2,
    "user_id": 1,
    "title": "Updated Task Title",
    "description": "Verify user authentication endpoints.",
    "status": "Completed",
    "priority": "Medium",
    "due_date": "2026-07-18",
    "created_at": "2026-07-16 16:15:00"
  }
  ```

#### 6. Delete Task
* **Method & URL**: `DELETE /tasks/:id`
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Task deleted successfully.",
    "id": "2"
  }
  ```

---

## Installation & Running Guide

Ensure Node.js (version 18+) is installed on your local machine.

### 1. Install Dependencies
Run the installation command in the root folder. This helper script downloads dependencies for the root orchestrator, frontend, and backend folders.
```bash
npm run install-all
```

### 2. Start Application in Development Mode
Execute the dev orchestrator script. This starts both the Express server (port 5000) and Vite development client (port 5173) concurrently.
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser to view the application.

---

## Features Showcase
* **Responsive Layout**: Fluid grid adapting seamlessly to Mobile, Tablet, and Desktop screens.
* **Overdue Warnings**: Displays calendar icons and indicator warnings on overdue and pending items.
* **Theme Switching**: Supports standard dark/light themes synced to browser storage.
* **Live Search**: Filters and searches tasks instantly as you type.
* **Priority Sorting**: Bubble High priority items to the top to streamline work.
