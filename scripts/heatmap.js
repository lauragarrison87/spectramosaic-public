var heatmap_limits = [6, -5]; // limits after which ratios won't be distinguished (will be the darkest color)
var color_schemes = [d3.interpolateRdBu, d3.interpolateBrBG]; // used color schemes (d3 interpolation functions), first for positive ratios, second for negative ratios
var ids_to_highlight = []; // ids of voxels to be highlighted -- stored in a global variable to connect with the left panel easily
var CRLB_WARNING_VAL = 15.0; // value of CRLB percent over which the warning is shown

let viewR = function(p) {

    p.setup = function() {
        /*var w = (parseInt($("#grid_viewR").attr("data-sizex")) + 1) * gridster_api.options.widget_base_dimensions[0]; 
        var h = (parseInt($("#grid_viewR").attr("data-sizey")) + 1) * gridster_api.options.widget_base_dimensions[1]; */
        var w = parseInt($("#grid_viewR").attr("data-sizex")) * (($(".gridster").width() - gridster_api.options.widget_margins[0]) / 35 - 1);
        var h = parseInt($("#grid_viewR").attr("data-sizey")) * (($(".gridster").height() - gridster_api.options.widget_margins[1]) / 17 - 1);
        p.createCanvas(w, h);

        p.textAlign(p.CENTER, p.CENTER);
        p.rectMode(p.CORNERS);

        // set up properties of the view
        p.margin = { left: Math.round(h / 4), top: Math.round(h / 20), right: Math.round(h / 50), bottom: Math.round(h / 4) };
        p.axisLength = { x: p.width - p.margin.left - p.margin.right, y: p.height - p.margin.top - p.margin.bottom };

        // initialize data arrays for both axes
        p.xMetabolites = []; // metabolites shown on X axis (array of strings, values will be taken from voxel_groups[i].metabolite_averages, see voxel_groups.js)
        p.yMetabolites = []; // metabolites shown on Y axis (array of strings, values will be taken from voxel_groups[i].metabolite_averages, see voxel_groups.js)
        p.xGroups = []; // groups shown on X axis (array of indexes)	
        p.yGroups = []; // groups shown on Y axis (array of indexes)	

        p.expanded_data = [];

        // set up equidistant axis ticks and a scaling factor of 1 to each tile
        p.resetView();

        // sizes of cells, to be updated dynamically as metabolites are added
        p.cellSize = { x: 0, y: 0 };
        p.trueTicksPos = { x: [], y: [] }; // positions of ticks on the axis relative to axis start point [p.margin.left, p.height - p.margin.bottom], updated in draw axis functions

        p.activeAxis = -1; // -1 = no active axis, 0 = X axis active, 1 = Y axis active
        p.activeButton = -1;
        p.activeDataAxis = -1;
        p.activeMetabolite = -1;

        p.mousePrevX = 0;
        p.mousePrevY = 0;

        // GUI
        p.my_buttons = [{ caption: "Reset view", position: { x: p.width * 0.85, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } },
            { caption: "Clear data", position: { x: 0, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } }
        ];
    };

    p.draw = function() {
        p.updateScene();
        p.noLoop();
    };

    p.resized = function() {
        var w = parseInt($("#grid_viewR").attr("data-sizex")) * (($(".gridster").width() - gridster_api.options.widget_margins[0]) / 35 - 1);
        var h = parseInt($("#grid_viewR").attr("data-sizey")) * (($(".gridster").height() - gridster_api.options.widget_margins[1]) / 17 - 1);
        p.resizeCanvas(w, h);

        // set up properties of the view
        p.margin = { left: Math.round(h / 4), top: Math.round(h / 20), right: Math.round(h / 50), bottom: Math.round(h / 4) };
        p.axisLength = { x: p.width - p.margin.left - p.margin.right, y: p.height - p.margin.top - p.margin.bottom };

        p.my_buttons[0] = { caption: "Reset view", position: { x: p.width * 0.85, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } };
        p.my_buttons[1] = { caption: "Clear data", position: { x: 0, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } };

        //p.refreshTileValues_X();
        //p.refreshTileValues_Y();

        p.updateScene();
    }

    p.resetView = function() {

        //if (p.xMetabolites.length == 0 || p.yMetabolites.length == 0) return;

        p.trueTicksPos = { x: [], y: [] };
        p.xAxisTicks = [];
        p.yAxisTicks = [];
        p.xScales = [];
        p.yScales = [];

        p.tileExpanded = { x: -1, y: -1 };

        for (var i = 0; i < p.xMetabolites.length + 1; i++) {
            var axisPos = p.map(i, 0, p.xMetabolites.length, 0, 1);
            p.xAxisTicks.push(axisPos);
            p.xScales.push(1);
        }
        for (var i = 0; i < p.yMetabolites.length + 1; i++) {
            var axisPos = p.map(i, 0, p.yMetabolites.length, 0, 1);
            p.yAxisTicks.push(axisPos);
            p.yScales.push(1);
        }

        // p.countExpandedRatios();
    }

    p.updateScene = function() {
        p.background(255);

        var redraw_left = (ids_to_highlight.length > 0); // if there was something highlighted, update left view

        ids_to_highlight = []; // voxels to be highlighted on mousover on expanded details (remains empty otherwise)
        sortSelectedVoxels(); // this is used in expanded details computation and to update the table below this view

        // draw the border of the window
        p.strokeWeight(1);
        p.stroke(200);
        p.noFill();
        p.rect(0, 0, p.width - 2, p.height - 2, 10);

        if (p.xMetabolites.length == 0 && p.yMetabolites.length == 0) {
            p.fill(0);
            p.noStroke();
            p.textFont("Arial", 16);
            p.text("Data not ready", p.width / 2, p.height / 2);
        } else if (p.xMetabolites.length == 0) {
            p.drawYAxis();
            p.drawYValues();
            p.fill(0);
            p.noStroke();
            p.textFont("Arial", 16);
            p.text("Data not ready", p.width / 2, p.height / 2);
        } else if (p.yMetabolites.length == 0) {
            p.drawXAxis();
            p.drawXValues();
            p.fill(0);
            p.noStroke();
            p.textFont("Arial", 16);
            p.text("Data not ready", p.width / 2, p.height / 2);
        } else {
            p.drawXAxis();
            p.drawYAxis();
            p.drawXValues();
            p.drawYValues();
            p.drawTiles();
        }

        p.drawButtons();
        if (redraw_left) {
            p5_view_L.updateScene();
            updateDataTable();
            updateSelectionPanel();
        }
    }

    p.drawButtons = function() {

        p.rectMode(p.CORNER);

        p.my_buttons.forEach(function(button) {
            p.fill(255);
            p.stroke(200);

            p.rect(button.position.x, button.position.y, button.size.x, button.size.y, 5);

            p.fill(0);
            p.noStroke();
            p.textFont("Arial", 12);

            p.text(button.caption, button.position.x + button.size.x / 2, button.position.y + button.size.y / 2);
        });

        p.rectMode(p.CORNERS);
    }

    p.drawXAxis = function() {

        // show group names

        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(14);
        p.noStroke();
        p.fill(0);

        p.text("Groups on X axis:", p.margin.left * 0.1, p.height - p.margin.bottom + 20);

        for (var i = 0; i < p.xGroups.length; i++) {
            p.text(voxel_groups[p.xGroups[i]].name, p.margin.left * 0.1, p.height - p.margin.bottom + (i + 2) * 20);
        }

        // draw axis line
        p.fill(0);
        p.stroke(0);
        p.line(p.margin.left, p.height - p.margin.bottom, p.width - p.margin.right, p.height - p.margin.bottom);

        p.cellSize.x = p.axisLength.x / p.xMetabolites.length;

        p.trueTicksPos.x = [];

        // draw ticks on X axis

        // draw first tick
        p.line(p.margin.left, p.height - p.margin.bottom - 5, p.margin.left, p.height - p.margin.bottom + 5);
        p.trueTicksPos.x.push(0);

        // draw the rest, apply scaling of tiles

        for (var i = 1; i < p.xMetabolites.length + 1; i++) {
            var axisPos = p.trueTicksPos.x[i - 1] + p.cellSize.x * p.xScales[i - 1]; // true position according to the scaling factor of the tile

            p.line(p.margin.left + axisPos, p.height - p.margin.bottom - 5, p.margin.left + axisPos, p.height - p.margin.bottom + 5);

            //	remember scaled position on the axis
            p.trueTicksPos.x.push(axisPos);
        }
    }

    p.drawYAxis = function() {

        // show group names

        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(14);
        p.noStroke();
        p.fill(0);

        p.text("Groups on Y axis:", p.margin.left * 0.07, p.margin.top * 0.4);

        for (var i = 0; i < p.yGroups.length; i++) {
            p.text(voxel_groups[p.yGroups[i]].name, p.margin.left * 0.07, p.margin.top * 0.4 + (i + 1) * 20);
        }

        // draw axis line
        p.fill(0);
        p.stroke(0);
        p.line(p.margin.left, p.margin.top, p.margin.left, p.height - p.margin.bottom);

        p.cellSize.y = p.axisLength.y / p.yMetabolites.length;

        p.trueTicksPos.y = [];

        // draw ticks on Y axis

        // draw first tick
        p.line(p.margin.left - 5, p.height - p.margin.bottom, p.margin.left + 5, p.height - p.margin.bottom);
        p.trueTicksPos.y.push(0);

        // draw the rest, apply scaling of tiles

        for (var i = 1; i < p.yMetabolites.length + 1; i++) {
            var axisPos = p.trueTicksPos.y[i - 1] + p.cellSize.y * p.yScales[i - 1]; // true position according to the scaling factor of the tile

            p.line(p.margin.left - 5, p.height - p.margin.bottom - axisPos, p.margin.left + 5, p.height - p.margin.bottom - axisPos);

            //	remember scaled position on the axis and on PPM scale
            p.trueTicksPos.y.push(axisPos);
        }
    }

    p.addMetabolites = function(axis, metabolites, group_idx) {
        if (axis == 'x') {
            metabolites.forEach(function(metabolite) {
                if (!p.xMetabolites.includes(metabolite)) {
                    p.xMetabolites.push(metabolite);
                }
            });
            p.xMetabolites.sort();
            if (!p.xGroups.includes(group_idx)) p.xGroups.push(group_idx);

        } else if (axis == 'y') {
            metabolites.forEach(function(metabolite) {
                if (!p.yMetabolites.includes(metabolite)) {
                    p.yMetabolites.push(metabolite);
                }
            });
            p.yMetabolites.sort();
            if (!p.yGroups.includes(group_idx)) p.yGroups.push(group_idx);
        }

        p.resetView();
        p.updateScene();
    }

    p.countExpandedRatios = function() {
        if (p.xMetabolites.length == 0 && p.yMetabolites.length == 0) return;

        var groups_to_collapse = [];
        for (var x of p.xGroups) {
            groups_to_collapse.push(voxel_groups[x]);
        }
        for (var y of p.yGroups) {
            if (!p.xGroups.includes(y)) groups_to_collapse.push(voxel_groups[y]);
        }

        // get voxels from all groups together and sort them (see voxel_groups.js for function definition)
        var all_selected_voxels = collapseAndSort(groups_to_collapse);

        var metabolite_x = p.xMetabolites[p.tileExpanded.x];
        var metabolite_y = p.yMetabolites[p.tileExpanded.y];

        p.expanded_data = [];

        for (var data_pos = 0; data_pos < all_selected_voxels.length;) {

            // process locations

            var voxel_x_avg = 0;
            var voxel_y_avg = 0;
            var voxel_data_len = 0;
            var voxel_err_warn = false;
            var patients_data = [];

            while (data_pos < all_selected_voxels.length) {

                // process patients

                var patient_x_avg = 0;
                var patient_y_avg = 0;
                var patient_data_len = 0;
                var patient_err_warn = false;
                var states_data = [];

                while (data_pos < all_selected_voxels.length) {

                    // process states

                    var state_x_avg = 0;
                    var state_y_avg = 0;
                    var state_data_len = 0;
                    var state_err_warn = false;
                    var timepoints_data = [];

                    while (data_pos < all_selected_voxels.length) {

                        // process timepoints

                        var time_x_avg = 0;
                        var time_y_avg = 0;
                        var time_data_len = 0;
                        var time_err_warn = false;

                        while (data_pos < all_selected_voxels.length) {

                            var amp_x = all_selected_voxels[data_pos].values_orig[metabolite_x + "_results"].concentration;
                            var amp_y = all_selected_voxels[data_pos].values_orig[metabolite_y + "_results"].concentration;
                            var err_warn = all_selected_voxels[data_pos].values_orig[metabolite_y + "_results"].CRLB_percent > CRLB_WARNING_VAL;

                            time_x_avg += amp_x;
                            state_x_avg += amp_x;
                            patient_x_avg += amp_x;
                            voxel_x_avg += amp_x;

                            time_y_avg += amp_y;
                            state_y_avg += amp_y;
                            patient_y_avg += amp_y;
                            voxel_y_avg += amp_y;

                            time_err_warn = time_err_warn || err_warn;
                            state_err_warn = state_err_warn || err_warn;
                            patient_err_warn = patient_err_warn || err_warn;
                            voxel_err_warn = voxel_err_warn || err_warn;

                            time_data_len++;
                            state_data_len++;
                            patient_data_len++;
                            voxel_data_len++;
                            data_pos++;

                            if (data_pos != 0) {
                                if (data_pos == all_selected_voxels.length ||
                                    all_selected_voxels[data_pos].time != all_selected_voxels[data_pos - 1].time ||
                                    all_selected_voxels[data_pos].state != all_selected_voxels[data_pos - 1].state ||
                                    all_selected_voxels[data_pos].patient != all_selected_voxels[data_pos - 1].patient ||
                                    all_selected_voxels[data_pos].vox_location != all_selected_voxels[data_pos - 1].vox_location) { // all data for this timepoint processed

                                    time_x_avg /= time_data_len;
                                    time_y_avg /= time_data_len;

                                    var rat, true_rat;

                                    true_rat = time_x_avg / time_y_avg;

                                    // detect whether the ratio would have a negative sign
                                    var neg = (time_x_avg < 0 && time_y_avg > 0) || (time_x_avg > 0 && time_y_avg < 0);

                                    // count as a positive ratio (needed because of the symmetric transformation)
                                    time_x_avg = p.abs(time_x_avg);
                                    time_y_avg = p.abs(time_y_avg);

                                    if (time_x_avg > time_y_avg) {
                                        rat = time_x_avg / time_y_avg;
                                        rat -= 1;
                                    } else {
                                        rat = -time_y_avg / time_x_avg;
                                        rat += 1;
                                    }

                                    timepoints_data.push({
                                        time: all_selected_voxels[data_pos - 1].time,
                                        echotime: all_selected_voxels[data_pos - 1].echotime,
                                        voxel_id: all_selected_voxels[data_pos - 1].vox_id,
                                        ratio: rat,
                                        negative: neg,
                                        true_ratio: true_rat,
                                        error_warning: time_err_warn
                                    });

                                    break;
                                }
                            }
                        }

                        if (data_pos != 0) {
                            if (data_pos == all_selected_voxels.length ||
                                all_selected_voxels[data_pos].state != all_selected_voxels[data_pos - 1].state ||
                                all_selected_voxels[data_pos].patient != all_selected_voxels[data_pos - 1].patient ||
                                all_selected_voxels[data_pos].vox_location != all_selected_voxels[data_pos - 1].vox_location) { // all data for this state processed

                                state_x_avg /= state_data_len;
                                state_y_avg /= state_data_len;

                                var rat, true_rat;

                                true_rat = state_x_avg / state_y_avg;

                                // detect whether the ratio would have a negative sign
                                var neg = (state_x_avg < 0 && state_y_avg > 0) || (state_x_avg > 0 && state_y_avg < 0);

                                // count as a positive ratio (needed because of the symmetric transformation)
                                state_x_avg = p.abs(state_x_avg);
                                state_y_avg = p.abs(state_y_avg);

                                if (state_x_avg > state_y_avg) {
                                    rat = state_x_avg / state_y_avg;
                                    rat -= 1;
                                } else {
                                    rat = -state_y_avg / state_x_avg;
                                    rat += 1;
                                }

                                states_data.push({
                                    state: all_selected_voxels[data_pos - 1].state,
                                    ratio: rat,
                                    negative: neg,
                                    true_ratio: true_rat,
                                    error_warning: state_err_warn,
                                    timepoints: timepoints_data
                                });

                                break;
                            }
                        }
                    }

                    if (data_pos != 0) {
                        if (data_pos == all_selected_voxels.length ||
                            all_selected_voxels[data_pos].patient != all_selected_voxels[data_pos - 1].patient ||
                            all_selected_voxels[data_pos].vox_location != all_selected_voxels[data_pos - 1].vox_location) { // all data for this patient processed

                            patient_x_avg /= patient_data_len;
                            patient_y_avg /= patient_data_len;

                            var rat, true_rat;

                            true_rat = patient_x_avg / patient_y_avg;

                            // detect whether the ratio would have a negative sign
                            var neg = (patient_x_avg < 0 && patient_y_avg > 0) || (patient_x_avg > 0 && patient_y_avg < 0);

                            // count as a positive ratio (needed because of the symmetric transformation)
                            patient_x_avg = p.abs(patient_x_avg);
                            patient_y_avg = p.abs(patient_y_avg);

                            if (patient_x_avg > patient_y_avg) {
                                rat = patient_x_avg / patient_y_avg;
                                rat -= 1;
                            } else {
                                rat = -patient_y_avg / patient_x_avg;
                                rat += 1;
                            }


                            patients_data.push({
                                patient: all_selected_voxels[data_pos - 1].patient,
                                gender: all_selected_voxels[data_pos - 1].gender,
                                age: all_selected_voxels[data_pos - 1].age,
                                ratio: rat,
                                negative: neg,
                                true_ratio: true_rat,
                                error_warning: patient_err_warn,
                                states: states_data
                            });

                            break;
                        }
                    }
                }

                if (data_pos != 0) {
                    if (data_pos == all_selected_voxels.length || all_selected_voxels[data_pos].vox_location != all_selected_voxels[data_pos - 1].vox_location) { // all data for this voxel processed

                        voxel_x_avg /= voxel_data_len;
                        voxel_y_avg /= voxel_data_len;

                        var rat, true_rat;

                        true_rat = voxel_x_avg / voxel_y_avg;

                        // detect whether the ratio would have a negative sign
                        var neg = (voxel_x_avg < 0 && voxel_y_avg > 0) || (voxel_x_avg > 0 && voxel_y_avg < 0);

                        // count as a positive ratio (needed because of the symmetric transformation)
                        voxel_x_avg = p.abs(voxel_x_avg);
                        voxel_y_avg = p.abs(voxel_y_avg);

                        if (voxel_x_avg > voxel_y_avg) {
                            rat = voxel_x_avg / voxel_y_avg;
                            rat -= 1;
                        } else {
                            rat = -voxel_y_avg / voxel_x_avg;
                            rat += 1;
                        }


                        p.expanded_data.push({
                            voxel: all_selected_voxels[data_pos - 1].vox_location,
                            ratio: rat,
                            negative: neg,
                            true_ratio: true_rat,
                            error_warning: voxel_err_warn,
                            patients: patients_data
                        });

                        break;
                    }
                }
            }
        }
    }

    //	IMPORTANT: X and Y axis have to be drawn before the tiles and data values - positions of ticks would not be updated otherwise

    p.drawTooltipRatio = function(rat, warning) {
        var mouseText = rat.toFixed(4);
        var wid = p.textWidth(mouseText);
        p.fill(255);
        p.noStroke();
        p.rect(p.mouseX + 3, p.mouseY - 18, p.mouseX + 7 + wid, p.mouseY - 5);
        if (!warning) p.fill(0);
        else p.fill(255, 0, 0);
        p.textSize(12);
        p.textAlign(p.LEFT, p.CENTER);
        p.text(mouseText, p.mouseX + 5, p.mouseY - 10);
        p.textAlign(p.CENTER, p.CENTER);
    }

    p.drawTiles = function() {
        p.noStroke();
        p.rectMode(p.CORNERS);

        var tile_fill_color;

        // set highlighting to false
        selected_voxels.forEach(function(elem) {
            elem.highlighted = false;
        });

        var mouse_over_tile = false,
            mouse_over_expanded_tile = false;
        var tooltip_ratio, tooltip_warning;

        for (var x = 0; x < p.xMetabolites.length; x++) {
            for (var y = 0; y < p.yMetabolites.length; y++) {
                //	get coordinates of the tile
                var x_from = p.trueTicksPos.x[x];
                var x_to = p.trueTicksPos.x[x + 1];
                var y_from = p.trueTicksPos.y[y + 1];
                var y_to = p.trueTicksPos.y[y];

                //	get the ratio between X and Y metabolite concentrations (average of all data on each axis)
                var rat;
                var tile_avg_x = 0,
                    tile_avg_y = 0;
                var error_warning = false;

                for (var gx of p.xGroups) {
                    if (voxel_groups[gx].available_metabolites.includes(p.xMetabolites[x])) {
                        tile_avg_x += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].concentration;
                        error_warning = (error_warning || voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].CRLB_percent_max > CRLB_WARNING_VAL);
                    }
                }
                for (var gy of p.yGroups) {
                    if (voxel_groups[gy].available_metabolites.includes(p.yMetabolites[y])) {
                        tile_avg_y += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].concentration;
                        error_warning = (error_warning || voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].CRLB_percent_max > CRLB_WARNING_VAL);
                    }
                }

                tile_avg_x /= p.xGroups.length;
                tile_avg_y /= p.yGroups.length;

                // detect whether the ratio would have a negative sign
                var true_ratio = tile_avg_x / tile_avg_y;
                var negative = (true_ratio < 0);

                // count as a positive ratio (needed because of the symmetric transformation)
                tile_avg_x = p.abs(tile_avg_x);
                tile_avg_y = p.abs(tile_avg_y);

                if (tile_avg_x > tile_avg_y) {
                    rat = tile_avg_x / tile_avg_y;
                    rat -= 1;
                } else {
                    rat = -tile_avg_y / tile_avg_x;
                    rat += 1;
                }

                // 	map ratio to color
                var col = p.getHeatColor(rat, negative);
                if (x == p.tileExpanded.x && y == p.tileExpanded.y) tile_fill_color = col;

                // 	draw the rectangle
                p.fill(col);
                p.rect(p.margin.left + x_from, p.height - p.margin.bottom - y_from,
						p.margin.left + x_to, p.height - p.margin.bottom - y_to);

                // show ratio on mousover		

                if (p.mouseX > p.margin.left + x_from && p.mouseX < p.margin.left + x_to &&
                    p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {

                    if (x == p.tileExpanded.x && y == p.tileExpanded.y) {
                        mouse_over_expanded_tile = true;
                        continue;
                    }

                    mouse_over_tile = true;
                    tooltip_ratio = true_ratio;
                    tooltip_warning = error_warning;

                    // if tile is expanded, handle tooltip while drawing details

                }
            }

            // 	show ratio as tooltip				

            if (mouse_over_tile) p.drawTooltipRatio(tooltip_ratio, tooltip_warning);
        }

        p.noFill();
        p.stroke(0);

        p.rect(p.margin.left, p.height - p.margin.bottom - p.trueTicksPos.y[p.yMetabolites.length], p.margin.left + p.trueTicksPos.x[p.xMetabolites.length], p.height - p.margin.bottom);

        p.drawExpandedDetails(tile_fill_color, mouse_over_expanded_tile);

        if (ids_to_highlight.length > 0) {
            sortSelectedVoxels(); // some rows are highlighted -> sort again so that they are at the top
        }
    }

    p.drawExpandedDetails = function(tile_fill_color, mouse_over_tile) {
        if (p.tileExpanded.x == -1 || p.tileExpanded.y == -1) return;


        //	get coordinates of the tile
        var x_from = p.trueTicksPos.x[p.tileExpanded.x];
        var x_to = p.trueTicksPos.x[p.tileExpanded.x + 1];
        var y_from = p.trueTicksPos.y[p.tileExpanded.y + 1];
        var y_to = p.trueTicksPos.y[p.tileExpanded.y];

        p.countExpandedRatios();

        // store all possible ids to highlight if mouse is in the expanded tile -> filter later
        if (p.mouseX > p.margin.left + x_from && p.mouseX < p.margin.left + x_to &&
            p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {

            selected_voxels.forEach(function(elem) {
                var id = elem.vox_location + "_" + elem.patient + "_" + elem.state + "_" + elem.time + "_" + elem.vox_id;
                ids_to_highlight.push(id);
            });
        }

        // check timepoints
        var hasTimepoints = false;

        p.expanded_data.forEach(function(voxel) {
            voxel.patients.forEach(function(patient) {
                patient.states.forEach(function(state) {
                    hasTimepoints = hasTimepoints || state.timepoints.length > 1;
                });
            });
        });


        var tooltip_rat = -1, tooltip_error = false;

        if (p.expanded_data.length == 1 && p.expanded_data[0].patients.length == 1) { // 1 patient 1 voxel
            if (hasTimepoints) {
                if (p.expanded_data[0].patients[0].states.length > 1) {

                    var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[0].states[0].ratio, p.expanded_data[0].patients[0].states[0].negative);
                    var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[0].states[1].ratio, p.expanded_data[0].patients[0].states[1].negative);

                    p.fill(fill_color_top);
                    if (p.brightness(tile_fill_color) > 80) p.stroke(0);
                    else p.stroke(255);

                    p.rect(p.margin.left + x_from + 5,
                        p.height - p.margin.bottom - y_from + 5,
                        p.margin.left + x_to - 5,
                        p.height - p.margin.bottom - (y_from + y_to) / 2,
                        25, 25, 0, 0);

                    p.fill(fill_color_bottom);

                    p.rect(p.margin.left + x_from + 5,
                        p.height - p.margin.bottom - (y_from + y_to) / 2,
                        p.margin.left + x_to - 5,
                        p.height - p.margin.bottom - y_to - 5,
                        0, 0, 25, 25);

                    //	draw timepoints

                    p.drawTimepoints(p.expanded_data[0].patients[0].states[0].timepoints,
                        p.margin.left + x_from + 5,
                        p.height - p.margin.bottom - y_from + 5,
                        p.margin.left + x_to - 5,
                        p.height - p.margin.bottom - (y_from + y_to) / 2,
                        fill_color_top);

                    p.drawTimepoints(p.expanded_data[0].patients[0].states[1].timepoints,
                        p.margin.left + x_from + 5,
                        p.height - p.margin.bottom - (y_from + y_to) / 2,
                        p.margin.left + x_to - 5,
                        p.height - p.margin.bottom - y_to - 5,
                        fill_color_bottom);

                    // check for mouse 

                    if (p.mouseX > p.margin.left + x_from + 5 && p.mouseX < p.margin.left + x_to - 5 &&
                        p.mouseY > p.height - p.margin.bottom - y_from + 5 && p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {

                        tooltip_rat = p.expanded_data[0].patients[0].states[0].true_ratio;
                        tooltip_error = p.expanded_data[0].patients[0].states[0].error_warning;

                        ids_to_highlight = ids_to_highlight.filter(function(id) {
                            var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[0].patient + "_" + p.expanded_data[0].patients[0].states[0].state;
                            return id.startsWith(ref_id);
                        });

                    } else if (p.mouseX > p.margin.left + x_from + 5 && p.mouseX < p.margin.left + x_to - 5 &&
                        p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2 && p.mouseY < p.height - p.margin.bottom - y_to - 5) {

                        tooltip_rat = p.expanded_data[0].patients[0].states[1].true_ratio;
                        tooltip_error = p.expanded_data[0].patients[0].states[1].error_warning;

                        ids_to_highlight = ids_to_highlight.filter(function(id) {
                            var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[0].patient + "_" + p.expanded_data[0].patients[0].states[1].state;
                            return id.startsWith(ref_id);
                        });
                    }

                } else {

                    var fill_color = p.getHeatColor(p.expanded_data[0].patients[0].ratio, p.expanded_data[0].patients[0].negative);

                    p.fill(fill_color);
                    if (p.brightness(tile_fill_color) > 80) p.stroke(0);
                    else p.stroke(255);

                    p.rect(p.margin.left + x_from + 5,
                        p.height - p.margin.bottom - y_from + 5,
                        p.margin.left + x_to - 5,
                        p.height - p.margin.bottom - y_to - 5,
                        25);

                    //	draw timepoints

                    p.drawTimepoints(p.expanded_data[0].patients[0].states[0].timepoints,
                        p.margin.left + x_from + 5,
                        p.height - p.margin.bottom - y_from + 5,
                        p.margin.left + x_to - 5,
                        p.height - p.margin.bottom - y_to - 5,
                        fill_color);

                    // check for mouse 

                    if (p.mouseX > p.margin.left + x_from + 5 && p.mouseX < p.margin.left + x_to - 5 &&
                        p.mouseY > p.height - p.margin.bottom - y_from + 5 && p.mouseY < p.height - p.margin.bottom - y_to - 5) {

                        tooltip_rat = p.expanded_data[0].patients[0].true_ratio;
                        tooltip_error = p.expanded_data[0].patients[0].error_warning;

                        ids_to_highlight = ids_to_highlight.filter(function(id) {
                            var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[0].patient;
                            return id.startsWith(ref_id);
                        });

                    }
                }
            } else {

                var circleDiam = p.min(x_to - x_from - 10, y_from - y_to - 10);

                if (p.expanded_data[0].patients[0].states.length > 1) {

                    var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[0].states[0].ratio, p.expanded_data[0].patients[0].states[0].negative);
                    var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[0].states[1].ratio, p.expanded_data[0].patients[0].states[1].negative);

                    p.fill(fill_color_top);
                    if (p.brightness(tile_fill_color) > 80) p.stroke(0);
                    else p.stroke(255);

                    p.arc(p.margin.left + (x_from + x_to) / 2,
                        p.height - p.margin.bottom - (y_from + y_to) / 2,
                        circleDiam, circleDiam,
                        p.PI, 0, p.CHORD);

                    p.fill(fill_color_bottom);

                    p.arc(p.margin.left + (x_from + x_to) / 2,
                        p.height - p.margin.bottom - (y_from + y_to) / 2,
                        circleDiam, circleDiam,
                        0, p.PI, p.CHORD);

                    // check for mouse 

                    if (p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, p.height - p.margin.bottom - (y_from + y_to) / 2) < circleDiam / 2 &&
                        p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {

                        tooltip_rat = p.expanded_data[0].patients[0].states[0].true_ratio;
                        tooltip_error = p.expanded_data[0].patients[0].states[0].error_warning;

                        ids_to_highlight = ids_to_highlight.filter(function(id) {
                            var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[0].patient + "_" + p.expanded_data[0].patients[0].states[0].state;
                            return id.startsWith(ref_id);
                        });

                    } else if (p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, p.height - p.margin.bottom - (y_from + y_to) / 2) < circleDiam / 2 &&
                        p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2) {

                        tooltip_rat = p.expanded_data[0].patients[0].states[1].true_ratio;
                        tooltip_error = p.expanded_data[0].patients[0].states[1].error_warning;

                        ids_to_highlight = ids_to_highlight.filter(function(id) {
                            var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[0].patient + "_" + p.expanded_data[0].patients[0].states[1].state;
                            return id.startsWith(ref_id);
                        });
                    }

                } else { // 1 pt 1 voxel 1 state 1 timepoint -> don't draw the circle, don't highlight anything
                    //ids_to_highlight = [];
                    //return;
                }
            }
        } else if (p.expanded_data.length == 1 && p.expanded_data[0].patients.length > 1) { // multiple patients 1 voxel
            var circleDiam = Math.min((y_from - y_to) / p.expanded_data[0].patients.length, (x_to - x_from) * 2 / 3);

            var fill_color_voxel = p.getHeatColor(p.expanded_data[0].ratio, p.expanded_data[0].negative);

            p.fill(fill_color_voxel);
            if (p.brightness(tile_fill_color) > 80) p.stroke(0);
            else p.stroke(255);

            p.rect(p.margin.left + (x_from * 5 + x_to) / 6,
                p.height - p.margin.bottom - y_from,
                p.margin.left + (x_from + x_to * 5) / 6,
                p.height - p.margin.bottom - y_to,
                25);

            // check for mouse 

            if (p.mouseX > p.margin.left + (x_from * 5 + x_to) / 6 && p.margin.left + (x_from + x_to * 5) / 6 &&
                p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {

                tooltip_rat = p.expanded_data[0].true_ratio;
                tooltip_error = p.expanded_data[0].error_warning;

                ids_to_highlight = ids_to_highlight.filter(function(id) {
                    var ref_id = p.expanded_data[0].voxel;
                    return id.startsWith(ref_id);
                });
            }

            if (hasTimepoints) {
                for (var pt = 0; pt < p.expanded_data[0].patients.length; pt++) {
                    if (p.expanded_data[0].patients[pt].states.length > 1) {

                        var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[pt].states[0].ratio, p.expanded_data[0].patients[pt].states[0].negative);
                        var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[pt].states[1].ratio, p.expanded_data[0].patients[pt].states[1].negative);

                        p.fill(fill_color_top);
                        if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
                        else p.stroke(255);

                        var rect_x1 = p.margin.left + (x_from + x_to) / 2 - circleDiam / 2;
                        var rect_x2 = p.margin.left + (x_from + x_to) / 2 + circleDiam / 2;
                        var rect_y1 = p.height - p.margin.bottom - y_from + pt * circleDiam;
                        var rect_y2 = p.height - p.margin.bottom - y_from + (pt + 1) * circleDiam;

                        p.rect(rect_x1,
                            rect_y1,
                            rect_x2,
                            (rect_y1 + rect_y2) / 2,
                            25, 25, 0, 0);

                        p.fill(fill_color_bottom);

                        p.rect(rect_x1,
                            (rect_y1 + rect_y2) / 2,
                            rect_x2,
                            rect_y2,
                            0, 0, 25, 25);

                        //	draw timepoints

                        p.drawTimepoints(p.expanded_data[0].patients[pt].states[0].timepoints,
                            rect_x1,
                            rect_y1,
                            rect_x2,
                            (rect_y1 + rect_y2) / 2,
                            fill_color_top);

                        p.drawTimepoints(p.expanded_data[0].patients[pt].states[1].timepoints,
                            rect_x1,
                            (rect_y1 + rect_y2) / 2,
                            rect_x2,
                            rect_y2,
                            fill_color_bottom);

                        // check for mouse 

                        if (p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
                            p.mouseY > rect_y1 && p.mouseY < (rect_y1 + rect_y2) / 2) {

                            tooltip_rat = p.expanded_data[0].patients[pt].states[0].true_ratio;
                            tooltip_error = p.expanded_data[0].patients[pt].states[0].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[pt].patient + "_" + p.expanded_data[0].patients[pt].states[0].state;
                                return id.startsWith(ref_id);
                            });
                        } else if (p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
                            p.mouseY > (rect_y1 + rect_y2) / 2 && p.mouseY < rect_y1) {

                            tooltip_rat = p.expanded_data[0].patients[pt].states[1].true_ratio;
                            tooltip_error = p.expanded_data[0].patients[pt].states[1].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[pt].patient + "_" + p.expanded_data[0].patients[pt].states[1].state;
                                return id.startsWith(ref_id);
                            });
                        }

                    } else {

                        var fill_color = p.getHeatColor(p.expanded_data[0].patients[pt].ratio, p.expanded_data[0].patients[pt].negative);

                        p.fill(fill_color);
                        if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
                        else p.stroke(255);

                        var rect_x1 = p.margin.left + (x_from + x_to) / 2 - circleDiam / 2;
                        var rect_x2 = p.margin.left + (x_from + x_to) / 2 + circleDiam / 2;
                        var rect_y1 = p.height - p.margin.bottom - y_from + pt * circleDiam;
                        var rect_y2 = p.height - p.margin.bottom - y_from + (pt + 1) * circleDiam;

                        p.rect(rect_x1,
                            rect_y1,
                            rect_x2,
                            rect_y2,
                            25);

                        //	draw timepoints

                        p.drawTimepoints(p.expanded_data[0].patients[pt].states[0].timepoints,
                            rect_x1,
                            rect_y1,
                            rect_x2,
                            rect_y2,
                            fill_color);

                        // check for mouse 

                        if (p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
                            p.mouseY > rect_y1 && p.mouseY < rect_y2) {

                            tooltip_rat = p.expanded_data[0].patients[pt].true_ratio;
                            tooltip_error = p.expanded_data[0].patients[pt].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[pt].patient;
                                return id.startsWith(ref_id);
                            });
                        }
                    }
                }
            } else {
                for (var pt = 0; pt < p.expanded_data[0].patients.length; pt++) {
                    if (p.expanded_data[0].patients[pt].states.length > 1) {

                        var fill_color_top = p.getHeatColor(p.expanded_data[0].patients[pt].states[0].ratio, p.expanded_data[0].patients[pt].states[0].negative);
                        var fill_color_bottom = p.getHeatColor(p.expanded_data[0].patients[pt].states[1].ratio, p.expanded_data[0].patients[pt].states[1].negative);

                        p.fill(fill_color_top);
                        if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
                        else p.stroke(255);

                        var circleCenter_y = p.height - p.margin.bottom - y_from + (pt + 0.5) * circleDiam;

                        p.arc(p.margin.left + (x_from + x_to) / 2,
                            circleCenter_y,
                            circleDiam, circleDiam,
                            p.PI, 0, p.CHORD);

                        p.fill(fill_color_bottom);

                        p.arc(p.margin.left + (x_from + x_to) / 2,
                            circleCenter_y,
                            circleDiam, circleDiam,
                            0, p.PI, p.CHORD);

                        // check for mouse 

                        if (p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, circleCenter_y) < circleDiam / 2 &&
                            p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {

                            tooltip_rat = p.expanded_data[0].patients[pt].states[0].true_ratio;
                            tooltip_error = p.expanded_data[0].patients[pt].states[0].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[pt].patient + "_" + p.expanded_data[0].patients[pt].states[0].state;
                                return id.startsWith(ref_id);
                            });

                        } else if (p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, circleCenter_y) < circleDiam / 2 &&
                            p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2) {

                            tooltip_rat = p.expanded_data[0].patients[pt].states[1].true_ratio;
                            tooltip_error = p.expanded_data[0].patients[pt].states[1].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[pt].patient + "_" + p.expanded_data[0].patients[pt].states[1].state;
                                return id.startsWith(ref_id);
                            });
                        }

                    } else {

                        var fill_color = p.getHeatColor(p.expanded_data[0].patients[pt].ratio, p.expanded_data[0].patients[pt].negative);

                        p.fill(fill_color);
                        if (p.brightness(fill_color_voxel) > 80) p.stroke(0);
                        else p.stroke(255);

                        var circleCenter_y = p.height - p.margin.bottom - y_from + (pt + 0.5) * circleDiam;

                        p.ellipse(p.margin.left + (x_from + x_to) / 2,
                            circleCenter_y,
                            circleDiam, circleDiam);

                        // check for mouse 

                        if (p.dist(p.mouseX, p.mouseY, p.margin.left + (x_from + x_to) / 2, circleCenter_y) < circleDiam / 2) {

                            tooltip_rat = p.expanded_data[0].patients[pt].true_ratio;
                            tooltip_error = p.expanded_data[0].patients[pt].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[0].voxel + "_" + p.expanded_data[0].patients[pt].patient;
                                return id.startsWith(ref_id);
                            });
                        }

                    }
                }
            }
        } else if (p.expanded_data.length > 1) {
            var vox_rect_width = (x_to - x_from) / p.expanded_data.length

            for (var vox = 0; vox < p.expanded_data.length; vox++) {

                var vox_rect_x_from = x_from + vox * vox_rect_width;
                var vox_rect_x_to = x_from + (vox + 1) * vox_rect_width;

                if (p.expanded_data[vox].patients.length == 1) { // multiple voxels 1 patient
                    if (p.expanded_data[vox].patients[0].states.length > 1) {

                        var fill_color_top = p.getHeatColor(p.expanded_data[vox].patients[0].states[0].ratio, p.expanded_data[vox].patients[0].states[0].negative);
                        var fill_color_bottom = p.getHeatColor(p.expanded_data[vox].patients[0].states[1].ratio, p.expanded_data[vox].patients[0].states[0].negative);

                        p.fill(fill_color_top);
                        if (p.brightness(tile_fill_color) > 80) p.stroke(0);
                        else p.stroke(255);

                        p.rect(p.margin.left + vox_rect_x_from,
                            p.height - p.margin.bottom - y_from,
                            p.margin.left + vox_rect_x_to,
                            p.height - p.margin.bottom - (y_from + y_to) / 2,
                            25, 25, 0, 0);

                        p.fill(fill_color_bottom);

                        p.rect(p.margin.left + vox_rect_x_from,
                            p.height - p.margin.bottom - (y_from + y_to) / 2,
                            p.margin.left + vox_rect_x_to,
                            p.height - p.margin.bottom - y_to,
                            0, 0, 25, 25);

                        if (hasTimepoints) {

                            //	draw timepoints

                            p.drawTimepoints(p.expanded_data[vox].patients[0].states[0].timepoints,
                                p.margin.left + vox_rect_x_from,
                                p.height - p.margin.bottom - y_from,
                                p.margin.left + vox_rect_x_to,
                                p.height - p.margin.bottom - (y_from + y_to) / 2,
                                fill_color_top);

                            p.drawTimepoints(p.expanded_data[vox].patients[0].states[1].timepoints,
                                p.margin.left + vox_rect_x_from,
                                p.height - p.margin.bottom - (y_from + y_to) / 2,
                                p.margin.left + vox_rect_x_to,
                                p.height - p.margin.bottom - y_to,
                                fill_color_bottom);

                        }

                        // check for mouse 

                        if (p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
                            p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - (y_from + y_to) / 2) {

                            tooltip_rat = p.expanded_data[vox].patients[0].states[0].true_ratio;
                            tooltip_error = p.expanded_data[vox].patients[0].states[0].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[0].patient + "_" + p.expanded_data[vox].patients[0].states[0].state;
                                return id.startsWith(ref_id);
                            });

                        } else if (p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
                            p.mouseY > p.height - p.margin.bottom - (y_from + y_to) / 2 && p.mouseY < p.height - p.margin.bottom - y_to) {

                            tooltip_rat = p.expanded_data[vox].patients[0].states[1].true_ratio;
                            tooltip_error = p.expanded_data[vox].patients[0].states[1].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[0].patient + "_" + p.expanded_data[vox].patients[0].states[1].state;
                                return id.startsWith(ref_id);
                            });
                        }

                    } else {

                        var fill_color = p.getHeatColor(p.expanded_data[vox].patients[0].ratio, p.expanded_data[vox].patients[0].negative);

                        p.fill(fill_color);
                        if (p.brightness(tile_fill_color) > 80) p.stroke(0);
                        else p.stroke(255);

                        p.rect(p.margin.left + vox_rect_x_from,
                            p.height - p.margin.bottom - y_from,
                            p.margin.left + vox_rect_x_to,
                            p.height - p.margin.bottom - y_to,
                            25);

                        if (hasTimepoints) {

                            //	draw timepoints

                            p.drawTimepoints(p.expanded_data[vox].patients[0].states[0].timepoints,
                                p.margin.left + vox_rect_x_from,
                                p.height - p.margin.bottom - y_from,
                                p.margin.left + vox_rect_x_to,
                                p.height - p.margin.bottom - y_to,
                                fill_color);
                        }

                        if (p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
                            p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {

                            tooltip_rat = p.expanded_data[vox].patients[0].true_ratio;
                            tooltip_error = p.expanded_data[vox].patients[0].error_warning;

                            ids_to_highlight = ids_to_highlight.filter(function(id) {
                                var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[0].patient;
                                return id.startsWith(ref_id);
                            });

                        }
                    }


                } else { // multiple voxels multiple patients

                    var fill_color = p.getHeatColor(p.expanded_data[vox].ratio, p.expanded_data[vox].negative);

                    p.fill(fill_color);
                    if (p.brightness(tile_fill_color) > 80) p.stroke(0);
                    else p.stroke(255);

                    p.rect(p.margin.left + vox_rect_x_from,
                        p.height - p.margin.bottom - y_from,
                        p.margin.left + vox_rect_x_to,
                        p.height - p.margin.bottom - y_to,
                        25);

                    // check the mouse

                    if (p.mouseX > p.margin.left + vox_rect_x_from && p.mouseX < p.margin.left + vox_rect_x_to &&
                        p.mouseY > p.height - p.margin.bottom - y_from && p.mouseY < p.height - p.margin.bottom - y_to) {

                        tooltip_rat = p.expanded_data[vox].true_ratio;
                        tooltip_error = p.expanded_data[vox].error_warning;

                        ids_to_highlight = ids_to_highlight.filter(function(id) {
                            var ref_id = p.expanded_data[vox].voxel;
                            return id.startsWith(ref_id);
                        });
                    }

                    var col_size = 6;

                    var circleCols = Math.ceil(p.expanded_data[vox].patients.length / col_size);

                    var circleDiam = Math.min((y_from - y_to - 10) / (Math.min(p.expanded_data[vox].patients.length, col_size)), (vox_rect_x_to - vox_rect_x_from - 5));
                    var circleDiam2 = Math.min((y_from - y_to) / (Math.min(p.expanded_data[vox].patients.length, col_size)), (vox_rect_x_to - vox_rect_x_from - 5));

                    var col_width = (vox_rect_x_to - vox_rect_x_from) / circleCols;

                    var corner_diam = 50 / Math.max(2, Math.min(p.expanded_data[vox].patients.length, col_size));

                    for (var pt = 0; pt < p.expanded_data[vox].patients.length; pt++) {

                        var current_col = Math.floor(pt / col_size);
                        var circleMid_x = p.margin.left + vox_rect_x_from + col_width * (current_col + 0.5);

                        if (hasTimepoints) {

                            var rect_x1 = circleMid_x - circleDiam2 / 2;
                            var rect_x2 = circleMid_x + circleDiam2 / 2;
                            var rect_y1 = p.height - p.margin.bottom - y_from + (pt % col_size) * circleDiam2;
                            var rect_y2 = p.height - p.margin.bottom - y_from + (pt % col_size + 1) * circleDiam2;

                            if (p.expanded_data[vox].patients[pt].states.length > 1) {

                                var fill_color_top = p.getHeatColor(p.expanded_data[vox].patients[pt].states[0].ratio, p.expanded_data[vox].patients[pt].states[0].negative);
                                var fill_color_bottom = p.getHeatColor(p.expanded_data[vox].patients[pt].states[1].ratio, p.expanded_data[vox].patients[pt].states[1].negative);

                                p.fill(fill_color_top);
                                if (p.brightness(fill_color) > 80) p.stroke(0);
                                else p.stroke(255);

                                p.rect(rect_x1,
                                    rect_y1,
                                    rect_x2,
                                    (rect_y1 + rect_y2) / 2,
                                    corner_diam, corner_diam, 0, 0);

                                p.fill(fill_color_bottom);

                                p.rect(rect_x1,
                                    (rect_y1 + rect_y2) / 2,
                                    rect_x2,
                                    rect_y2,
                                    0, 0, corner_diam, corner_diam);

                                //	draw timepoints

                                p.drawTimepoints(p.expanded_data[vox].patients[pt].states[0].timepoints,
                                    rect_x1,
                                    rect_y1,
                                    rect_x2,
                                    (rect_y1 + rect_y2) / 2,
                                    fill_color_top);

                                p.drawTimepoints(p.expanded_data[vox].patients[pt].states[1].timepoints,
                                    rect_x1,
                                    (rect_y1 + rect_y2) / 2,
                                    rect_x2,
                                    rect_y2,
                                    fill_color_bottom);

                                // check for mouse 

                                if (p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
                                    p.mouseY > rect_y1 && p.mouseY < (rect_y1 + rect_y2) / 2) {

                                    tooltip_rat = p.expanded_data[vox].patients[pt].states[0].true_ratio;
                                    tooltip_error = p.expanded_data[vox].patients[pt].states[0].error_warning;

                                    ids_to_highlight = ids_to_highlight.filter(function(id) {
                                        var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[pt].patient + "_" + p.expanded_data[vox].patients[pt].states[0].state;
                                        return id.startsWith(ref_id);
                                    });

                                } else if (p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
                                    p.mouseY > (rect_y1 + rect_y2) / 2 && p.mouseY < rect_y2) {

                                    tooltip_rat = p.expanded_data[vox].patients[pt].states[1].true_ratio;
                                    tooltip_error = p.expanded_data[vox].patients[pt].states[1].error_warning;

                                    ids_to_highlight = ids_to_highlight.filter(function(id) {
                                        var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[pt].patient + "_" + p.expanded_data[vox].patients[pt].states[1].state;
                                        return id.startsWith(ref_id);
                                    });
                                }

                            } else {
                                var fill_color = p.getHeatColor(p.expanded_data[vox].patients[pt].ratio, p.expanded_data[vox].patients[pt].negative);

                                p.fill(fill_color);
                                if (p.brightness(fill_color) > 80) p.stroke(0);
                                else p.stroke(255);

                                p.rect(rect_x1,
                                    rect_y1,
                                    rect_x2,
                                    rect_y2,
                                    corner_diam);

                                //	draw timepoints

                                p.drawTimepoints(p.expanded_data[vox].patients[pt].states[0].timepoints,
                                    rect_x1,
                                    rect_y1,
                                    rect_x2,
                                    rect_y2,
                                    fill_color);

                                // check for mouse

                                if (p.mouseX > rect_x1 && p.mouseX < rect_x2 &&
                                    p.mouseY > rect_y1 && p.mouseY < rect_y2) {

                                    tooltip_rat = p.expanded_data[vox].patients[pt].true_ratio;
                                    tooltip_error = p.expanded_data[vox].patients[pt].error_warning;

                                    ids_to_highlight = ids_to_highlight.filter(function(id) {
                                        var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[pt].patient;
                                        return id.startsWith(ref_id);
                                    });

                                }
                            }
                        } else {
                            if (p.expanded_data[vox].patients[pt].states.length > 1) {

                                var fill_color_top = p.getHeatColor(p.expanded_data[vox].patients[pt].states[0].ratio, p.expanded_data[vox].patients[pt].states[0].negative);
                                var fill_color_bottom = p.getHeatColor(p.expanded_data[vox].patients[pt].states[1].ratio, p.expanded_data[vox].patients[pt].states[1].negative);

                                p.fill(fill_color_top);
                                if (p.brightness(fill_color) > 80) p.stroke(0);
                                else p.stroke(255);

                                p.arc(circleMid_x,
                                    p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2,
                                    circleDiam, circleDiam,
                                    p.PI, 0, p.CHORD);

                                p.fill(fill_color_bottom);

                                p.arc(circleMid_x,
                                    p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2,
                                    circleDiam, circleDiam,
                                    0, p.PI, p.CHORD);

                                // check for mouse 

                                if (p.dist(p.mouseX, p.mouseY, circleMid_x, p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) < circleDiam2 / 2 &&
                                    p.mouseY < p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) {

                                    tooltip_rat = p.expanded_data[vox].patients[pt].states[0].true_ratio;
                                    tooltip_error = p.expanded_data[vox].patients[pt].states[0].error_warning;

                                    ids_to_highlight = ids_to_highlight.filter(function(id) {
                                        var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[pt].patient + "_" + p.expanded_data[vox].patients[pt].states[0].state;
                                        return id.startsWith(ref_id);
                                    });

                                } else if (p.dist(p.mouseX, p.mouseY, circleMid_x, p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) < circleDiam2 / 2 &&
                                    p.mouseY > p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) {

                                    tooltip_rat = p.expanded_data[vox].patients[pt].states[1].true_ratio;
                                    tooltip_error = p.expanded_data[vox].patients[pt].states[1].error_warning;

                                    ids_to_highlight = ids_to_highlight.filter(function(id) {
                                        var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[pt].patient + "_" + p.expanded_data[vox].patients[pt].states[1].state;
                                        return id.startsWith(ref_id);
                                    });
                                }

                            } else {
                                var fill_color = p.getHeatColor(p.expanded_data[vox].patients[pt].ratio, p.expanded_data[vox].patients[pt].negative);

                                p.fill(fill_color);
                                if (p.brightness(fill_color) > 80) p.stroke(0);
                                else p.stroke(255);

                                p.ellipse(circleMid_x,
                                    p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2,
                                    circleDiam, circleDiam);

                                // check for mouse 

                                if (p.dist(p.mouseX, p.mouseY, circleMid_x, p.height - p.margin.bottom - y_from + (pt % col_size + 0.5) * circleDiam2) < circleDiam2 / 2) {

                                    tooltip_rat = p.expanded_data[vox].patients[pt].true_ratio;
                                    tooltip_error = p.expanded_data[vox].patients[pt].error_warning;

                                    ids_to_highlight = ids_to_highlight.filter(function(id) {
                                        var ref_id = p.expanded_data[vox].voxel + "_" + p.expanded_data[vox].patients[pt].patient;
                                        return id.startsWith(ref_id);
                                    });

                                }
                            }
                        }
                    }
                }
            }
        }

        ids_to_highlight.forEach(function(id) {
            p.highlightVoxel(id.split("_")[4]);
        });

        if (tooltip_rat != -1) {
            p.drawTooltipRatio(tooltip_rat, tooltip_error);
        } else if (mouse_over_tile) {
            //	get the ratio between X and Y integrals

            var tile_avg_x = 0,
                tile_avg_y = 0;
            var error_warning = false;    
            for (var gx of p.xGroups) {
                if (voxel_groups[gx].available_metabolites.includes(p.xMetabolites[p.tileExpanded.x])) {
                    tile_avg_x += voxel_groups[gx].metabolite_averages[p.xMetabolites[p.tileExpanded.x]].concentration;
                    error_warning = (error_warning || voxel_groups[gx].metabolite_averages[p.xMetabolites[p.tileExpanded.x]].CRLB_percent > CRLB_WARNING_VAL);
                }
            }
            for (var gy of p.yGroups) {
                if (voxel_groups[gy].available_metabolites.includes(p.yMetabolites[p.tileExpanded.y])) {
                    tile_avg_y += voxel_groups[gy].metabolite_averages[p.yMetabolites[p.tileExpanded.y]].concentration;
                    error_warning = (error_warning || voxel_groups[gy].metabolite_averages[p.yMetabolites[p.tileExpanded.y]].CRLB_percent > CRLB_WARNING_VAL);
                }
            }

            tile_avg_x /= p.xGroups.length;
            tile_avg_y /= p.yGroups.length;

            // true ratio value for display

            var rat = tile_avg_x / tile_avg_y;

            // 	show ratio as tooltip				

            p.drawTooltipRatio(rat, error_warning);
        }

        p5_view_L.updateScene(); // highlight in left view
        updateDataTable();
        updateSelectionPanel();
    }

    p.drawTimepoints = function(timepoints, x_from, y_from, x_to, y_to, bg_color /*, min_rat, max_rat*/ ) {

        var line_len = ((x_to - x_from) * 0.8) / (timepoints.length - 1);
        var circle_diam = Math.min(8, line_len / 4);

        if (p.brightness(bg_color) > 80) {
            p.fill(0);
            p.stroke(0);
        } else {
            p.fill(255);
            p.stroke(255);
        }

        var x_prev, y_prev;

        for (var i = 0; i < timepoints.length; i++) {
            var y_pos = p.constrain(p.map(timepoints[i].ratio, -10, 10, y_to - 5, y_from + 5), y_from + 5, y_to - 5);
            var x_pos;
            if (timepoints.length % 2 == 1) {
                x_pos = (x_to + x_from) / 2 + (i - Math.floor(timepoints.length / 2)) * line_len;
            } else {
                x_pos = (x_to + x_from) / 2 + (i - (timepoints.length / 2 - 0.5)) * line_len;
            }

            p.ellipse(x_pos, y_pos, circle_diam, circle_diam);

            if (i > 0) {
                p.line(x_prev, y_prev, x_pos, y_pos);
            }

            x_prev = x_pos;
            y_prev = y_pos;
        }

    }

    p.highlightVoxel = function(vox_id) {
        var idx = selected_voxels.findIndex(function(elem) {
            return elem.vox_id == vox_id;
        });

        selected_voxels[idx].highlighted = true;
    };

    // CHANGES from JULI
    p.drawXValues = function() {
        var y_base = p.height - p.margin.bottom + 10;
        var maxRectHeight = p.margin.bottom * 0.7;
        var maxDeviationHeight = p.margin.bottom * 0.25;
        var hairSize = p.cellSize.x * 0.2;

        for (var x = 0; x < p.xMetabolites.length; x++) {

            var concentration_avg = 0,
                stddev_avg = 0;

            let median = 0,
                min = 0,
                max = 0,
                q1 = 0,
                q3 = 0;
            let draw_box_plot = false;
            let draw_range = false;

            for (var gx of p.xGroups) {

                if (voxel_groups[gx].voxels.length > 1) {
                    draw_range = true;
                }
                if (voxel_groups[gx].voxels.length > 4) {
                    draw_box_plot = true;
                }
                if (voxel_groups[gx].available_metabolites.includes(p.xMetabolites[x])) {
                    concentration_avg += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].concentration;
                    stddev_avg += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].std_deviation;

                    median += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].median;
                    min += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].min;
                    max += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].max;
                    q1 += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].q1;
                    q3 += voxel_groups[gx].metabolite_averages[p.xMetabolites[x]].q3;

                }
            }

            concentration_avg /= p.xGroups.length;
            stddev_avg /= p.xGroups.length;

            median /= p.xGroups.length;
            min /= p.xGroups.length;
            max /= p.xGroups.length;
            q1 /= p.xGroups.length;
            q3 /= p.xGroups.length;

            var rectHeight = p.map(concentration_avg, 0, 1, 0, maxRectHeight);
            var deviationHeight = p.map(stddev_avg, 0, 1, 0, maxDeviationHeight);

            // draw the rectangle bar
            p.noStroke();
            p.fill(133);

            p.rect(p.margin.left + p.trueTicksPos.x[x], y_base, p.margin.left + p.trueTicksPos.x[x + 1], y_base + rectHeight);

            // label the metabolite
            var textSize = p.constrain(p.cellSize.x * 0.65 * p.xScales[x], 11, 18);
            p.textSize(textSize);
            p.textAlign(p.CENTER, p.CENTER);
            p.noStroke();

            p.push();
            var textWidth = p.textWidth(p.xMetabolites[x]);


            let textpos = rectHeight;

            if (draw_box_plot) {
                textpos = p.map(q3, 0, 1, 0, maxRectHeight);
            }
            if (draw_range) {
                textpos = p.map(max, 0, 1, 0, maxRectHeight);
            }

            if (textWidth < rectHeight * 0.7) {

                var text_x = p.margin.left + (p.trueTicksPos.x[x] + p.trueTicksPos.x[x + 1]) / 2;
                var text_y = y_base + textpos / 2;

                p.translate(text_x, text_y);
                p.rotate(p.HALF_PI);

                p.fill(255);
                p.text(p.xMetabolites[x], 0, 0);
            } else {

                var text_x = p.margin.left + (p.trueTicksPos.x[x] + p.trueTicksPos.x[x + 1]) / 2;
                var text_y = y_base + textpos + deviationHeight / 2 + 7 + textWidth / 2;

                p.translate(text_x, text_y);
                p.rotate(p.HALF_PI);

                p.fill(0);
                p.text(p.xMetabolites[x], 0, 0);
            }

            p.pop();

            p.stroke(51);

            // draw the boxplot!
            // check at first if there are more than 5 voxels selected
            if (draw_box_plot) {
                // Show the box
                // draw the rectangle
                p.stroke(51);
                p.fill("white");


                let q3_pos = p.map(q3, 0, 1, 0, maxRectHeight);
                let q1_pos = p.map(q1, 0, 1, 0, maxRectHeight);
                let median_pos = p.map(median, 0, 1, 0, maxRectHeight);

                // boxplot rectangle
                p.rect(p.margin.left + p.trueTicksPos.x[x], y_base + q3_pos, p.margin.left + p.trueTicksPos.x[x + 1], y_base + q1_pos);


                // horizontal line median
                p.line(p.margin.left + p.trueTicksPos.x[x],
                    y_base + median_pos,
                    p.margin.left + p.trueTicksPos.x[x + 1],
                    y_base + median_pos);
            }

            if (draw_range) {
                let min_pos = p.map(min, 0, 1, 0, maxRectHeight);
                let max_pos = p.map(max, 0, 1, 0, maxRectHeight);


                textpos = max_pos;

                // horizontal line max
                p.line(p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 - hairSize / 2,
                    y_base + max_pos,
                    p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 + hairSize / 2,
                    y_base + max_pos);

                // horizontal line min
                p.line(p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 - hairSize / 2,
                    y_base + min_pos,
                    p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 + hairSize / 2,
                    y_base + min_pos);

                //vertical line

                p.line(p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5,
                    y_base + max_pos,
                    p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5,
                    y_base + min_pos);

            }


            // draw the std. deviation hairs			
            /* p.noFill();
            p.stroke(0);
            p.strokeWeight(1.5);

            p.line(p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 - hairSize / 2, y_base + rectHeight + deviationHeight * 0.5, p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 + hairSize / 2, y_base + rectHeight + deviationHeight * 0.5);
            p.line(p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 - hairSize / 2, y_base + rectHeight - deviationHeight * 0.5, p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5 + hairSize / 2, y_base + rectHeight - deviationHeight * 0.5);
            p.line(p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5, y_base + rectHeight - deviationHeight * 0.5, p.margin.left + p.trueTicksPos.x[x] + p.cellSize.x * p.xScales[x] * 0.5, y_base + rectHeight + deviationHeight * 0.5);
*/
        }
    };

    p.drawYValues = function() {
        var x_base = p.margin.left - 10;
        var maxRectHeight = p.margin.left * 0.7;
        var maxDeviationHeight = p.margin.left * 0.25;
        var hairSize = p.cellSize.y * 0.2;

        for (var y = 0; y < p.yMetabolites.length; y++) {

            var concentration_avg = 0,
                stddev_avg = 0;

            let median = 0,
                min = 0,
                max = 0,
                q1 = 0,
                q3 = 0;
            let draw_box_plot = false;
            let draw_range = false;

            for (var gy of p.yGroups) {

                if (voxel_groups[gy].voxels.length > 1) {
                    draw_range = true;
                }

                if (voxel_groups[gy].voxels.length > 4) {
                    draw_box_plot = true;
                }

                if (voxel_groups[gy].available_metabolites.includes(p.yMetabolites[y])) {
                    concentration_avg += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].concentration;
                    stddev_avg += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].std_deviation;

                    median += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].median;
                    min += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].min;
                    max += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].max;
                    q1 += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].q1;
                    q3 += voxel_groups[gy].metabolite_averages[p.yMetabolites[y]].q3;
                }
            }

            concentration_avg /= p.yGroups.length;
            stddev_avg /= p.yGroups.length;

            median /= p.xGroups.length;
            min /= p.xGroups.length;
            max /= p.xGroups.length;
            q1 /= p.xGroups.length;
            q3 /= p.xGroups.length;


            var rectHeight = p.map(concentration_avg, 0, 1, 0, maxRectHeight);
            var deviationHeight = p.map(stddev_avg, 0, 1, 0, maxDeviationHeight);

            p.noStroke();
            p.fill(133); // TODO

            p.rect(x_base - rectHeight, p.height - p.margin.bottom - p.trueTicksPos.y[y], x_base, p.height - p.margin.bottom - p.trueTicksPos.y[y + 1]);

            // label the metabolite
            var textSize = p.constrain(p.cellSize.y * 0.65 * p.yScales[y], 11, 18);
            p.textSize(textSize);
            p.textAlign(p.CENTER, p.CENTER);
            p.noStroke();

            var textWidth = p.textWidth(p.yMetabolites[y]);
            let text_pos = rectHeight;

            if (draw_box_plot) {
                text_pos = p.map(q3, 0, 1, 0, maxRectHeight);
            }
            if (draw_range) {
                text_pos = p.map(max, 0, 1, 0, maxRectHeight);
            }


            if (textWidth < rectHeight * 0.7) {

                var text_x = x_base - text_pos / 2;
                var text_y = p.height - p.margin.bottom - (p.trueTicksPos.y[y] + p.trueTicksPos.y[y + 1]) / 2;

                p.fill(255);
                p.text(p.yMetabolites[y], text_x, text_y);
            } else {

                var text_x = x_base - text_pos - deviationHeight / 2 - textWidth / 2 - 7;
                var text_y = p.height - p.margin.bottom - (p.trueTicksPos.y[y] + p.trueTicksPos.y[y + 1]) / 2;

                p.fill(0);
                p.text(p.yMetabolites[y], text_x, text_y);
            }

            // p.noFill();
            // p.stroke(0);
            // p.strokeWeight(1.5);

            // p.line(x_base - rectHeight - deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 - hairSize / 2, x_base - rectHeight - deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 + hairSize / 2);
            // p.line(x_base - rectHeight + deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 - hairSize / 2, x_base - rectHeight + deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 + hairSize / 2);
            // p.line(x_base - rectHeight - deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5, x_base - rectHeight + deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5);


            p.stroke(51);

            // draw the boxplot!
            // check at first if there are more than 5 voxels selected
            if (draw_box_plot) {
                // Show the box
                // draw the rectangle
                p.stroke(51);
                p.fill("white");



                let q3_pos = p.map(q3, 0, 1, 0, maxRectHeight);
                let q1_pos = p.map(q1, 0, 1, 0, maxRectHeight);
                let median_pos = p.map(median, 0, 1, 0, maxRectHeight);

                text_pos = q3_pos;
                //p.rect(p.margin.left + p.trueTicksPos.x[x], y_base, p.margin.left + p.trueTicksPos.x[x + 1], y_base + rectHeight);

                //p.rect(x_base - rectHeight, p.height - p.margin.bottom - p.trueTicksPos.y[y], x_base, p.height - p.margin.bottom - p.trueTicksPos.y[y + 1]);

                // boxplot rectangle
                p.rect(x_base - q3_pos, p.height - p.margin.bottom - p.trueTicksPos.y[y], x_base - q1_pos, p.height - p.margin.bottom - p.trueTicksPos.y[y + 1]);


                // vertical line median
                p.line(x_base - median_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y],
                    x_base - median_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y + 1]);
            }


            if (draw_range) {
                let min_pos = p.map(min, 0, 1, 0, maxRectHeight);
                let max_pos = p.map(max, 0, 1, 0, maxRectHeight);

                // p.line(x_base - rectHeight - deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 - hairSize / 2, x_base - rectHeight - deviationHeight * 0.5, p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 + hairSize / 2);


                text_pos = max_pos;

                // vertical line max
                p.line(x_base - max_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 - hairSize / 2,
                    x_base - max_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 + hairSize / 2);


                // p.cellSize.y
                // vertical line min
                p.line(x_base - min_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 - hairSize / 2,
                    x_base - min_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5 + hairSize / 2);


                //horizontal line
                p.line(x_base - max_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5,
                    x_base - min_pos,
                    p.height - p.margin.bottom - p.trueTicksPos.y[y] - p.cellSize.y * p.yScales[y] * 0.5);
            }
        }
    };

    // END CHANGES from Juli

    p.mouseOverTile = function(x, y) {
        //	get coordinates of the tile
        var x_from = p.trueTicksPos.x[x];
        var x_to = p.trueTicksPos.x[x + 1];
        var y_from = p.trueTicksPos.y[y + 1];
        var y_to = p.trueTicksPos.y[y];

        p.stroke(0, 100, 50);
        p.line(p.margin.left + x_from, p.height - p.margin.bottom - y_from, p.margin.left + x_from, p.height - 30);
        p.line(p.margin.left + x_to, p.height - p.margin.bottom - y_from, p.margin.left + x_to, p.height - 30);
        p.line(20, p.height - p.margin.bottom - y_from, p.margin.left + x_to, p.height - p.margin.bottom - y_from);
        p.line(20, p.height - p.margin.bottom - y_to, p.margin.left + x_to, p.height - p.margin.bottom - y_to);

        /*p.fill(255, 180);
        p.noStroke();
        p.rectMode(p.CORNER);
        var textLength = p.textWidth("0.000") * 1.2;
		
        p.rect((2 * p.margin.left + x_from + x_to) / 2 - textLength/2, p.height - 22 - 8, textLength, 16);
        p.rect(30 - textLength/2, (2 * p.height - 2 * p.margin.bottom - y_from - y_to) / 2 - 8, textLength, 16);
		
        p.rectMode(p.CORNERS);
		
        p.noStroke();
        p.fill(0);
        p.textFont("Arial", 12);
		
        p.text(tile_int_x.toFixed(3), (2 * p.margin.left + x_from + x_to) / 2, p.height - 22);
        p.text(tile_int_y.toFixed(3), 30, (2 * p.height - 2 * p.margin.bottom - y_from - y_to) / 2);*/

    }

    p.expandTile = function() {

        var scaleRatioX = 0.5; // portion of the grid space the expanded tile will take up
        var scaleRatioY = 0.5;

        var shrink_x = (p.axisLength.x * (1 - scaleRatioX)) / (p.xMetabolites.length - 1);
        var shrink_y = (p.axisLength.y * (1 - scaleRatioY)) / (p.yMetabolites.length - 1);

        if (p.xMetabolites.length > 1) {
            for (var i = 0; i < p.xMetabolites.length; i++) {
                if (i != p.tileExpanded.x) p.xScales[i] = shrink_x / p.cellSize.x;
                else p.xScales[i] = (p.axisLength.x * scaleRatioX) / p.cellSize.x;
            }
        }

        if (p.yMetabolites.length > 1) {
            for (var i = 0; i < p.yMetabolites.length; i++) {
                if (i != p.tileExpanded.y) p.yScales[i] = shrink_y / p.cellSize.y;
                else p.yScales[i] = (p.axisLength.y * scaleRatioY) / p.cellSize.y;
            }
        }

        // update axis ticks		
        p.drawXAxis();
        p.drawYAxis();

        p.mouseMoved();
    }

    // "value" is represented as the symmetric ratio of absolute values -> indication whether the result will be negative is needed
    p.getHeatColor = function(value, negative) {
        var mapped_value = p.constrain(p.map(value, heatmap_limits[0], heatmap_limits[1], 0, 1), 0, 1);
		var blank = p.color(100, 100, 100); // declare the off color to use when results are not real numbers
		
        var c;
        if (!negative) c = color_schemes[0](mapped_value);
        else c = color_schemes[1](mapped_value);
		
		// since the "value" is always the larger divided by the smaller value, if one of those is 0, the result is NaN
		// 0 here represents a ratio == 1, so the condition for value == 0 had to be removed (0 is meaningful inthis case)
		
		if (isFinite(value)) {		
			return p.color(c);
		} else {
			return blank;
		}
    }

    p.buttonClicked = function(i) {
        switch (i) {
            case 0: // reset view
                p.activeDataAxis = -1;
                p.resetView();
                p.updateScene();
                break;
            case 1: // clear data
                p.xMetabolites = [];
                p.yMetabolites = [];
                p.xGroups = []; 	
                p.yGroups = []; 	
                p.updateScene();
                break;
            default: // remove active metabolite
                if (p.activeDataAxis == 0) {
                    p.xMetabolites.splice(p.activeMetabolite, 1);
                } else if (p.activeDataAxis == 1) {
                    p.yMetabolites.splice(p.activeMetabolite, 1);
                }

                p.resetView();
                p.updateScene();
                break;
        }
    }

    p.showRemoveButton = function() {

        // if other remove button is displayed don't keep it there
        p.my_buttons = [{ caption: "Reset view", position: { x: p.width * 0.85, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } },
            { caption: "Clear data", position: { x: 0, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } }
        ];

        var buttonSize = { x: 110, y: 20 };

        if (p.xMetabolites.length > 0 && p.mouseX > p.margin.left && p.mouseY > p.height - p.margin.bottom && p.mouseX < p.width - p.margin.right && p.mouseY < p.height) {

            // see which metabolite the user is pointing at
            p.activeMetabolite = -1;
            for (var x = 0; x < p.trueTicksPos.x.length; x++) {
                if (p.mouseX - p.margin.left < p.trueTicksPos.x[x]) {
                    p.activeMetabolite = x - 1;
                    break;
                }
            }

            if (p.activeMetabolite == -1) return;

            // show the option to remove it
            var metabName = p.xMetabolites[p.activeMetabolite];
            p.my_buttons.push({
                caption: "Remove " + metabName,
                position: { x: p.mouseX - buttonSize.x, y: p.mouseY },
                size: buttonSize
            });

            p.activeDataAxis = 0;
            p.updateScene();
            return;

        } else if (p.yMetabolites.length > 0 && p.mouseX > 0 && p.mouseY > p.margin.top && p.mouseX < p.margin.left && p.mouseY < p.height - p.margin.bottom) {

            // see which metabolite the user is pointing at
            p.activeMetabolite = -1;
            for (var y = p.trueTicksPos.y.length - 2; y >= 0; y--) {
                if (p.mouseY < (p.height - p.margin.bottom - p.trueTicksPos.y[y])) {
                    p.activeMetabolite = y;
                    break;
                }
            }

            if (p.activeMetabolite == -1) return;

            // show the option to remove it
            var metabName = p.yMetabolites[p.activeMetabolite];
            p.my_buttons.push({
                caption: "Remove " + metabName,
                position: { x: p.mouseX, y: p.mouseY },
                size: buttonSize
            });

            p.activeDataAxis = 1;
            p.updateScene();

            return; // don't do anything else on right click

        } else {
            p.activeDataAxis = -1;
        }
    }

    p.mouseClicked = function() {
        if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return; // skip all mouse events when outside of the window

        p.my_buttons = [{ caption: "Reset view", position: { x: p.width * 0.85, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } },
            { caption: "Clear data", position: { x: 0, y: p.height * 0.95 }, size: { x: p.width * 0.15 - 2, y: p.height * 0.05 - 2 } }
        ];

        // handle buttons

        if (p.activeButton != -1) {
            p.buttonClicked(p.activeButton);
            return;
        } else {
            p.activeDataAxis = -1;
            p.updateScene();
        }

        // tile expansion

        if (p.mouseX > p.margin.left && p.mouseX < p.width - p.margin.right && p.mouseY > p.margin.top && p.mouseY < p.height - p.margin.bottom) {
            var to_expand = { x: -1, y: -1 };

            for (var x = 0; x < p.trueTicksPos.x.length; x++) {
                if (p.mouseX - p.margin.left < p.trueTicksPos.x[x]) {
                    to_expand.x = x - 1;
                    break;
                }
            }

            for (var y = p.trueTicksPos.y.length - 2; y >= 0; y--) {
                if (p.mouseY < (p.height - p.margin.bottom - p.trueTicksPos.y[y])) {
                    to_expand.y = y;
                    break;
                }
            }

            // close if already expanded
            if (to_expand.x == p.tileExpanded.x && to_expand.y == p.tileExpanded.y) {
                p.tileExpanded.x = -1;
                p.tileExpanded.y = -1;

                for (var i = 0; i < p.xMetabolites.length; i++) {
                    p.xScales[i] = 1;
                }
                for (var i = 0; i < p.yMetabolites.length; i++) {
                    p.yScales[i] = 1;
                }

                p.mouseMoved();
                p5_view_L.updateScene(); // also update scene if nothing is highlighted anymore
            } else {

                p.tileExpanded = to_expand;
            }

            if (p.tileExpanded.x != -1 && p.tileExpanded.y != -1) {

                p.expandTile();
            }

        }
    }

    p.mousePressed = function() {
        if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return; // skip all mouse events when outside of the window
        p.mousePrevX = p.mouseX;
        p.mousePrevY = p.mouseY;

        // remove voxels from axis - show options

        if (p.mouseButton == p.RIGHT) {
            p.showRemoveButton();
        }
    }

    p.doubleClicked = function() {
        p.showRemoveButton();
    }

    p.mouseMoved = function() {
        if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) {

			selected_voxels = [];
			p5_view_L.updateScene();
			return;
		}

		// mouse inside window -> show all spectra
		var groups_to_collapse = [];
        for (var x of p.xGroups) {
            groups_to_collapse.push(voxel_groups[x]);
        }
        for (var y of p.yGroups) {
            if (!p.xGroups.includes(y)) groups_to_collapse.push(voxel_groups[y]);
        }

        // get voxels from all groups together and sort them (see voxel_groups.js for function definition)
        selected_voxels = collapseAndSort(groups_to_collapse);
		p5_view_L.updateScene();

        // check if mouse is over a button - can be done even with incomplete data

        p.activeButton = -1;

        for (var i = 0; i < p.my_buttons.length; i++) {
            if (p.mouseX > p.my_buttons[i].position.x && p.mouseY > p.my_buttons[i].position.y &&
                p.mouseX < p.my_buttons[i].position.x + p.my_buttons[i].size.x && p.mouseY < p.my_buttons[i].position.y + p.my_buttons[i].size.y) {

                p.activeButton = i;
                break;
            }
        }

        if (p.xMetabolites.length == 0 || p.yMetabolites.length == 0) {
            if (p.activeButton == -1) p.cursor(p.ARROW, 32, 32);
            else p.cursor(p.HAND, 32, 32);
            return;
        }

        // check if mouse is over a tile 

        var tile_x = -1,
            tile_y = -1;

        if (p.mouseX > p.margin.left && p.mouseX < p.width - p.margin.right && p.mouseY > p.margin.top && p.mouseY < p.height - p.margin.bottom) {
            for (var x = 0; x < p.trueTicksPos.x.length; x++) {
                if (p.mouseX - p.margin.left < p.trueTicksPos.x[x]) {
                    tile_x = x - 1;
                    break;
                }
            }

            for (var y = p.trueTicksPos.y.length - 2; y >= 0; y--) {
                if (p.mouseY < (p.height - p.margin.bottom - p.trueTicksPos.y[y])) {
                    tile_y = y;
                    break;
                }
            }
        }

        // react
        if (p.activeButton != -1) {
            p.cursor(p.HAND, 32, 32);
        } else if (tile_x != -1 && tile_y != -1) {
            p.updateScene();
            p.mouseOverTile(tile_x, tile_y);
            p.cursor(p.CROSS, 16, 16);
        } else {
            p.updateScene();
            p.cursor(p.ARROW, 32, 32);
        }

        // display info about metabolites

        //	TODO
    }
};

// prevent default behavior on right click
$("#viewR").contextmenu(function(evt) {
    evt.preventDefault();
});