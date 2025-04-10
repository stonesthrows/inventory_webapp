// Client ID from Google Cloud Console
const CLIENT_ID = '272610170681-cjdkcjmej5312nipcu7pvop74c9se9md.apps.googleusercontent.com';
// API Key from Google Cloud Console
const API_KEY = 'AIzaSyDVHcyzBUfER4fXNKIMGEC6WSfLktjDC8g';
// ID of your Google Sheet
const SPREADSHEET_ID = '1XJH-BORaBZFoUUwI8YM-c123YGyVt0tVy6h8yKaABy8';
// Range of your data (including header row)
const RANGE = 'Sheet1!A1:Z1000';

// Authorization scopes required by the API
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Callback after the API client is loaded. Loads the discovery doc to initialize the API.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the discovery doc to initialize the API.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize-button').style.display = 'block';
    }
}

/**
 * Handle the auth flow with a popup and callback.
 */
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('authorize-button').style.display = 'none';
        document.getElementById('signout-button').style.display = 'block';
        document.getElementById('content').style.display = 'block';
        
        // Load the spreadsheet
        await loadSpreadsheetData();
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session
        tokenClient.requestAccessToken({prompt: ''});
    }
}

/**
 * Sign out the user upon button click.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('content').style.display = 'none';
        document.getElementById('authorize-button').style.display = 'block';
        document.getElementById('signout-button').style.display = 'none';
    }
}

/**
 * Load and display the spreadsheet data
 */
async function loadSpreadsheetData() {
    try {
        // Get spreadsheet data
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });
        
        const range = response.result;
        
        if (!range || !range.values || range.values.length === 0) {
            document.getElementById('content').innerHTML = 'No data found.';
            return;
        }
        
        // Display the data as a table
        displayTable(range.values);
        
        // Create a form to add new data
        createForm(range.values[0]);
        
    } catch (err) {
        console.error('Error loading spreadsheet data:', err);
        document.getElementById('content').innerHTML = 'Error loading data. ' + err.message;
    }
}

/**
 * Display spreadsheet data as a table
 */
function displayTable(values) {
    const headerRow = values[0];
    const dataRows = values.slice(1);
    
    // Clear existing table
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Add header row
    headerRow.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        tableHeader.appendChild(th);
    });
    
    // Add action column header
    const actionTh = document.createElement('th');
    actionTh.textContent = 'Actions';
    tableHeader.appendChild(actionTh);
    
    // Add data rows
    dataRows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        
        // Add data cells
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        
        // Add action buttons cell
        const actionTd = document.createElement('td');
        
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = () => editRow(rowIndex + 1, row);
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.style.backgroundColor = '#DB4437';
        deleteButton.onclick = () => deleteRow(rowIndex + 1);
        
        actionTd.appendChild(editButton);
        actionTd.appendChild(deleteButton);
        tr.appendChild(actionTd);
        
        tableBody.appendChild(tr);
    });
}

/**
 * Create a form to add new data
 */
function createForm(headers) {
    const form = document.getElementById('data-form');
    form.innerHTML = '';
    
    headers.forEach(header => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = header;
        label.htmlFor = `input-${header}`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `input-${header}`;
        input.name = header;
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    });
    
    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.id = 'submit-button';
    submitButton.textContent = 'Add Row';
    submitButton.onclick = addNewRow;
    
    form.appendChild(submitButton);
}

/**
 * Add a new row to the spreadsheet
 */
async function addNewRow() {
    const form = document.getElementById('data-form');
    const inputs = form.querySelectorAll('input');
    const rowData = [];
    
    inputs.forEach(input => {
        rowData.push(input.value);
    });
    
    try {
        const result = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });
        
        // Clear form
        inputs.forEach(input => {
            input.value = '';
        });
        
        // Reload data to update the table
        await loadSpreadsheetData();
        
        console.log('Row added:', result);
    } catch (err) {
        console.error('Error adding row:', err);
        alert('Error adding row: ' + err.message);
    }
}

/**
 * Edit a row in the spreadsheet
 */
function editRow(rowIndex, rowData) {
    const form = document.getElementById('data-form');
    const inputs = form.querySelectorAll('input');
    
    // Fill the form with the row data
    inputs.forEach((input, index) => {
        if (rowData[index]) {
            input.value = rowData[index];
        }
    });
    
    // Change the submit button to update
    const submitButton = document.getElementById('submit-button');
    submitButton.textContent = 'Update Row';
    submitButton.onclick = () => updateRow(rowIndex);
}

/**
 * Update a row in the spreadsheet
 */
async function updateRow(rowIndex) {
    const form = document.getElementById('data-form');
    const inputs = form.querySelectorAll('input');
    const rowData = [];
    
    inputs.forEach(input => {
        rowData.push(input.value);
    });
    
    const range = `Sheet1!A${rowIndex}:${String.fromCharCode(65 + rowData.length - 1)}${rowIndex}`;
    
    try {
        const result = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });
        
        // Clear form and reset button
        inputs.forEach(input => {
            input.value = '';
        });
        
        const submitButton = document.getElementById('submit-button');
        submitButton.textContent = 'Add Row';
        submitButton.onclick = addNewRow;
        
        // Reload data to update the table
        await loadSpreadsheetData();
        
        console.log('Row updated:', result);
    } catch (err) {
        console.error('Error updating row:', err);
        alert('Error updating row: ' + err.message);
    }
}

/**
 * Delete a row from the spreadsheet
 */
async function deleteRow(rowIndex) {
    if (!confirm('Are you sure you want to delete this row?')) {
        return;
    }
    
    try {
        // We'll use the batchUpdate method to delete rows
        const result = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: 0, // Assuming the first sheet
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex
                            }
                        }
                    }
                ]
            }
        });
        
        // Reload data to update the table
        await loadSpreadsheetData();
        
        console.log('Row deleted:', result);
    } catch (err) {
        console.error('Error deleting row:', err);
        alert('Error deleting row: ' + err.message);
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load the API client and auth libraries
    gapiLoaded();
    gisLoaded();
    
    document.getElementById('authorize-button').addEventListener('click', handleAuthClick);
    document.getElementById('signout-button').addEventListener('click', handleSignoutClick);
});