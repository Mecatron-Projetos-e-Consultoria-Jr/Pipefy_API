/**
 * Get a list of dictionaries containing the `name` and `id` of all the pipes that the user is subscribed to by the organization's id
 * @param organization_id 
 * @param user_token 
 * @returns 
 */
function get_organization_pipes(organization_id, user_token) {

    // Specify pipefy's graphql endpoint 
    var endpoint = 'https://app.pipefy.com/graphql';

    // format the query to be made
    var query = '{organization{(id:' + organization_id + '){pipes{name id}}}';

    // Format the options to be used on the POST request
    var options = { 'method': 'POST', 'Accept': 'application/json', 'Content-Type': 'application/json', 'headers': { 'Authorization': user_token }, 'payload': { 'query': query } };

    // Make the post request and load it into a json object
    var json_data = UrlFetchApp.fetch(endpoint, options);
    json_data = JSON.parse(json_data.getContentText());

    return json_data['data']['organization']['pipes'];
}


/**
 * Make a post request to pipefy's graphql API to get all the cards on a pipe
 * @param pipe_id 
 * @param user_token 
 * @returns JSON DATA
 */
function get_pipe_cards(pipe_id, user_token) {

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
function extract_field_value(card_data, field_name) {
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
 * Extract the date the card first entered the specified phase
 * @param card_data
 * @param phase_name - The name of the target phase to extract the first time in date
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
 * Extract the labels from a card. By default it returns a comma separated string
 * containing all the labels, but you can pass the argument `as_string=False` to return an array
 * @param card_data 
 * @param as_string
 * @returns 
 */
function extract_card_labels(card_data, as_string = true) {
    var concatenated_str = '';
    var first_label = true;
    var labels = [];

    // Iterate through all label's dictionaries
    for (label of card_data['labels']) {

        // If the user wants to have a comma separated string, concatenate the new label's name
        if (as_string) {
            if (!first_label) {
                concatenated_str += ', ';
            }
            else {
                first_label = false;
            }

            concatenated_str += label['name'];
        }

        // If the user just wants a list of labels, push the new label's name to the end of the array
        else {
            labels.push(label['name']);

        }
    }

    // Return what the user wants, be it the array of labels or the concatenated string
    var return_value = (as_string) ? concatenated_str : labels;
    return return_value;
}