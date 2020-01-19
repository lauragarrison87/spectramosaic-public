var patient_data = [];
var voxel_groups = [];
var selected_voxels = [];
var datapoints_loaded = 0;
var BASELINE_COL = 3;

var CONCENTRATION_MAX = 30;
var STDEV_MAX = 60;
var spectrum_length = 1024;

// stores a voxel for the analysis (metabolite selection and matrix view)
function selectVoxel(data_label, patient_id, patient_age, patient_gender, voxel_id, voxel_loc, state_id, timepoint, echo_time, data_values, display_value_vector) {

    var alreadySelected = selected_voxels.findIndex(function(elem) {
        return elem.vox_id == voxel_id;
    });

    if (alreadySelected == -1) {
        selected_voxels.push({
            label: data_label, // used when removing a voxel for the button text	-- redundant but keep for now
            patient: patient_id,
            age: patient_age,
            gender: patient_gender,
            vox_id: voxel_id, // ID of the voxel, e.g. P123456
            vox_location: voxel_loc, // location of the voxel, e.g. left prefrontal
            state: state_id, // ID of the state: 0 = resting, 1 = active
            time: timepoint, // time in the format "DD.MM.YYYY"
            echotime: echo_time,
            highlighted: false,
            values_orig: data_values, // Data values, unedited output from Tarquin
            values_disp: display_value_vector, // Data values normalized between 0 and 1 for displaying the curve
        });

        //getAvailableMetabolites();
    }
}

// removes a voxel from the selected array
function removeFromSelected(voxel_id) {
    var selectedIdx = selected_voxels.findIndex(function(elem) {
        return elem.vox_id == voxel_id;
    });

    if (selectedIdx != -1) {
        selected_voxels.splice(selectedIdx, 1);
        //getAvailableMetabolites();
    }
}

function sortSelectedVoxels() {
    selected_voxels.sort(function(a, b) {
        /*var ID_a = a.voxel + "_" + a.patient + "_" + a.state + "_" + a.time +  "_" + a.vox_id;
        var ID_b = b.voxel + "_" + b.patient + "_" + b.state + "_" + b.time +  "_" + b.vox_id;
        			
        if (ids_to_highlight.includes(ID_a) && !ids_to_highlight.includes(ID_b)) return -1;
        if (ids_to_highlight.includes(ID_b) && !ids_to_highlight.includes(ID_a)) return 1;
        */

        if (a.highlighted && !b.highlighted) return -1;
        if (b.highlighted && !a.highlighted) return 1;

        if (a.vox_location == b.vox_location) {
            if (a.patient == b.patient) {
                if (a.state == b.state) {

                    var day_a = parseInt(a.time.split('.')[0]);
                    var mon_a = parseInt(a.time.split('.')[1]);
                    var year_a = parseInt(a.time.split('.')[2]);

                    var day_b = parseInt(b.time.split('.')[0]);
                    var mon_b = parseInt(b.time.split('.')[1]);
                    var year_b = parseInt(b.time.split('.')[2]);

                    var time_a = day_a + mon_a * 31 + year_a * 12 * 13;
                    var time_b = day_b + mon_b * 31 + year_b * 12 * 13;

                    return (time_a < time_b) ? -1 : (time_a > time_b) ? 1 : 0;
                } else {
                    return (a.state < b.state) ? -1 : (a.state > b.state) ? 1 : 0;
                }
            } else {
                return (a.patient < b.patient) ? -1 : (a.patient > b.patient) ? 1 : 0;
            }
        } else {
            return (a.vox_location < b.vox_location) ? -1 : (a.vox_location > b.vox_location) ? 1 : 0;
        }
    });
}

// creates an empty voxel group, indicate by boolean value whether the group is custom or auto-generated
function createVoxelGroup(group_name, custom) {
    voxel_groups.push(new VoxelGroup(group_name, custom));
    updateDropdownList();
}

