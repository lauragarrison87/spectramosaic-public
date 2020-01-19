class VoxelGroup {
    constructor(group_name, custom) {
        this.name = group_name;
        this.voxels = [];
        this.available_metabolites = [];
        this.metabolite_averages = {};
        this.custom = custom;
    }

    addVoxel(voxel) {
        // do not add the same voxel twice
        if (this.voxels.findIndex(function(v) { return v.vox_id == voxel.vox_id; }) != -1) return;

        this.voxels.push(voxel);
        this.checkAvailableMetabolites();
        this.countAverages();
        updateMetaboliteList();
        updateDataTable();
    }

    removeVoxel(id) {
        var idx_to_remove = this.voxels.findIndex(function(elem) {
            return elem.vox_id == id;
        });

        if (idx_to_remove != -1) {
            this.voxels.splice(idx_to_remove, 1);
            this.checkAvailableMetabolites();
            updateMetaboliteList();
            updateDataTable();
            this.countAverages();
            p5_view_R.updateScene();
        }
    }

    removeVoxels(type) {
        var idx_to_remove = this.findMatchingVoxel(type);

        while (idx_to_remove != -1) {
            this.voxels.splice(idx_to_remove, 1);

            idx_to_remove = this.findMatchingVoxel(type);
        }

        this.checkAvailableMetabolites();
        updateMetaboliteList();
        updateDataTable();
        this.countAverages();
        p5_view_R.updateScene();
    }

    // returns the first index among selected voxels that matches given type, -1 if not found
    findMatchingVoxel(type) {
        var idx = -1;

        if (type.type == 'time') {
            idx = this.voxels.findIndex(function(elem) {
                return elem.time == type.value;
            });

        } else if (type.type == 'state') {
            idx = this.voxels.findIndex(function(elem) {
                return elem.state == parseInt(type.value);
            });

        } else if (type.type == 'location') {
            idx = this.voxels.findIndex(function(elem) {
                return elem.vox_location == type.value;
            });
        } else if (type.type == 'patient') {
            idx = this.voxels.findIndex(function(elem) {
                return elem.patient == type.value;
            });
        }

        return idx;
    }

    clearData() {
        this.voxels = [];
        this.available_metabolites = [];
        this.metabolite_averages = {};

        updateMetaboliteList();
        updateDataTable();
    }

    includesVoxel(id) {
        var idx = this.voxels.findIndex(function(vox) {
            return vox.vox_id == id;
        });

        return (idx != -1);
    }

    isCustom() {
        return this.custom;
    }

    checkAvailableMetabolites() {
        this.available_metabolites = [];

        for (var elem of this.voxels) {
            for (var key of Object.keys(elem.values_orig)) {
                if (key.includes("results")) {
                    if (elem.values_orig[key].concentration >= 0.0) { //add even the 0 value voxels for consistency
                        var metabolite = key.split("_results")[0];

                        if (!this.available_metabolites.includes(metabolite)) {
                            this.available_metabolites.push(metabolite);
                        }
                    }
                }
            }
        }
    }

    countAverages() {
        this.metabolite_averages = {};

        if (this.voxels.length == 0 || this.available_metabolites.length == 0) return;

        for (var metabolite of this.available_metabolites) {
            this.metabolite_averages[metabolite] = {
                concentration: 0,
                std_deviation: 0,
                CRLB_percent_max: 0
            };
        }

        let median_metabolits_values = [];

        let i = 0;
        // sum the individual values up
        for (var voxel of this.voxels) {
            for (var metabolite of this.available_metabolites) {

                // get all values for median, iqr and so on computation
                if (i === 0) {
                    median_metabolits_values.push({
                        metabolite: metabolite,
                        concentrations: [voxel.values_orig[metabolite + "_results"].concentration]
                    })
                } else {
                    median_metabolits_values.find(x => x.metabolite === metabolite).concentrations.push(voxel.values_orig[metabolite + "_results"].concentration)
                }

                this.metabolite_averages[metabolite].concentration += voxel.values_orig[metabolite + "_results"].concentration;
                this.metabolite_averages[metabolite].std_deviation += voxel.values_orig[metabolite + "_results"].std_deviation;
                this.metabolite_averages[metabolite].CRLB_percent_max = Math.max(this.metabolite_averages[metabolite].CRLB_percent_max, voxel.values_orig[metabolite + "_results"].CRLB_percent);
            }
            i++;
        }


        //  Stats for metabolites to make box plots in heatmap view 
        // if heatmap has one spectrum, make bars with height encoded to concentration value
        // if heatmap has 2 - 4 spectra, make bars with height equal to median and draw whiskers for min/max
        // if heatmap has 5 or more spectra, draw boxplot with min, 25th percentile, median (=bar height), 75th percentile, and max

        for (var metabolite of this.available_metabolites) {
            let meta = median_metabolits_values.find(meta => meta.metabolite === metabolite);

            // Compute summary statistics used for the box:
            var data_sorted = meta.concentrations.sort(d3.ascending);
            var q1 = d3.quantile(data_sorted, .25);
            var median = d3.quantile(data_sorted, .5);
            var q3 = d3.quantile(data_sorted, .75);
            var interQuantileRange = q3 - q1;
            var min = q1 - 1.5 * interQuantileRange;
            var max = q1 + 1.5 * interQuantileRange;

            this.metabolite_averages[meta.metabolite].median = median;
            this.metabolite_averages[meta.metabolite].q1 = q1;
            this.metabolite_averages[meta.metabolite].q3 = q3;
            this.metabolite_averages[meta.metabolite].interQuantileRange = interQuantileRange;
            this.metabolite_averages[meta.metabolite].min = min;
            this.metabolite_averages[meta.metabolite].max = max;
        }


        // take the average
        for (var metabolite of this.available_metabolites) {
            this.metabolite_averages[metabolite].concentration /= this.voxels.length;
            this.metabolite_averages[metabolite].std_deviation /= this.voxels.length;
        }


        // normalize averages between 0 and 1
        for (var metabolite of this.available_metabolites) {
            this.metabolite_averages[metabolite].concentration = p5_view_R.map(this.metabolite_averages[metabolite].concentration, 0, CONCENTRATION_MAX, 0, 1);
            this.metabolite_averages[metabolite].std_deviation = p5_view_R.map(this.metabolite_averages[metabolite].std_deviation, 0, STDEV_MAX, 0, 1);


            // normalize std, and so on
            this.metabolite_averages[metabolite].median = p5_view_R.map(this.metabolite_averages[metabolite].median, 0, CONCENTRATION_MAX, 0, 1);
            this.metabolite_averages[metabolite].q1 = p5_view_R.map(this.metabolite_averages[metabolite].q1, 0, CONCENTRATION_MAX, 0, 1);
            this.metabolite_averages[metabolite].q3 = p5_view_R.map(this.metabolite_averages[metabolite].q3, 0, CONCENTRATION_MAX, 0, 1);
            this.metabolite_averages[metabolite].interQuantileRange = p5_view_R.map(this.metabolite_averages[metabolite].interQuantileRange, 0, CONCENTRATION_MAX, 0, 1);
            this.metabolite_averages[metabolite].min = p5_view_R.map(this.metabolite_averages[metabolite].min, 0, CONCENTRATION_MAX, 0, 1);
            this.metabolite_averages[metabolite].max = p5_view_R.map(this.metabolite_averages[metabolite].max, 0, CONCENTRATION_MAX, 0, 1);
        }
    }

    // END Stats calculations for box plots 

    getAvg(metabolite) {
        return this.metabolite_averages[metabolite];
    }

    reloadVoxels() {
        for (var i = 0; i < this.voxels.length; i++) {
            var patient_name = this.voxels[i].patient;
            var patient_idx = patient_data.findIndex(function(elem) {
                return elem.name == patient_name;
            });

            var timepoint = this.voxels[i].time;
            var timepoint_idx = patient_data[patient_idx].timepoints.findIndex(function(elem) {
                return elem.time == timepoint;
            });

            var state = this.voxels[i].state;
            var state_idx = patient_data[patient_idx].timepoints[timepoint_idx].states.findIndex(function(elem) {
                return elem.state == state;
            });

            var vox_id = this.voxels[i].vox_id;
            var voxel_idx = patient_data[patient_idx].timepoints[timepoint_idx].states[state_idx].voxels.findIndex(function(elem) {
                return elem.id == vox_id;
            });

            var value_vector = patient_data[patient_idx].timepoints[timepoint_idx].states[state_idx].voxels[voxel_idx].data;
            var display_value_vector = patient_data[patient_idx].timepoints[timepoint_idx].states[state_idx].voxels[voxel_idx].displayed_data;

            this.voxels[i].values_orig = value_vector;
            this.voxels[i].values_disp = display_value_vector;
        }
    }

    sortVoxels() {
        this.voxels.sort(function(a, b) {
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
};

// create default voxels group - should be called each time new data is loaded, currently called inside normalizeData()
function createDefaultGroups() {
    var voxel_types = [];

    // find all possible types of voxels: timepoints, stated and locations
    patient_data.forEach(function(patient) {
        if (-1 == voxel_types.findIndex(function(elem) { return elem.type == 'patient' && elem.value == patient.name; })) {
            voxel_types.push({ type: 'patient', value: patient.name });
        }

        patient.timepoints.forEach(function(timepoint) {
            if (-1 == voxel_types.findIndex(function(elem) { return elem.type == 'time' && elem.value == timepoint.time; })) {
                voxel_types.push({ type: 'time', value: timepoint.time });
            }

            timepoint.states.forEach(function(state) {
                if (-1 == voxel_types.findIndex(function(elem) { return elem.type == 'state' && elem.value == state.state; })) {
                    voxel_types.push({ type: 'state', value: state.state });
                }

                state.voxels.forEach(function(voxel) {
                    if (-1 == voxel_types.findIndex(function(elem) { return elem.type == 'location' && elem.value == voxel.location; })) {
                        voxel_types.push({ type: 'location', value: voxel.location });
                    }


                    if (-1 == voxel_types.findIndex(function(elem) { return elem.type == 'echotime' && elem.value == voxel.echotime; })) {
                        voxel_types.push({ type: 'echotime', value: voxel.echotime });
                    }

                });
            });
        });
    });

    voxel_types.sort(function(a, b) {
        // echotime 
        if (a.type == 'echotime' && b.type != 'echotime') return -1;
        if (b.type == 'echotime' && a.type != 'echotime') return 1;

        // locations 
        if (a.type == 'location' && b.type != 'location') return -1;
        if (b.type == 'location' && a.type != 'location') return 1;

        // timepoints 
        if (a.type == 'time' && b.type != 'time') return -1;
        if (b.type == 'time' && a.type != 'time') return 1;

        // patient 
        if (a.type == 'patient' && b.type != 'patient') return -1;
        if (b.type == 'patient' && a.type != 'patient') return 1;

        // only states should remain -- order does not matter
        return 0;
    });

    voxel_types.forEach(function(t) {
        var group_name;
        if (t.type == 'patient') {
            group_name = "Patient: " + t.value;
        } else if (t.type == 'time') {
            group_name = "Time: " + t.value;
        } else if (t.type == 'state') {
            if (t.value == 0) {
                group_name = "Resting state";
            } else {
                group_name = "Active state";
            }
        } else if (t.type == 'location') {
            group_name = "Location: " + t.value;
        } else if (t.type == 'echotime') {
            group_name = "TE: " + t.value;
        }

        var group_idx = voxel_groups.findIndex(function(g) { return g.name == group_name; });

        if (group_idx == -1) {
            createVoxelGroup(group_name, false);
            group_idx = voxel_groups.length - 1;
        }

        selectVoxelType(t, voxel_groups[group_idx]);
    });
}

// stores a type of voxels in the specified group
function selectVoxelType(type, group) {

    patient_data.forEach(function(patient) {
        //var patient_id = patient.name;
        //var patient_age = patient.age;
        //var patient_gender = patient.gender;

        if (type.type == 'patient' && patient.name != type.value) return;

        patient.timepoints.forEach(function(timepoint) {
            //var time = timepoint.time;

            if (type.type == 'time' && timepoint.time != type.value) return;

            timepoint.states.forEach(function(s) {
                //var state = s.state;

                if (type.type == 'state' && s.state != parseInt(type.value)) return;

                s.voxels.forEach(function(voxel) {

                    if (type.type == 'location' && voxel.location != type.value) return;
                    if (type.type == 'echotime' && voxel.echotime != type.value) return;

                    var data_to_add = {
                        label: patient.name + ": " + voxel.id, // used when removing a voxel for the button text	-- redundant but keep for now
                        patient: patient.name,
                        age: patient.age,
                        gender: patient.gender,
                        vox_id: voxel.id, // ID of the voxel, e.g. P123456
                        vox_location: voxel.location, // location of the voxel, e.g. left prefrontal
                        state: s.state, // ID of the state: 0 = resting, 1 = active
                        time: timepoint.time, // time in the format "DD.MM.YYYY"
                        echotime: voxel.echotime,
                        highlighted: false,
                        values_orig: voxel.data, // Data values, unedited output from Tarquin
                        values_disp: voxel.displayed_data, // Data values normalized between 0 and 1 for displaying the curve
                    };

                    group.addVoxel(data_to_add);
                });
            });
        });
    });
}

// stores all loaded voxels in the specified group
function selectAllVoxels(group) {

    patient_data.forEach(function(patient) {
        //var patient_id = patient.name;
        //var age = patient.age;
        //var gender = patient.gender;

        patient.timepoints.forEach(function(timepoint) {
            //var time = timepoint.time;

            timepoint.states.forEach(function(s) {
                //var state = s.state;

                s.voxels.forEach(function(voxel) {
                    var data_to_add = {
                        label: patient.name + ": " + voxel.id, // used when removing a voxel for the button text	-- redundant but keep for now
                        patient: patient.name,
                        age: patient.age,
                        gender: patient.gender,
                        vox_id: voxel.id, // ID of the voxel, e.g. P123456
                        vox_location: voxel.location, // location of the voxel, e.g. left prefrontal
                        state: s.state, // ID of the state: 0 = resting, 1 = active
                        time: timepoint.time, // time in the format "DD.MM.YYYY"
                        echotime: voxel.echotime,
                        highlighted: false,
                        values_orig: voxel.data, // Data values, unedited output from Tarquin
                        values_disp: voxel.displayed_data, // Data values normalized between 0 and 1 for displaying the curve
                    };

                    group.addVoxel(data_to_add);
                });
            });
        });
    });
}

// puts voxels from given groups to a single array and sorts them (location -> patient -> time -> state)
function collapseAndSort(groups) {

    // collapse voxels from all groups together
    var all_selected_voxels = [];
    for (var g of groups) {
        for (var vox of g.voxels) {
            var idx = all_selected_voxels.findIndex(function(v) {
                return v.vox_id == vox.vox_id;
            });
            if (idx == -1) all_selected_voxels.push(vox);
        }
    }

    // sort them
    all_selected_voxels.sort(function(a, b) {
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

    return all_selected_voxels;
}

function updateDataTable() {
    /*$("#right_data_table").empty();

    var htmlTableHead = "<tr id=\"table-head\"><th>Voxel ID</th><th>Patient</th><th>State</th><th>Time</th><th>Gender</th><th>Age</th><th>TE</th><th>Location</th><th class=\"groups-table-col\">Groups</th></tr>"
    $("#right_data_table").append(htmlTableHead);*/

    $(".tablerow", "#right_data_table").remove();

    all_selected_voxels = collapseAndSort(voxel_groups);

    all_selected_voxels.forEach(function(voxel) {
        var id = voxel.vox_location + "_" + voxel.patient + "_" + voxel.state + "_" + voxel.time + "_" + voxel.vox_id;

        var htmlString;
        if (ids_to_highlight.includes(id)) {
            htmlString = "<tr class=\"tablerow table-highlighted\" id =\"";
        } else {
            htmlString = "<tr class=\"tablerow\" id =\"";
        }

        htmlString += id + "\"> <td>" + voxel.vox_id + "</td><td>" + voxel.patient + "</td><td>";

        if (voxel.state == 0) htmlString += "resting</td><td>";
        else htmlString += "active</td><td>";

        htmlString += voxel.time + "</td>" +
            "<td>" + voxel.gender + "</td>" +
            "<td>" + voxel.age + "</td>" +
            "<td>" + voxel.echotime + "</td>" +
            "<td>" + voxel.vox_location + "</td>";

        var groups = "";
        voxel_groups.forEach(function(g) {
            if (!g.isCustom()) return; // do not display auto-generated groups
            if (g.includesVoxel(voxel.vox_id)) {
                groups += g.name + "; ";
            }
        });

        htmlString += "<td>" + groups + "</td>" + "</tr>";

        $("#right_data_table").append(htmlString);
    });
}