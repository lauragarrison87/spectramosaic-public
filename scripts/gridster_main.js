let gridster_api, p5_view_L, p5_view_R, p5_heatmap_legend;


$(function() {
    gridster_api = $(".gridster ul").gridster({
        widget_base_dimensions: ['auto', 45],
        // autogenerate_stylesheet: true,
        min_cols: 30,
        max_cols: 35,
        widget_margins: [5, 5],
        avoid_overlapped_widgets: true,
        helper: 'clone',
        /*resize: {
            enabled: false,
			max_size: [30, 13],
			min_size: [1, 1],
            resize: function(e, ui, $widget) {
                p5_view_L.resized();
                p5_view_R.resized();
				p5_heatmap_legend.resized();
            }
        }*/
    }).data('gridster').disable();

    p5_view_L = new p5(viewL, "viewL");
    p5_view_R = new p5(viewR, "viewR");
	p5_heatmap_legend = new p5(viewR_legend, "viewR_legend");
    resizeVoxelSelectionPanel();
    updateDropdownList();
    updateMetaboliteList();
});

$(window).on('resize', function(){
	// wait for gridster to animate
	setTimeout(function(){
		p5_view_L.resized();
		p5_view_R.resized();
		p5_heatmap_legend.resized();
		resizeVoxelSelectionPanel();
	}, 200);
});

// count fixed size of the left panel voxel selection div
function resizeVoxelSelectionPanel() {	
	var w = parseInt($("#grid_viewL").attr("data-sizex")) * (($( ".gridster" ).width() - gridster_api.options.widget_margins[0]) / 35 + 0.5); 
	var h = parseInt($("#grid_viewL").attr("data-sizey")) * (($( ".gridster" ).height() - gridster_api.options.widget_margins[1]) / 17 - 3); 
	
	$("#viewL-select").css('width', Math.round(w) + "px");
	$("#viewL-select").css('height', Math.round(h) + "px");
}

// make sure the gridster api remains disabled (the windows can't be dragged)
$(window).on('mousemove', function(){
	gridster_api.disable();
});