// stores a voxel for the left panel view (selection)
function addVoxel(patient_name, vox_location, vox_id, vox_data, png_location_image, state_no, time_point, patient_gender, patient_age, echo_time) {
    var datapoint = {
        location: vox_location,
        id: vox_id,
        loc_image: png_location_image,
        echotime: echo_time,
        data: vox_data,
        highlighted: false,
        normalized_data: null
    };

    // check if the voxel id is unique -- do not add voxel if it is not
    var id_unique = true;

    patient_data.forEach(function(patient) {
        patient.timepoints.forEach(function(timepoint) {
            timepoint.states.forEach(function(s) {
                s.voxels.forEach(function(voxel) {
                    id_unique = id_unique && voxel.id != vox_id;
                });
            });
        });
    });

    if (!id_unique) return;

    var patient_idx = patient_data.findIndex(function(element) {
        return element.name == patient_name;
    });

    // check if a patient of this name already exists -- if not create a new one

    if (patient_idx == -1) {

        var new_state = {
            state: state_no,
            highlighted: false,
            voxels: [datapoint]
        };

        var new_timepoint = {
            time: time_point,
            highlighted: false,
            states: [new_state]
        };

        var new_patient = {
            name: patient_name,
            gender: patient_gender,
            age: patient_age,
            highlighted: false,
            timepoints: [new_timepoint]
        };

        patient_data.push(new_patient);
    } else {

        var time_idx = patient_data[patient_idx].timepoints.findIndex(function(element) {
            return element.time == time_point;
        });

        if (time_idx == -1) {

            var new_state = {
                state: state_no,
                highlighted: false,
                voxels: [datapoint]
            };

            var new_timepoint = {
                time: time_point,
                highlighted: false,
                states: [new_state]
            };

            patient_data[patient_idx].timepoints.push(new_timepoint);
        } else {

            var state_idx = patient_data[patient_idx].timepoints[time_idx].states.findIndex(function(element) {
                return element.state == state_no;
            });

            if (state_idx == -1) {
                var new_state = {
                    state: state_no,
                    highlighted: false,
                    voxels: [datapoint]
                };
                patient_data[patient_idx].timepoints[time_idx].states.push(new_state);
            } else {

                patient_data[patient_idx].timepoints[time_idx].states[state_idx].voxels.push(datapoint);
            }

        }
    }
}

function resizeArray(input_array, new_size) {
    if (input_array.length > new_size) return downsampleArray(input_array, new_size);
    if (input_array.length < new_size) return upsampleArray(input_array, new_size);

    return input_array; // if the size matches
}

//	Returns an array of a desired size, samples are merged by averaging in bins
function downsampleArray(input_array, new_size) {
    if (input_array.length < new_size) {
        console.log("Downsample: input array size smaller than desired: " + input_array.length);
        return null;
    }

    var ratio = input_array.length / new_size;
    var diff = 0;
    var new_array = [];

    var orig_pos = 0;

    for (var i = 0; i < new_size; i++) {
        var step = Math.min(Math.floor(ratio), input_array.length - orig_pos);
        if (diff > 1) {
            step += 1;
        }

        diff += ratio - step;

        var avg = 0;
        for (var acc = 0; acc < step; acc++) {
            avg += input_array[orig_pos + acc];
        }
        avg /= step;

        new_array.push(avg);

        orig_pos += step;
    }

    //console.log("Resized: " + (input_array.length - orig_pos));

    return new_array;
}

//	Returns an array of a desired size, new samples are created by linear interpolation
function upsampleArray(input_array, new_size) {
    if (input_array.length > new_size) {
        console.log("Upsample: input array size larger than desired: " + input_array.length);
        return null;
    }

    var new_array = [];

    for (var i = 0; i < input_array.length - 1; i++) {

        // fill in original values

        var output_index_1 = Math.round(p5_view_L.map(i, 0, input_array.length - 1, 0, new_size - 1)); // use p5 mapping function from an instance of p5
        var output_index_2 = Math.round(p5_view_L.map(i + 1, 0, input_array.length - 1, 0, new_size - 1));

        new_array[output_index_1] = input_array[i];
        new_array[output_index_2] = input_array[i + 1];

        // interpolate in between

        var empty_spaces = output_index_2 - output_index_1 - 1;

        for (var j = 1; j <= empty_spaces; j++) {
            new_array[output_index_1 + j] = (empty_spaces + 1 - j) / (empty_spaces + 1) * new_array[output_index_1] +
                j / (empty_spaces + 1) * new_array[output_index_2];
        }
    }

    return new_array;
}

function preprocessLoadedData(data) {
    if (data == null) {
        console.log("Preprocess: no data was loaded.");
        return null;
    }
    var processed_data = {};

    // check where to cut the data (we don't want PPM scale outside [4, 0])
    var cutFrom = data["PPMScale"].findIndex(function(val) {
        return val <= 4;
    });
    var cutTo = data["PPMScale"].findIndex(function(val) {
        return val <= 0;
    });

    //	cut out the meaningless parts and resample
    var column_names = Object.getOwnPropertyNames(data);
    column_names.forEach(function(column) {
        processed_data[column] = resizeArray(data[column].slice(cutFrom, cutTo), spectrum_length)
    });

    //	normalize in a separate function after all loading is done	
    return processed_data;
}

// finds missing columns and fills with 0
// returns an array of all columns (names) which should be normmalized
function fillMissingValues() {
    var cols = [];
    var result_cols = [];

    patient_data.forEach(function(patient) {
        patient.timepoints.forEach(function(timepoint) {
            timepoint.states.forEach(function(s) {
                s.voxels.forEach(function(voxel) {
                    Object.keys(voxel.data).forEach(function(column) {
                        if (column.includes("_results")) {
                            if (!result_cols.includes(column)) result_cols.push(column);
                        } else if (column != "PPMScale" && !cols.includes(column)) {
                            cols.push(column);
                        } 
                    });
                });
            });
        });
    });

    patient_data.forEach(function(patient) {
        patient.timepoints.forEach(function(timepoint) {
            timepoint.states.forEach(function(s) {
                s.voxels.forEach(function(voxel) {
                    // fill missing vector cols
                    cols.forEach(function(column) {
                        if (!Object.keys(voxel.data).includes(column)) {
                            voxel.data[column] = Array(spectrum_length).fill(0.0);
                        }
                    });

                    // fill missing result cols
                    result_cols.forEach(function(column) {
                        if (!Object.keys(voxel.data).includes(column)) {
                            voxel.data[column] = { concentration: 0.0, std_deviation: 0.0, CRLB_percent: 100 };
                        }
                    });
                });
            });
        });
    });

    return cols;
}

