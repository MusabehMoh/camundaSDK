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
    console.log(`\nAttempting to start instance of process: ${bpmnProcessId}...`);
    const result = await zeebe.createProcessInstance({
      bpmnProcessId: bpmnProcessId,
      // You can pass variables here if needed, e.g.:
      // variables: { myVariable: 'testValue' }
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
      // Check the status of the instance via Operate
      await checkProcessInstanceStatus(processInstanceKey);
    }
  }
}

main();

// You can add more SDK calls here, for example:
const tasklist = c8.getTasklistApiClient();
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
