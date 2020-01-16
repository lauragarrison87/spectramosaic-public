let viewR_legend = function(p) {
    p.setup = function() {
        /*var w = parseInt($("#legend").attr("data-sizex")) * gridster_api.options.widget_base_dimensions[0] * 0.4; 
        var h = parseInt($("#legend").attr("data-sizey")) * gridster_api.options.widget_base_dimensions[1] * 0.9; */
        var w = parseInt($("#legend").attr("data-sizex")) * (($(".gridster").width() - gridster_api.options.widget_margins[0]) / 35 - 3) * 0.4;
        var h = parseInt($("#legend").attr("data-sizey")) * (($(".gridster").height() - gridster_api.options.widget_margins[1]) / 17 - 3);

        p.createCanvas(w, h);

        p.textAlign(p.CENTER, p.CENTER);
        p.rectMode(p.CORNER);

        var textSize = p.ceil(p.width / 10);
        //p.textFont("Arial", textSize);
        p.textFont("Arial", 9);
    }

    p.draw = function() {
        p.update();
        p.noLoop();
    }

    // -------------- draw the colormap legend --------------
    p.update = function() {
        //p.background("#EFEFEF");
        p.background(255);

        var granularity = 100;

        var y_start = p.height * 0.03;
        var y_end = p.height * 0.9;
        var x1 = p.width * 0.75;

        var thickness = p.width * 0.25;
        var y_step = p.ceil((y_end - y_start) / granularity) + 1;

        for (var i = 0; i < granularity; i++) {
            var heat_value = p.map(i, 0, granularity, heatmap_limits[0], heatmap_limits[1]);
            var y_pos = p.map(i, 0, granularity, y_start, y_end);

            var c1 = p5_view_R.getHeatColor(heat_value, false); //red-blue heatmap 

            p.fill(c1); //fill heatmap rectangle
            p.noStroke();

            p.rect(x1, y_pos, thickness, y_step);

            p.fill(0);

            if (i == 0) {
                p.text("> " + heatmap_limits[0], p.width * 0.35, y_pos);
            } else if (i == granularity - 1) {
                p.text("< " + (-1 / heatmap_limits[1]).toFixed(2), p.width * 0.35, y_pos);
            } else if (i == p.floor(granularity * 0.25)) {
                p.text(heatmap_limits[0] / 2, p.width * 0.35, y_pos);
            } else if (i == p.floor(granularity * 0.75)) {
                var mid_val = p.map(i, granularity / 2, granularity - 1, heatmap_limits[1], 1);
                p.text((-1 / mid_val).toFixed(2), p.width * 0.35, y_pos);

            }
        }

        // draw the tick for 1 in the middle		
        p.text(1, p.width * 0.2, (y_end + y_start) / 2);
    }

    // -------------- draw the glyph legend --------------
    p.resized = function() {
        var w = parseInt($("#legend").attr("data-sizex")) * (($(".gridster").width() - gridster_api.options.widget_margins[0]) / 35 - 3) * 0.4;
        var h = parseInt($("#legend").attr("data-sizey")) * (($(".gridster").height() - gridster_api.options.widget_margins[1]) / 17 - 3);
        p.resizeCanvas(w, h);

        var textSize = p.ceil(p.width / 10);
        //p.textFont("Arial", textSize);
        p.textFont("Arial", 12);

        p.update();
    }
};