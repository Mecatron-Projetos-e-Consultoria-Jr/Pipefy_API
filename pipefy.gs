/**
 * Make a post request to pipefy's graphql API to get all the cards on a pipe
 * @param pipe_id 
 * @param user_token 
 * @returns JSON DATA
 */
function get_pipe_data(pipe_id, user_token) {

    // Specify pipefy's graphql endpoint 
    var endpoint = 'https://app.pipefy.com/graphql';

    // format the query to be made
    var query = '{ cards(pipe_id:' + pipe_id + ') {' + 'edges { node { id title assignees { name } current_phase { name } due_date parent_relations{cards {id}} fields{name value} labels { name } phases_history { phase { name } firstTimeIn lastTimeOut } url } }' + '} }';

    // Format the options to be used on the POST request
    var options = { 'method': 'POST', 'Accept': 'application/json', 'Content-Type': 'application/json', 'headers': { 'Authorization': user_token }, 'payload': { 'query': query } };

    // Make the post request and load it into a json object
    var json_data = UrlFetchApp.fetch(endpoint, options);
    json_data = JSON.parse(json_data.getContentText());

    return json_data['data']['cards']['edges'];
}

/**
 * Checks if the target data in is a 2d data set, in the corresponding column (index)
 * @param target_data 
 * @param data_set_2d 
 * @param index 
 * @returns 
 */
function in_data_set(target_data, data_set_2d, index) {
    var target_index = 1;

    for (data of data_set_2d) {
        if (target_data == data[index]) {
            return target_index;
        }
        target_index++;
    }
    return -1;
}

/**
 * Extract the chapters from the list of labels, ignoring the 'Entregável' label
 * @param labels 
 * @returns 
 */
function extract_chapters_labels(labels) {
    var str_labels = '' // String of concatenated labels
    var first_label = true;

    for (label of labels) {
        if (label['name'] == 'Entregável') {
            continue;
        }
        else {
            // If it is the first lable, dont add the comma 
            if (!first_label) {
                str_labels += ',';
            }
            else {
                first_label = false;
            }

            // Concatenate the new label
            str_labels += label['name'];
        }
    }

    return str_labels;
}

/**
 * Extract the assignees of the card, returning a concatenated string with comma separating the names
 * @param card_data 
 * @returns 
 */
function extract_assignees(card_data) {
    var concatenated_str = '';
    var first_name = true;

    for (assignee of card_data['assignees']) {
        if (!first_name) {
            concatenated_str += ',';
        }
        else {
            first_name = false;
        }

        // join the new name to the other ones
        concatenated_str += assignee['name'];

    }
    return concatenated_str;
}

/**
 * Extract the value of the specified field name
 * @param card_data 
 * @param field_name 
 * @returns 
 */
function extract_field_data(card_data, field_name) {
    // Iterate through all the fields in the card and return the value of the target one
    for (field of card_data['fields']) {
        if (field['name'] == field_name) {
            return field['value'];
        }
    }

    // If not found, return '-'
    return '-';
}

/**
 * Extract the data for the specified phase
 * @param card_data
 * @param phase_name - The name of the target phase to extract the date
 * @returns 
 */
function extract_phase_history_date(card_data, phase_name) {

    // Iterate through the pahses in the phase history field of the card
    for (phase of card_data['phases_history']) {

        // If the target phase is found, try to return 
        if (phase['phase']['name'] == phase_name) {
            return phase['firstTimeIn'].split('T')[0];
        }

    }

    // If field not in card, return '-'
    return '-';
}

/**
 * Update the deliverables's data, but if it was not saved before append it to the end of the spreadsheet
 * @param card_data 
 * @param project_id 
 */
function update_deliverables(card_data, project_id) {

    // First we need to check if the deliverable is already in the spreadsheet, if so we just need to update its info, otherwise we need to add to it
    var deliverables = SpreadsheetApp.getActiveSpreadsheet().getRange('Entregáveis!B:B').getValues();
    var target_index = in_data_set(card_data['id'], deliverables, 0);

    // Variables that will be saved on the spread sheet
    var sheet = SpreadsheetApp.getActive().getSheetByName('Entregáveis');
    var current_phase = card_data['current_phase']['name'];
    var end_date = (current_phase == 'Done') ? card_data['phases_history'].pop()['firstTimeIn'].split('T')[0] : '-';
    var due_date = (card_data['due_date'] != null) ? card_data['due_date'].split('T')[0] : '-';

    // If the target_index is -1, the data was not in the range, otherwise it returns the line in which it was found
    if (target_index == -1) {
        sheet.appendRow([current_phase, card_data['id'], card_data['title'], project_id, extract_chapters_labels(card_data['labels']), end_date, due_date]);
    }
    else {
        // Get the correct range
        var range = SpreadsheetApp.getActive().getSheetByName('Entregáveis').getRange('A' + target_index + ':G' + target_index);

        // Update the row
        range.setValues([[current_phase, card_data['id'], card_data['title'], project_id, extract_chapters_labels(card_data['labels']), end_date, due_date]]);
    }
}

