// Import the Camunda 8 SDK
const { Camunda8 } = require('@camunda8/sdk');
const fs = require('fs'); // Import the file system module
const path = require('path'); // Import the path module

// Configure the connection to your self-managed Camunda 8 instance
const c8 = new Camunda8({
  // Use OAuth strategy for authentication
  CAMUNDA_AUTH_STRATEGY: 'OAUTH',
  // Keycloak token endpoint URL
  CAMUNDA_OAUTH_URL: 'http://localhost:18080/auth/realms/camunda-platform/protocol/openid-connect/token',
  // Zeebe gRPC address
  ZEEBE_GRPC_ADDRESS: 'localhost:26500',
  // Zeebe client credentials (verify these in your Keycloak setup)
  ZEEBE_CLIENT_ID: 'zeebe', // Default, verify if needed
  ZEEBE_CLIENT_SECRET: 'zecret', // Default, verify if needed
  // Base URLs for other Camunda components
  CAMUNDA_TASKLIST_BASE_URL: 'http://localhost:8082',
  CAMUNDA_OPERATE_BASE_URL: 'http://localhost:18081',
  CAMUNDA_OPTIMIZE_BASE_URL: 'http://localhost:8083',
  CAMUNDA_MODELER_BASE_URL: 'http://localhost:8070/api', // Default, verify if needed
  // Disable secure connection for local HTTP setup
  CAMUNDA_SECURE_CONNECTION: false,
});

// Get the Zeebe gRPC client
const zeebe = c8.getZeebeGrpcApiClient();
// Get the Operate API client
const operate = c8.getOperateApiClient(); // Initialize Operate client
// Get the Tasklist API client
const tasklist = c8.getTasklistApiClient(); // Initialize Tasklist client

// Example: Fetch and print the Zeebe cluster topology
async function getTopology() {
  try {
    console.log('Attempting to connect to Zeebe...');
    const topology = await zeebe.topology();
    console.log('Successfully connected! Zeebe Topology:');
    console.log(JSON.stringify(topology, null, 2));
  } catch (error) {
    console.error('Failed to connect or fetch topology:', error);
  }
}

// Function to deploy a process model
async function deployProcess() {
  try {
    const processPath = path.join(__dirname, 'test-process.bpmn');
    console.log(`\nAttempting to deploy process from ${processPath}...`);
    const deployment = await zeebe.deployResource({
      processFilename: processPath
    });
    console.log('Process deployed successfully:');
    console.log(JSON.stringify(deployment, null, 2));
    // Return the process definition key for later use
    if (deployment.deployments && deployment.deployments[0] && deployment.deployments[0].process) {
      return deployment.deployments[0].process.bpmnProcessId;
    }
  } catch (error) {
    console.error('Failed to deploy process:', error);
  }
  return null;
}

// Function to start a process instance
async function startProcessInstance(bpmnProcessId) {
  if (!bpmnProcessId) {
    console.error('\nCannot start process instance without a bpmnProcessId.');
    return;
  }
  try {
    console.log(`\nAttempting to start instance of process: ${bpmnProcessId} with initial data...`);
    // Define initial variables
    const initialVariables = {
      letterId: `L-${Date.now()}`, // Example dynamic ID
      sender: 'Musabeh Alali'
    };
    console.log('Initial Variables:', JSON.stringify(initialVariables, null, 2));

    const result = await zeebe.createProcessInstance({
      bpmnProcessId: bpmnProcessId,
      variables: initialVariables // Pass the variables here
    });
    console.log('Process instance started successfully:');
    console.log(JSON.stringify(result, null, 2));
    return result.processInstanceKey;
  } catch (error) {
    console.error('Failed to start process instance:', error);
  }
  return null;
}

// Function to check process instance status using Operate
async function checkProcessInstanceStatus(processInstanceKey) {
  if (!processInstanceKey) {
    console.error('\nCannot check status without a processInstanceKey.');
    return;
  }
  try {
    console.log(`\nChecking status of process instance ${processInstanceKey} via Operate...`);
    // Add a small delay to allow Operate to index the instance
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds (increased from 2)

    const instance = await operate.getProcessInstance(processInstanceKey);
    console.log('Process instance details from Operate:');
    console.log(JSON.stringify(instance, null, 2));
  } catch (error) {
    // Handle potential 404 if Operate hasn't indexed the instance yet
    if (error.message && error.message.includes('404')) {
       console.warn(`\nOperate API returned 404 for instance ${processInstanceKey}. It might still be indexing. Check Operate UI.`);
    } else {
       console.error('Failed to get process instance details from Operate:', error);
    }
  }
}

// Function to query Tasklist for available tasks
async function queryTasklist(processInstanceKey) {
  if (!processInstanceKey) {
    console.error('\nCannot query Tasklist without a processInstanceKey.');
    return null;
  }
  try {
    console.log(`\nQuerying Tasklist for tasks related to instance ${processInstanceKey}...`);
    // Add a delay to allow Tasklist to index the new task
    await new Promise(resolve => setTimeout(resolve, 7000)); // Wait 7 seconds (increased from 3)

    // Search for tasks - look for CREATED or ASSIGNED
    const tasks = await tasklist.searchTasks({
      stateIn: ['CREATED', 'ASSIGNED'], // Look for tasks ready or already assigned
      processInstanceKey: processInstanceKey
    });

    console.log('Tasks found in Tasklist:');
    console.log(JSON.stringify(tasks, null, 2));

    // Return the first task found for potential completion
    return tasks.length > 0 ? tasks[0] : null;
  } catch (error) {
    console.error('Failed to query Tasklist:', error);
    return null;
  }
}

// Function to complete a task in Tasklist
async function completeTask(taskId) {
  if (!taskId) {
    console.error('\nCannot complete task without a taskId.');
    return false;
  }
  try {
    console.log(`\nAttempting to complete task ${taskId}...`);
    // You can pass variables during completion if needed:
    // await tasklist.completeTask(taskId, { outcome: 'approved' });
    await tasklist.completeTask(taskId, {}); // Complete with empty variables
    console.log(`Task ${taskId} completed successfully.`);
    return true;
  } catch (error) {
    console.error(`Failed to complete task ${taskId}:`, error);
    return false;
  }
}

// Main execution function
async function main() {
  await getTopology(); // Check connection first
  const bpmnProcessId = await deployProcess(); // Deploy the process

  if (bpmnProcessId) {
    console.log(`\nProcess deployed with ID: ${bpmnProcessId}`);
    // Start an instance of the deployed process
    const processInstanceKey = await startProcessInstance(bpmnProcessId);
    if (processInstanceKey) {
      console.log(`\nProcess instance started with key: ${processInstanceKey}`);

      // Query Tasklist for the user task created by this instance
      const task = await queryTasklist(processInstanceKey);

      if (task) {
        console.log(`\nFound task '${task.name}' with ID: ${task.id}`);
        console.log('\nPlease go to the Tasklist UI to complete this task manually.');
      } else {
        console.log('\nNo CREATED or ASSIGNED task found for this instance in Tasklist yet. Check Tasklist UI.');
      }
    }
  }
}

main();

// You can add more SDK calls here, for example:
const modeler = c8.getModelerApiClient();

// Example: List process definitions using Operate API
async function listProcessDefinitions() {
  try {
    const operate = c8.getOperateApiClient();
    console.log('\nFetching process definitions from Operate...');
    const processDefinitions = await operate.searchProcessDefinitions({});
    console.log('Process Definitions:', JSON.stringify(processDefinitions, null, 2));
  } catch (error) {
    console.error('Failed to fetch process definitions:', error);
  }
}
// listProcessDefinitions(); // Uncomment to run
