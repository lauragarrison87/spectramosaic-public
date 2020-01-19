/*var available_metabolites = []; // metabolites with value in at least one of the selected voxels
var metabolite_averages = {}; // average concentration and std. deviation of metabolites across selected voxels


function getAvailableMetabolites() { // should be called every time a voxel is added to / removed from the selection
    available_metabolites = [];

    selected_voxels.forEach(function(elem) {
        Object.keys(elem.values_orig).forEach(function(key) {
            if (key.includes("results")) {
                if (elem.values_orig[key].concentration >= 0.0) { //add even the 0 value voxels for consistency
                    var metabolite = key.split("_results")[0];

                    if (!available_metabolites.includes(metabolite)) {
                        available_metabolites.push(metabolite);
                    }
                }
            }
        });
    });

    updateMetaboliteList();
    countMetaboliteAverages();
}

function countMetaboliteAverages() {
    metabolite_averages = {};

    if (selected_voxels.length == 0 || available_metabolites.length == 0) return;

    available_metabolites.forEach(function(metabolite) {
        metabolite_averages[metabolite] = {
            concentration: 0,
            std_deviation: 0
        };
    });

    selected_voxels.forEach(function(voxel) {
        available_metabolites.forEach(function(metabolite) {
            metabolite_averages[metabolite].concentration += voxel.values_orig[metabolite + "_results"].concentration;
            metabolite_averages[metabolite].std_deviation += voxel.values_orig[metabolite + "_results"].std_deviation;
        });
    });

    available_metabolites.forEach(function(metabolite) {
        metabolite_averages[metabolite].concentration /= selected_voxels.length;
        metabolite_averages[metabolite].std_deviation /= selected_voxels.length;
    });

    // normalize averages between 0 and 1
    available_metabolites.forEach(function(metabolite) {
        metabolite_averages[metabolite].concentration = p5_view_R.map(metabolite_averages[metabolite].concentration, 0, CONCENTRATION_MAX, 0, 1);
        metabolite_averages[metabolite].std_deviation = p5_view_R.map(metabolite_averages[metabolite].std_deviation, 0, STDEV_MAX, 0, 1);
    });
}*/

var mlist_chosen_group = -1; // index of a group chosen for the metabolite list

function updateDropdownList() {
    $(".group-dropdown-list").empty();
    $("#edit-dropdown-menu").empty();

    voxel_groups.forEach(function(group){
        var option_html = "<option class=\"dropdown-item group-choice-item\">" + group.name + "</option>";
        $(".group-dropdown-list").append(option_html);
        if (group.isCustom()) {
            $("#edit-dropdown-menu").append(option_html);
        }
    });
}

$("#dropdown-metab-selection").on('click', ".group-choice-item", function(evt){
    var group_name = $(this).val();
    var parent_id = $(this).closest(".group-dropdown-list").attr('id');
    var btn_id = "btn-" + parent_id.split("dropdown-")[1];

    $("#" + btn_id).html(group_name);

    mlist_chosen_group = voxel_groups.findIndex(function(group){
        return group.name == group_name;
    });

    updateMetaboliteList();
});

function updateMetaboliteList() {
    $("#metabolite-list").empty();
    $("#chosen-group-text").remove();

    if (mlist_chosen_group == -1) {        
        $("#metabolites-empty").hide();
        $("#no-group").show();
        $(".metab-add-btn").addClass("disabled");
        return;
    }

    if (voxel_groups[mlist_chosen_group].available_metabolites.length == 0) {
        $("#metabolites-empty").show();
        $(".metab-add-btn").addClass("disabled");
    } else {
        $("#metabolites-empty").hide();
        $(".metab-add-btn").removeClass("disabled");
    }
    
    $("#no-group").hide();
    //$("#grid_metabolites").prepend("<p id=\"chosen-group-text\"> Chosen group: \"" + voxel_groups[mlist_chosen_group].name + "\"<br></p>");

    voxel_groups[mlist_chosen_group].available_metabolites.forEach(function(metabolite) {
        var html_string = "<a href=\"#\" class=\"list-group-item metabolite-item\" id=\"" + metabolite + "_item\">" + metabolite + "</a>";
        $("#metabolite-list").append(html_string);
        //$(html_string).appendTo("#metabolite-list");
    });
}

$("#metabolite-list").on("click", ".list-group-item", function(evt) {
    //$(this).attr('id')	
    //alert($(this).attr('class'));

    evt.preventDefault();

    $(this).toggleClass("active");

});

$("#add-all-X").on("click", function(evt) {
    p5_view_R.addMetabolites('x', voxel_groups[mlist_chosen_group].available_metabolites, mlist_chosen_group);
});

$("#add-all-Y").on("click", function(evt) {
    p5_view_R.addMetabolites('y', voxel_groups[mlist_chosen_group].available_metabolites, mlist_chosen_group);
});

$("#add-all-XY").on("click", function(evt) {
    p5_view_R.addMetabolites('x', voxel_groups[mlist_chosen_group].available_metabolites, mlist_chosen_group);
    p5_view_R.addMetabolites('y', voxel_groups[mlist_chosen_group].available_metabolites, mlist_chosen_group);
});

// goes through the metabolite selection list and returns names of metabolites that have been selected
function getMetabSelections() {
    var result = [];

    $(".metabolite-item").each(function(i, obj) {
        if ($(this).attr('class').includes("active")) {
            result.push($(this).attr('id').split("_")[0]);
        }
    });

    return result;
}

$("#add-selected-X").on("click", function(evt) {
    p5_view_R.addMetabolites('x', getMetabSelections(), mlist_chosen_group);
});

$("#add-selected-Y").on("click", function(evt) {
    p5_view_R.addMetabolites('y', getMetabSelections(), mlist_chosen_group);
});

$("#add-selected-XY").on("click", function(evt) {
    var to_add = getMetabSelections();
    p5_view_R.addMetabolites('x', to_add, mlist_chosen_group);
    p5_view_R.addMetabolites('y', to_add, mlist_chosen_group);
});