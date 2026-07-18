import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5055; // Use a separate port for testing to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;

console.log('--- Starting Backend Automated Tests ---');

// Spawn server process with dynamic port
const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: PORT.toString() }
});

let serverOutput = '';
serverProcess.stdout.on('data', (data) => {
  serverOutput += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server Stderr:', data.toString());
});

// Wait for server to start
await new Promise((resolve) => {
  const interval = setInterval(() => {
    if (serverOutput.includes('Express server running')) {
      clearInterval(interval);
      resolve();
    }
  }, 100);
});

console.log('Server started successfully on test port', PORT);

let testToken = '';
let testTaskId = null;
const testEmail = `test_${Date.now()}@example.com`;
const testPassword = 'securePassword123';

try {
  // Test 1: User Registration
  console.log('\n[Test 1] Registering a new user...');
  const regResponse = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  const regData = await regResponse.json();
  
  if (regResponse.status === 201 && regData.token) {
    console.log('✓ Success: Registration completed.');
    testToken = regData.token;
  } else {
    throw new Error(`Failed registration: ${JSON.stringify(regData)}`);
  }

  // Test 2: Validation of short password
  console.log('\n[Test 2] Testing password validation (< 6 chars)...');
  const valResponse = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `error_${Date.now()}@example.com`, password: '123' })
  });
  const valData = await valResponse.json();
  if (valResponse.status === 400 && valData.error.includes('at least 6 characters')) {
    console.log('✓ Success: Correctly rejected short password.');
  } else {
    throw new Error(`Failed validation check: ${JSON.stringify(valData)}`);
  }

  // Test 3: User Login
  console.log('\n[Test 3] Logging in with user credentials...');
  const loginResponse = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  const loginData = await loginResponse.json();
  if (loginResponse.status === 200 && loginData.token) {
    console.log('✓ Success: Logged in and received token.');
  } else {
    throw new Error(`Failed login: ${JSON.stringify(loginData)}`);
  }

  // Test 4: Task Creation
  console.log('\n[Test 4] Creating a new task...');
  const createTaskResponse = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify({
      title: 'Write automated backend tests',
      description: 'Implement tests in test.js',
      due_date: '2026-07-17',
      priority: 'High'
    })
  });
  const taskData = await createTaskResponse.json();
  if (createTaskResponse.status === 201 && taskData.id) {
    console.log(`✓ Success: Task created with ID: ${taskData.id}`);
    testTaskId = taskData.id;
  } else {
    throw new Error(`Failed creating task: ${JSON.stringify(taskData)}`);
  }

  // Test 5: Retrieve Tasks
  console.log('\n[Test 5] Fetching tasks list...');
  const getTasksResponse = await fetch(`${BASE_URL}/tasks`, {
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });
  const tasksList = await getTasksResponse.json();
  if (getTasksResponse.status === 200 && Array.isArray(tasksList) && tasksList.length > 0) {
    console.log(`✓ Success: Retrieved ${tasksList.length} tasks.`);
  } else {
    throw new Error(`Failed fetching tasks: ${JSON.stringify(tasksList)}`);
  }

  // Test 6: Update Task (Complete)
  console.log('\n[Test 6] Updating task status to Completed...');
  const updateTaskResponse = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify({ status: 'Completed' })
  });
  const updatedTask = await updateTaskResponse.json();
  if (updateTaskResponse.status === 200 && updatedTask.status === 'Completed') {
    console.log('✓ Success: Task status updated to Completed.');
  } else {
    throw new Error(`Failed updating task: ${JSON.stringify(updatedTask)}`);
  }

  // Test 7: Delete Task
  console.log('\n[Test 7] Deleting task...');
  const deleteTaskResponse = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });
  const deleteResult = await deleteTaskResponse.json();
  if (deleteTaskResponse.status === 200 && deleteResult.id == testTaskId) {
    console.log('✓ Success: Task deleted successfully.');
  } else {
    throw new Error(`Failed deleting task: ${JSON.stringify(deleteResult)}`);
  }

  console.log('\n--- ALL BACKEND TESTS PASSED SUCCESSFULLY! ---');
} catch (err) {
  console.error('\n✗ Test Failed:', err.message);
  process.exitCode = 1;
} finally {
  // Shutdown the server process
  console.log('Shutting down server...');
  serverProcess.kill();
}