function normalizeData() {
    var mins = {};
    var maxes = {};
    var cols_to_normalize = fillMissingValues();

    cols_to_normalize.forEach(function(column) {
        maxes[column] = [];
        mins[column] = [];
    });

    // for each column and each voxel (datapoint) find the maximal and minimal value
    patient_data.forEach(function(patient) {
        patient.timepoints.forEach(function(timepoint) {
            timepoint.states.forEach(function(state) {
                state.voxels.forEach(function(datapoint) {
                    cols_to_normalize.forEach(function(column) {
                        //var sorted_data = datapoint.data[col].slice().sort(function(a, b){return a - b});	// used this for the quantile, not needed anymore
						//console.log("col: " + column);
                        maxes[column].push(Math.max(...datapoint.data[column]));
                        mins[column].push(Math.min(...datapoint.data[column]));
                    });
                });
            });
        });
    });

    var global_min = {};
    var global_max = {};
    var global_peak = {};

    // determine global maximum and minimum and the highest peak (in any direction) in each column
    cols_to_normalize.forEach(function(column) {
        global_min[column] = Math.min(...mins[column]);
        global_max[column] = Math.max(...maxes[column]);
        global_peak[column] = Math.max(Math.abs(global_max[column]), Math.abs(global_min[column]));
    });

    // normalize all datapoints (not just the new ones)
    patient_data.forEach(function(patient) {
        patient.timepoints.forEach(function(timepoint) {
            timepoint.states.forEach(function(state) {
                for (var s = 0; s < state.voxels.length; s++) {
                    var normalized_datapoint = {}; // normalized heights of the peak (positive / negative perserved)
                    var normalized_datapoint_disp = {}; // normalized value between 0 and 1 for displaying the curve

                    cols_to_normalize.forEach(function(column) {
                        normalized_datapoint[column] = [];
                        normalized_datapoint_disp[column] = [];

                        for (var j = 0; j < state.voxels[s].data[column].length; j++) {
                            normalized_datapoint_disp[column][j] = p5_view_L.map(state.voxels[s].data[column][j], global_min[column], global_max[column], 0, 1); // use p5 mapping function from an instance of p5

                            if (state.voxels[s].data[column][j] < 0) {
                                normalized_datapoint[column][j] = (-1) * p5_view_L.map(Math.abs(state.voxels[s].data[column][j]), 0, global_peak[column], 0, 1); // use p5 mapping function from an instance of p5
                            } else {
                                normalized_datapoint[column][j] = p5_view_L.map(state.voxels[s].data[column][j], 0, global_peak[column], 0, 1); // use p5 mapping function from an instance of p5
                            }
                        }
                    });

                    state.voxels[s].normalized_data = normalized_datapoint;
                    state.voxels[s].displayed_data = normalized_datapoint_disp;
                }
            });
        });
    });

    // reload all data that is curently displayed
    reloadSelectedVoxels();
    voxel_groups.forEach(function(group) {
        group.reloadVoxels();
    });

    // create default voxel groups
    createDefaultGroups();

    // update tab for voxel selection
    getAvailableVoxelTypes();

    // since we have updated the voxel selection we also need to update the group dropdowns    
    updateDropdownList();
}

// reload all displayed data after normalization
function reloadSelectedVoxels() {

    for (var i = 0; i < selected_voxels.length; i++) {
        var patient_idx = patient_data.findIndex(function(elem) {
            return elem.name == selected_voxels[i].patient;
        });

        var timepoint_idx = patient_data[patient_idx].voxel_data.findIndex(function(elem) {
            return elem.time == selected_voxels[i].time;
        });

        var state_idx = patient_data[patient_idx].voxel_data[timepoint_idx].states.findIndex(function(elem) {
            return elem.state == selected_voxels[i].state;
        });

        var voxel_idx = patient_data[patient_idx].voxel_data[timepoint_idx].states[state_idx].voxels.findIndex(function(elem) {
            return elem.id == selected_voxels[i].vox_id;
        });

        var value_vector = patient_data[patient_idx].voxel_data[timepoint_idx].states[state_idx].voxels[voxel_idx].normalized_data[0];
        var display_value_vector = patient_data[patient_idx].voxel_data[timepoint_idx].states[state_idx].voxels[voxel_idx].displayed_data[0];

        selected_voxels[i].values_orig = value_vector;
        selected_voxels[i].values_disp = display_value_vector;
    }

}