/**
 *  If the card was no in the sheets, append it to the end of the file, if it was already in the dataset, update its row
 * @param card_data 
 * @param project_id 
 */
function update_subdeliverables(card_data, project_id) {
    // Get the ids of all sub-deliverables already on the database 
    var sub_deliverables = SpreadsheetApp.getActive().getRange('Subentregáveis!B:B').getValues();

    // Variables that will be saved to the spread sheet
    var sheet = SpreadsheetApp.getActive().getSheetByName('Subentregáveis');
    var current_phase = card_data['current_phase']['name'];
    var starting_date = extract_phase_history_date(card_data, 'Fazendo Hoje');
    var end_date = (current_phase == 'Done') ? card_data['phases_history'].pop()['firstTimeIn'].split('T')[0] : '-';
    var due_date = (card_data['due_date'] != null) ? card_data['due_date'].split('T')[0] : '-';
    var parent_deliverable = (card_data['parent_relations'][0]['cards'][0] != null) ? card_data['parent_relations'][0]['cards'][0]['id'] : '-';

    // Check to see if the card_data is already in the saved data 
    var target_index = in_data_set(card_data['id'], sub_deliverables, 0);

    // If the target_index is -1, the data was not in the range, otherwise it returns the line in which it was found
    if (target_index == -1) {
        sheet.appendRow([current_phase, card_data['id'], card_data['title'], extract_chapters_labels(card_data['labels']), extract_field_data(card_data, 'Mecapoints'), starting_date, end_date, due_date, parent_deliverable, project_id, extract_assignees(card_data)]);
    }
    else {
        // Get the correct range
        var range = SpreadsheetApp.getActive().getSheetByName('Subentregáveis').getRange('A' + target_index + ':K' + target_index);

        // Update the row
        range.setValues([[current_phase, card_data['id'], card_data['title'], extract_chapters_labels(card_data['labels']), extract_field_data(card_data, 'Mecapoints'), starting_date, end_date, due_date, parent_deliverable, project_id, extract_assignees(card_data)]]);
    }
}

/**
 * Checks to see if the card has a deliverable label to it, if so, return true, else, return false
 * @param card_data 
 * @returns bool
 */
function is_deliverable(card_data) {

    for (label of card_data['labels']) {
        if (label['name'] == 'Entregável') {
            return true;
        }
    }

    return false;
}

/**
 * Get all cards from the project's pipe, separate them into deliverables and sub_deliverables and update their data accordingly
 * @param project_id 
 */
function update_project_data(project_id) {

    // The authentication token for pipefy's api
    var user_token = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJ1c2VyIjp7ImlkIjozMDExMTU0MjgsImVtYWlsIjoicGVkcm8uY3J1ekBtZWNhdHJvbi5vcmcuYnIiLCJhcHBsaWNhdGlvbiI6MzAwMTA0NTIzfX0.5UCErNgzErJD6if93Hn8-OlnCiXkyTIYazKKf_d2GFHPVeJZWuZdfVQHmL9ISloOdsKnkTLs4pRFYxZphe3a1w';


    // Get all cards on the project's pipe
    var cards_data = get_pipe_data(project_id, user_token);

    // Iterate through all the cards
    for (card of cards_data) {
        card = card['node'];

        // If the card is a deliverable, update the deliverable's sheets, Otherwise, update the subdeliverable's sheets
        if (is_deliverable(card)) {
            update_deliverables(card, project_id);
        }
        else {
            update_subdeliverables(card, project_id);
        }


    }

}

/**
 * Update the data from active projects by pulling their information form pipefy
 */
function update_sheets_data() {
    // First we need to get all the sheets in the file
    var spread_sheets = SpreadsheetApp.getActiveSpreadsheet();

    // Now we need to get a list of all projects, but only update the data for the active ones
    var projects = spread_sheets.getRange('Projetos!A:B').getValues();
    for (project of projects) {

        if (project[0] == 'Ativo') {
            update_project_data(project[1]);
        }

    }

}